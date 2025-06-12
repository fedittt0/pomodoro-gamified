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
    weekly_goal: { type: Number, default: 0 }
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
        password: hashedPassword
    });

    await nuevoUsuario.save();

    res.json({ mensaje: 'Usuario registrado con éxito', userId: nuevoUsuario._id });
});

// --- LOGIN USER ---
app.post('/api/login', async (req, res) => {
    const { nombre, password } = req.body;

    if (!nombre || !password) {
        return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos.' });
    }

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) {
        return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    const passwordMatch = bcrypt.compareSync(password, usuario.password);
    if (!passwordMatch) {
        return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    res.json({ mensaje: 'Login exitoso', userId: usuario._id, nombre: usuario.nombre });
});

// --- ADD POMODORO TIME ---
app.post('/api/pomodoro/add-time', async (req, res) => {
    const { nombre, minutes } = req.body;

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    usuario.total_pomodoro_minutes += minutes;
    await usuario.save();

    res.json({ mensaje: 'Tiempo actualizado con éxito', total: usuario.total_pomodoro_minutes });
});

// --- GET USER DATA ---
app.post('/api/user/data', async (req, res) => {
    const { nombre } = req.body;

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({
        nombre: usuario.nombre,
        total_pomodoro_minutes: usuario.total_pomodoro_minutes,
        weekly_goal: usuario.weekly_goal
    });
});

// --- SAVE WEEKLY GOAL ---
app.post('/api/user/save-goals', async (req, res) => {
    const { nombre, weekly_goal } = req.body;

    const usuario = await Usuario.findOne({ nombre });
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    usuario.weekly_goal = weekly_goal;
    await usuario.save();

    res.json({ mensaje: 'Meta semanal actualizada con éxito' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
