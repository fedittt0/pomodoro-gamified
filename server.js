const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error de conexión a MongoDB:', err));

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    total_pomodoro_minutes: { type: Number, default: 0 },
    weekly_goal: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }, // NEW: Add XP field
    last_reset_date: { type: Date, default: Date.now } // NEW: Add last reset date
});

const Usuario = mongoose.model('Usuario', UsuarioSchema);

// --- REGISTER USER ---
app.post('/api/usuarios', async (req, res) => {
    const { nombre, password } = req.body;

    if (!nombre || !password) {
        return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos.' });
    }

    const existingUser = await Usuario.findOne({ nombre });
    if (existingUser) {
        return res.status(400).json({ mensaje: 'El usuario ya existe' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const nuevoUsuario = new Usuario({
        nombre,
        password: hashedPassword,
        total_pomodoro_minutes: 0,
        weekly_goal: 0,
        xp: 0, // Initialize XP for new user
        last_reset_date: new Date() // Set initial reset date
    });

    try {
        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario registrado con éxito', userId: nuevoUsuario._id });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al registrar usuario.' });
    }
});

// --- LOGIN USER ---
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) {
        return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
    }

    const isMatch = bcrypt.compareSync(password, usuario.password);
    if (!isMatch) {
        return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
    }

    res.json({ mensaje: 'Inicio de sesión exitoso', userId: usuario._id, nombre: usuario.nombre });
});

// --- ADD POMODORO TIME ---
// MODIFIED: Now expects userId in body and finds by _id
app.post('/api/pomodoro/add-time', async (req, res) => {
    const { userId, minutes } = req.body; // Expects userId

    const usuario = await Usuario.findById(userId); // Find user by MongoDB _id
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    usuario.total_pomodoro_minutes += minutes;
    usuario.xp += minutes; // Add XP based on minutes studied (1 XP per minute)

    try {
        await usuario.save();
        res.json({
            mensaje: 'Tiempo y XP actualizados con éxito',
            total_pomodoro_minutes: usuario.total_pomodoro_minutes,
            weekly_goal: usuario.weekly_goal, // Return weekly_goal for frontend consistency
            xp: usuario.xp // Return updated XP
        });
    } catch (error) {
        console.error('Error al agregar tiempo de Pomodoro:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al actualizar tiempo.' });
    }
});

// --- GET USER DATA ---
// MODIFIED: Now is a GET request and takes userId from query params
app.get('/api/user/data', async (req, res) => {
    const { userId } = req.query; // Get userId from query parameters

    const usuario = await Usuario.findById(userId); // Find user by MongoDB _id
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Weekly reset logic for total_pomodoro_minutes (Only resets if it's Monday and not reset yet this week)
    const today = new Date();
    // Get current day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
    const currentDayOfWeek = today.getDay(); 

    // Calculate the start of the current week (Monday at 00:00:00)
    const startOfCurrentWeek = new Date(today);
    // Adjust to Monday: if today is Sunday (0), subtract 6 days; otherwise, subtract (day - 1) days.
    startOfCurrentWeek.setDate(today.getDate() - (currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1));
    startOfCurrentWeek.setHours(0, 0, 0, 0); // Set time to beginning of the day

    let total_pomodoro_minutes = usuario.total_pomodoro_minutes;
    let last_reset_date = usuario.last_reset_date || startOfCurrentWeek; // Ensure last_reset_date exists

    // If it's Monday and the last reset happened *before* the start of the current week (i.e., last week or earlier)
    if (currentDayOfWeek === 1 && new Date(last_reset_date) < startOfCurrentWeek) {
        total_pomodoro_minutes = 0; // Reset total minutes for the new week
        usuario.total_pomodoro_minutes = 0; // Update in DB
        usuario.last_reset_date = today; // Update last reset date to today's date
        try {
            await usuario.save(); // Save the reset state to DB
            console.log(`Weekly reset for user ${usuario.nombre}. total_pomodoro_minutes reset to 0.`);
        } catch (saveError) {
            console.error('Error saving weekly reset:', saveError);
        }
    }

    res.json({
        nombre: usuario.nombre,
        total_pomodoro_minutes: usuario.total_pomodoro_minutes, // Send potentially reset value
        weekly_goal: usuario.weekly_goal,
        xp: usuario.xp,
        last_reset_date: usuario.last_reset_date // Send the last reset date
    });
});

// --- SAVE WEEKLY GOAL ---
// MODIFIED: Now expects userId in body and finds by _id
app.post('/api/user/save-goals', async (req, res) => {
    const { userId, weekly_goal } = req.body; // Expects userId

    const usuario = await Usuario.findById(userId); // Find user by MongoDB _id
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    usuario.weekly_goal = weekly_goal;

    try {
        await usuario.save();
        res.json({
            mensaje: 'Objetivo semanal guardado con éxito',
            weekly_goal: usuario.weekly_goal,
            total_pomodoro_minutes: usuario.total_pomodoro_minutes, // Include current total minutes
            xp: usuario.xp // Include current XP
        });
    } catch (error) {
        console.error('Error al guardar objetivo semanal:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al guardar objetivo.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});