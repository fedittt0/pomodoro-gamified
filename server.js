const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Remove deprecated options as they have no effect in newer Mongoose versions
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error de conexión a MongoDB:', err));

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    total_pomodoro_minutes: { type: Number, default: 0 },
    weekly_goal: { type: Number, default: 0 },
    xp: { type: Number, default: 0 } // <--- ENSURE THIS LINE IS PRESENT
});

const Usuario = mongoose.model('Usuario', UsuarioSchema);

// --- REGISTER USER ---
app.post('/api/usuarios', async (req, res) => {
    const { nombre, password } = req.body;

    if (!nombre || !password) {
        return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos.' });
    }

    try {
        const existingUser = await Usuario.findOne({ nombre });
        if (existingUser) {
            return res.status(400).json({ mensaje: 'El usuario ya existe' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const nuevoUsuario = new Usuario({ nombre, password: hashedPassword });
        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario registrado con éxito', userId: nuevoUsuario._id });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// --- LOGIN USER ---
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;

    try {
        const usuario = await Usuario.findOne({ nombre });
        if (!usuario) {
            return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
        }

        const isMatch = bcrypt.compareSync(password, usuario.password);
        if (!isMatch) {
            return res.status(400).json({ mensaje: 'Credenciales incorrectas' });
        }

        res.status(200).json({
            mensaje: 'Inicio de sesión exitoso',
            userId: usuario._id,
            nombre: usuario.nombre
        });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// --- ADD POMODORO TIME --- (This was fixed in the previous step)
app.post('/api/pomodoro/add-time', async (req, res) => {
    const { userId, minutes } = req.body;

    if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
        return res.status(400).json({ mensaje: 'Valor de minutos inválido.' });
    }

    try {
        const usuario = await Usuario.findById(userId);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        usuario.total_pomodoro_minutes += minutes;
        usuario.xp += minutes; // Add XP for Pomodoro minutes (adjust formula as needed)

        await usuario.save();

        res.json({
            mensaje: 'Tiempo y XP actualizados con éxito',
            total_pomodoro_minutes: usuario.total_pomodoro_minutes,
            weekly_goal: usuario.weekly_goal,
            xp: usuario.xp
        });

    } catch (error) {
        console.error('Error al agregar tiempo de Pomodoro:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// --- GET USER DATA ---
// MODIFIED: Changed to GET and uses userId from query parameters
app.get('/api/user/data', async (req, res) => {
    const userId = req.query.userId; // Get userId from query parameters (e.g., /api/user/data?userId=...)

    if (!userId) {
        return res.status(400).json({ mensaje: 'ID de usuario requerido.' });
    }

    try {
        const usuario = await Usuario.findById(userId); // Find user by their ID

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json({
            nombre: usuario.nombre,
            total_pomodoro_minutes: usuario.total_pomodoro_minutes,
            weekly_goal: usuario.weekly_goal, // Send back the weekly goal
            xp: usuario.xp // Send back the XP
        });
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// --- SAVE WEEKLY GOAL ---
// MODIFIED: Uses userId from request body
app.post('/api/user/save-goals', async (req, res) => {
    const { userId, weekly_goal } = req.body; // Get userId and weekly_goal from request body

    if (!userId) {
        return res.status(400).json({ mensaje: 'ID de usuario requerido.' });
    }
    if (typeof weekly_goal !== 'number' || isNaN(weekly_goal) || weekly_goal < 0) {
        return res.status(400).json({ mensaje: 'Meta semanal inválida.' });
    }

    try {
        const usuario = await Usuario.findById(userId); // Find user by their ID

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        usuario.weekly_goal = weekly_goal; // Update the user's weekly goal
        await usuario.save();

        // Send back updated data (including total_pomodoro_minutes and XP)
        res.json({
            mensaje: 'Objetivo semanal guardado con éxito',
            total_pomodoro_minutes: usuario.total_pomodoro_minutes,
            weekly_goal: usuario.weekly_goal,
            xp: usuario.xp
        });
    } catch (error) {
        console.error('Error al guardar objetivos:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});