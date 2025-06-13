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
    xp: { type: Number, default: 0 }, // XP field
    last_reset_date: { type: Date, default: Date.now }
    // You can add a field to track purchased rewards if needed:
    // purchased_rewards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Reward' }]
});

const Usuario = mongoose.model('Usuario', UsuarioSchema);

// NEW: Reward Schema and Model
const RewardSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    cost: { type: Number, required: true, min: 0 }
});

const Reward = mongoose.model('Reward', RewardSchema);


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
    const nuevoUsuario = new Usuario({ nombre, password: hashedPassword });

    try {
        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ mensaje: 'Error al registrar usuario.' });
    }
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) {
        return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const isMatch = bcrypt.compareSync(password, usuario.password);
    if (!isMatch) {
        return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    res.json({ mensaje: 'Inicio de sesión exitoso', nombre: usuario.nombre, userId: usuario._id });
});

// --- ADD POMODORO TIME ---
// MODIFIED: Now expects userId in body and finds by _id, also updates XP
app.post('/api/pomodoro/add-time', async (req, res) => {
    const { userId, minutes } = req.body; // Expects userId

    const usuario = await Usuario.findById(userId); // Find user by MongoDB _id
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    usuario.total_pomodoro_minutes += minutes;
    usuario.xp += minutes; // Assuming 1 XP per minute of Pomodoro
    // You can adjust XP calculation (e.g., 20 XP per completed Pomodoro)

    try {
        await usuario.save();
        res.json({
            mensaje: 'Tiempo y XP actualizados con éxito',
            total_pomodoro_minutes: usuario.total_pomodoro_minutes,
            weekly_goal: usuario.weekly_goal, // Send back current weekly goal
            xp: usuario.xp // Send back updated XP
        });
    } catch (error) {
        console.error('Error al agregar tiempo de Pomodoro:', error);
        res.status(500).json({ mensaje: 'Error al agregar tiempo de Pomodoro.' });
    }
});

// --- GET USER DATA ---
// MODIFIED: Now expects userId in query params and finds by _id, includes XP and last_reset_date
app.get('/api/user/data', async (req, res) => { // Changed to GET
    const { userId } = req.query; // Get userId from query parameters

    const usuario = await Usuario.findById(userId); // Find user by MongoDB _id
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Weekly reset logic (moved from client-side for robustness)
    const today = new Date();
    const lastReset = new Date(usuario.last_reset_date);

    // Check if it's a new week (e.g., if current Monday is after last reset Monday)
    // This assumes a week starts on Monday (getDay() === 1)
    const isNewWeek = today.getDay() === 1 && (today.getDate() !== lastReset.getDate() || today.getMonth() !== lastReset.getMonth() || today.getFullYear() !== lastReset.getFullYear());

    if (isNewWeek && usuario.total_pomodoro_minutes > 0) { // Only reset if there was activity last week
        console.log(`Resetting total_pomodoro_minutes for ${usuario.nombre}. Old value: ${usuario.total_pomodoro_minutes}`);
        usuario.total_pomodoro_minutes = 0; // Reset weekly minutes
        usuario.last_reset_date = today; // Update last reset date to today
        try {
            await usuario.save();
            console.log(`Weekly reset complete for ${usuario.nombre}.`);
        } catch (saveError) {
            console.error('Error saving weekly reset:', saveError);
        }
    }

    res.json({
        nombre: usuario.nombre,
        total_pomodoro_minutes: usuario.total_pomodoro_minutes, // Send potentially reset value
        weekly_goal: usuario.weekly_goal,
        xp: usuario.xp, // Include XP
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
        res.status(500).json({ mensaje: 'Error al guardar objetivo. Intenta de nuevo.' });
    }
});


// ===========================================
// NEW API Endpoints for XP Shop Rewards
// ===========================================

// GET all rewards
app.get('/api/rewards', async (req, res) => {
    try {
        const rewards = await Reward.find({});
        res.json(rewards);
    } catch (error) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({ message: 'Error al obtener recompensas.' });
    }
});

// POST a new reward
app.post('/api/rewards', async (req, res) => {
    const { name, cost } = req.body;

    if (!name || cost === undefined || cost < 0) {
        return res.status(400).json({ message: 'Nombre y costo válidos son requeridos para la recompensa.' });
    }

    const newReward = new Reward({ name, cost });
    try {
        await newReward.save();
        res.status(201).json({ message: 'Recompensa añadida con éxito', reward: newReward });
    } catch (error) {
        console.error('Error adding new reward:', error);
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'Ya existe una recompensa con este nombre.' });
        }
        res.status(500).json({ message: 'Error al añadir la recompensa.' });
    }
});

// POST to purchase a reward (deduct XP)
app.post('/api/user/purchase-reward', async (req, res) => {
    const { userId, rewardId, cost } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const usuario = await Usuario.findById(userId).session(session);
        if (!usuario) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (usuario.xp < cost) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'XP insuficiente para comprar esta recompensa.' });
        }

        // Optional: Check if reward exists (good practice but not strictly necessary if client sends correct ID)
        const reward = await Reward.findById(rewardId).session(session);
        if (!reward) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Recompensa no encontrada.' });
        }

        usuario.xp -= cost; // Deduct XP

        // Optional: Add reward to user's purchased_rewards array
        // if you uncommented purchased_rewards in UsuarioSchema
        // usuario.purchased_rewards.push(reward._id);

        await usuario.save({ session });
        await session.commitTransaction();
        session.endSession();

        res.json({ message: 'Recompensa comprada con éxito.', newXp: usuario.xp });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error purchasing reward:', error);
        res.status(500).json({ message: 'Error al procesar la compra.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});