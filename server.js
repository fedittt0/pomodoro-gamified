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
    xp: { type: Number, default: 0 },
    last_reset_date: { type: Date, default: Date.now } // <--- NEW: Field to track last reset date
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

// --- ADD POMODORO TIME ---
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
app.get('/api/user/data', async (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ mensaje: 'ID de usuario requerido.' });
    }

    try {
        const usuario = await Usuario.findById(userId);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // --- WEEKLY RESET LOGIC ---
        const now = new Date();
        // Create a date object for the current day at 00:00:00 to compare dates only
        const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get the day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday)
        const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday...

        // Calculate the start of the current week (Monday)
        // If today is Monday (1), days_since_monday = 0
        // If today is Sunday (0), days_since_monday = 6
        const daysSinceMonday = (currentDayOfWeek === 0) ? 6 : (currentDayOfWeek - 1);
        const startOfCurrentWeek = new Date(todayAtMidnight);
        startOfCurrentWeek.setDate(todayAtMidnight.getDate() - daysSinceMonday);
        startOfCurrentWeek.setHours(0, 0, 0, 0); // Ensure it's at the very start of Monday

        // Ensure last_reset_date is a valid Date object, initialize if not
        if (!usuario.last_reset_date || isNaN(usuario.last_reset_date.getTime())) {
            usuario.last_reset_date = new Date(); // Set to current date if invalid or missing
        }
        
        // If last_reset_date is BEFORE the start of the current week (Monday), it's time for a reset
        if (usuario.last_reset_date < startOfCurrentWeek) {
            console.log(`Resetting weekly total for user ${usuario.nombre}. Old total: ${usuario.total_pomodoro_minutes}`);
            usuario.total_pomodoro_minutes = 0; // Reset total minutes for the new week
            usuario.last_reset_date = now; // Update reset date to the current date/time
            await usuario.save(); // Save the reset state to the database
            console.log(`New total: ${usuario.total_pomodoro_minutes}, New reset date: ${usuario.last_reset_date}`);
        }
        // --- END WEEKLY RESET LOGIC ---

        res.json({
            nombre: usuario.nombre,
            total_pomodoro_minutes: usuario.total_pomodoro_minutes, // Will be the potentially reset value
            weekly_goal: usuario.weekly_goal,
            xp: usuario.xp,
            last_reset_date: usuario.last_reset_date // Send back last reset date for client-side checks
        });
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// --- SAVE WEEKLY GOAL ---
app.post('/api/user/save-goals', async (req, res) => {
    const { userId, weekly_goal } = req.body;

    if (!userId) {
        return res.status(400).json({ mensaje: 'ID de usuario requerido.' });
    }
    if (typeof weekly_goal !== 'number' || isNaN(weekly_goal) || weekly_goal < 0) {
        return res.status(400).json({ mensaje: 'Meta semanal inválida.' });
    }

    try {
        const usuario = await Usuario.findById(userId);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        usuario.weekly_goal = weekly_goal;
        await usuario.save();

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