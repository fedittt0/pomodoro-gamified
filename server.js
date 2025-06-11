const bcrypt = require('bcryptjs');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'usuarios.json');

app.use(cors());
app.use(express.json());

// Load users data or initialize
let usuarios = [];
if (fs.existsSync(DATA_FILE)) {
    try {
        usuarios = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('Failed to parse usuarios.json, starting fresh or handling corrupt data.');
        usuarios = [];
    }
}

// Helper: Save usuarios to file
function saveUsuarios() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(usuarios, null, 2));
}

// --- REGISTER USER ---
app.post('/api/usuarios', (req, res) => {
    const { nombre, password } = req.body;
    if (!nombre || !password) {
        return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos.' });
    }

    if (usuarios.find(u => u.nombre === nombre)) {
        return res.status(400).json({ mensaje: 'El usuario ya existe' });
    }

    // 🔐 Encriptar contraseña
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(password, 10); // 10 es el nivel de seguridad

    const usuarioObj = {
        id: Date.now().toString(),
        nombre,
        password: hashedPassword,
        total_pomodoro_minutes: 0,
        weekly_goal: 0
    };
    usuarios.push(usuarioObj);
    saveUsuarios();
    res.json({ mensaje: 'Usuario registrado con éxito', userId: usuarioObj.id });
});


// --- LOGIN USER ---
app.post('/api/login', (req, res) => {
    const { nombre, password } = req.body;
    if (!nombre || !password) {
        return res.status(400).json({ mensaje: 'Nombre y contraseña son requeridos.' });
    }

    const usuario = usuarios.find(u => u.nombre === nombre);
    if (!usuario) {
        return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    // 🔐 Comparar la contraseña encriptada
    const bcrypt = require('bcryptjs');
    const passwordMatch = bcrypt.compareSync(password, usuario.password);
    if (!passwordMatch) {
        return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    res.json({ mensaje: 'Login exitoso', userId: usuario.id, nombre: usuario.nombre });
});


// --- ADD POMODORO TIME ---
app.post('/api/pomodoro/add-time', (req, res) => {
    const { userId, minutesToAdd } = req.body;
    if (!userId || typeof minutesToAdd !== 'number' || minutesToAdd < 0) {
        return res.status(400).json({ mensaje: 'Parámetros inválidos' });
    }
    const usuario = usuarios.find(u => u.id === userId);
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    usuario.total_pomodoro_minutes += minutesToAdd;
    saveUsuarios();
    res.json({ mensaje: 'Tiempo de Pomodoro actualizado', totalPomodoroMinutes: usuario.total_pomodoro_minutes });
});

// --- GET USER DATA ---
app.get('/api/user/data', (req, res) => {
    const userId = req.query.userId; // Expect userId in query for demo
    if (!userId) {
        return res.status(400).json({ mensaje: 'userId requerido' });
    }
    const usuario = usuarios.find(u => u.id === userId);
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({
        totalPomodoroMinutes: usuario.total_pomodoro_minutes,
        // MODIFICATION: Return single weekly_goal
        weeklyGoal: usuario.weekly_goal
    });
});

// --- SAVE USER GOALS ---
app.post('/api/user/save-goals', (req, res) => {
    const { userId, totalHours } = req.body; // MODIFICATION: Expect totalHours
    if (!userId || typeof totalHours !== 'number' || totalHours < 0) {
        return res.status(400).json({ mensaje: 'Parámetros inválidos (userId y totalHours como número positivo requeridos).' });
    }
    const usuario = usuarios.find(u => u.id === userId);
    if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    // Convert hours to minutes for storage
    usuario.weekly_goal = totalHours * 60; // MODIFICATION: Store as single weekly_goal
    saveUsuarios();
    res.json({ mensaje: 'Objetivo semanal guardado correctamente', weeklyGoal: usuario.weekly_goal });
});

// Fallback route for unsupported endpoints
app.use((req, res) => {
    res.status(404).json({ mensaje: 'Endpoint no encontrado' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});