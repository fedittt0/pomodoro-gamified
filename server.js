const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is used for password hashing
const mongoose = require('mongoose');
require('dotenv').config(); // If you use a .env file for MONGO_URI

const app = express();
app.use(cors());
app.use(express.json());

// Replace with your MongoDB connection string from .env or directly
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error de conexión a MongoDB:', err));

// User Schema Definition
const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    total_pomodoro_minutes: { type: Number, default: 0 }, // Using existing underscore naming
    weekly_goal: { type: Number, default: 0 },           // Using existing underscore naming
    xp: { type: Number, default: 0 }                     // NEW: XP field
});

const Usuario = mongoose.model('Usuario', UsuarioSchema);

// --- REGISTER USER ---
// Your existing register endpoint (assuming it's /api/usuarios)
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
        const hashedPassword = bcrypt.hashSync(password, 10); // Assuming bcrypt.hashSync is used
        // New user will get default values for total_pomodoro_minutes, weekly_goal, and xp
        const newUser = new Usuario({ nombre, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ mensaje: 'Usuario registrado con éxito.' });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al registrar usuario.' });
    }
});

// --- LOGIN USER ---
// Your existing login endpoint (assuming it's /api/login)
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;
    try {
        const user = await Usuario.findOne({ nombre });
        if (!user) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
        }
        const isMatch = await bcrypt.compare(password, user.password); // Assuming bcrypt.compare
        if (!isMatch) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
        }
        // IMPORTANT: Return user ID and name for frontend to store
        res.json({ mensaje: 'Inicio de sesión exitoso.', userId: user._id, nombre: user.nombre });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al iniciar sesión.' });
    }
});

// --- ADD POMODORO TIME ---
app.post('/api/pomodoro/add-time', async (req, res) => {
    // Frontend sends userId, not nombre, so destructure userId
    const { userId, minutes } = req.body; 

    // Input validation: Ensure minutes is a valid number
    if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
        return res.status(400).json({ mensaje: 'Valor de minutos inválido.' });
    }

    try {
        // Find the user by their unique MongoDB _id (userId)
        const usuario = await Usuario.findById(userId); 

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Add the new minutes to the total
        usuario.total_pomodoro_minutes += minutes;

        // For now, XP calculation: 1 XP per minute of Pomodoro
        // You can adjust this formula later
        usuario.xp += minutes; 

        await usuario.save(); // Save the updated user document

        // Send back the updated user data to the frontend
        res.json({
            mensaje: 'Tiempo y XP actualizados con éxito',
            total_pomodoro_minutes: usuario.total_pomodoro_minutes,
            weekly_goal: usuario.weekly_goal, // Send back current weekly goal
            xp: usuario.xp // Send back updated XP
        });

    } catch (error) {
        // Log the detailed error for debugging
        console.error('Error al agregar tiempo de Pomodoro:', error); 
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
});

// --- GET USER DATA ---
app.get('/api/user/data', async (req, res) => {
    const { userId } = req.query; // Expecting userId from query parameters
    try {
        const user = await Usuario.findById(userId); // Find user by ID
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        res.json({ 
            nombre: user.nombre, // Return name for greeting
            total_pomodoro_minutes: user.total_pomodoro_minutes, 
            weekly_goal: user.weekly_goal,
            xp: user.xp // Return XP
        });
    } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// --- SAVE WEEKLY GOAL ---
app.post('/api/user/save-goals', async (req, res) => {
    const { userId, weeklyGoal } = req.body; // Expecting userId (from frontend) and weeklyGoal (camelCase from frontend, converted to minutes)
    try {
        const user = await Usuario.findById(userId); // Find user by ID
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.weekly_goal = weeklyGoal; // Assign to the schema field (underscore naming)
        
        // Recalculate XP as the goal might have changed, affecting percentage
        let currentPercentage = 0;
        if (user.weekly_goal > 0) {
            currentPercentage = (user.total_pomodoro_minutes / user.weekly_goal) * 100;
            currentPercentage = Math.min(100, currentPercentage);
        }
        user.xp = Math.floor(currentPercentage) * 10;

        await user.save();
        res.json({ 
            message: 'Objetivo semanal guardado con éxito.', 
            weekly_goal: user.weekly_goal, // Return the updated goal (underscore naming)
            total_pomodoro_minutes: user.total_pomodoro_minutes, // Return current total (underscore naming)
            xp: user.xp // Return updated XP
        });
    } catch (error) {
        console.error('Error al guardar objetivo semanal:', error);
        res.status(500).json({ message: 'Error interno del servidor al guardar objetivo.' });
    }
});

// Set up the port for the server to listen on
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});