// script.js

// Pomodoro timer settings
const pomodoroDuration = 20 * 60; // 20 minutes
const shortBreakDuration = 5 * 60; // 5 minutes
const longBreakDuration = 10 * 60; // 10 minutes
const pomodorosUntilLongBreak = 4;

let timer = pomodoroDuration;
let timerInterval = null;
let isRunning = false;
let pomodorosCompleted = 0; // Pomodoros completed in current session (resets on page load)
let currentMode = 'Pomodoro'; // Modes: Pomodoro, Short Break, Long Break

// Global variables for user data and goals
let loggedInUserId = null;
let totalPomodoroMinutes = 0; // Accumulated time from backend

// MODIFICATION: weeklyStudyGoals is now a single number (in minutes)
let weeklyStudyGoals = 0; // Total desired study time for the week in minutes

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const modeLabel = document.getElementById('mode-label');
const playPauseButton = document.getElementById('play-pause');
const resetButton = document.getElementById('reset');
const pomodoroCountDisplay = document.getElementById('pomodoro-count'); // Consider if still needed or replaced by totalPomodoroMinutes

// New DOM Elements for XP display
const xpBubble = document.getElementById('xp-bubble'); // Reference to the XP bubble element

// Global variable for user's XP
let userXp = 0;

// New DOM Elements for Study Goals & Progress
const greetingContainer = document.querySelector('.greeting-container');

// MODIFICATION: Reference the new single input for weekly goal
const weeklyGoalInput = document.getElementById('weekly-goal'); // Direct reference to the single input
const saveGoalsBtn = document.getElementById('save-goals-btn');

const currentPomodoroTimeDisplay = document.getElementById('current-pomodoro-time');
const totalDesiredTimeDisplay = document.getElementById('total-desired-time');
const progressBarFill = document.querySelector('.progress-bar-fill');
const progressPercentageValue = document.getElementById('progress-percentage-value');

// ======================================
// Helper Functions
// ======================================
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(timer);
    modeLabel.textContent = currentMode;
    // pomodoroCountDisplay.textContent = pomodorosCompleted; // Keeping this for session count if needed
}

// Function to display the user's XP in the bubble
function displayXp() {
    if (xpBubble) {
        xpBubble.textContent = `XP: ${userXp}`;
    }
}

// ======================================
// Pomodoro Timer Logic
// ======================================
function startTimer() {
    isRunning = true;
    playPauseButton.textContent = 'Pausa';
    timerInterval = setInterval(() => {
        timer--;
        updateDisplay();
        if (timer <= 0) {
            clearInterval(timerInterval);
            handleTimerEnd();
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false;
    playPauseButton.textContent = 'Iniciar';
    clearInterval(timerInterval);
}

function resetTimer() {
    pauseTimer();
    // Reset based on current mode
    if (currentMode === 'Pomodoro') {
        timer = pomodoroDuration;
    } else if (currentMode === 'Short Break') {
        timer = shortBreakDuration;
    } else if (currentMode === 'Long Break') {
        timer = longBreakDuration;
    }
    updateDisplay();
}

// IMPORTANT MODIFICATION: handleTimerEnd to send data to backend
// Function to handle the end of a Pomodoro session or break
async function handleTimerEnd() { // Ensure it's an async function
    if (currentMode === 'Pomodoro') {
        pomodorosCompleted++;
        // --- THIS IS THE CRITICAL FETCH CALL YOU NEED TO UPDATE ---
        try {
            const response = await fetch('https://pomodoro-gamified.onrender.com/api/pomodoro/add-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggedInUserId, minutes: pomodoroDuration / 60 })
            });

            if (response.ok) {
                const data = await response.json();
                totalPomodoroMinutes = data.total_pomodoro_minutes; // Update with new total
                weeklyStudyGoals = data.weekly_goal; // Update with latest goal (just in case)
                userXp = data.xp; // Get updated XP
                updateProgressBar(); // Recalculate progress with new total minutes
                displayXp(); // Update XP display
                alert('Pomodoro completado!');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al agregar el tiempo de Pomodoro.');
            }
        } catch (error) {
            console.error('Error al agregar tiempo de Pomodoro:', error);
            alert('Error al agregar tiempo de Pomodoro: ' + error.message);
        }
        // --- END OF CRITICAL FETCH CALL ---


        if (pomodorosCompleted % pomodorosUntilLongBreak === 0) {
            currentMode = 'Long Break';
            timer = longBreakDuration;
        } else {
            currentMode = 'Short Break';
            timer = shortBreakDuration;
        }
    } else { // It's a break
        currentMode = 'Pomodoro';
        timer = pomodoroDuration;
    }
    updateDisplay();
}

// ======================================
// User Authentication & Data Management
// ======================================

// NEW: Function to fetch user data from backend
// Function to fetch user data and update UI
async function fetchUserData() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        // This case should be handled by the DOMContentLoaded check, but good to have
        console.error('No userId found in localStorage.');
        alert('Tenés que iniciar sesión primero.');
        window.location.href = 'auth_interface.html';
        return;
    }

    try {
        // Correctly fetch data using userId as a query parameter
        const response = await fetch(`https://pomodoro-gamified.onrender.com/api/user/data?userId=${userId}`);
        const data = await response.json();

        if (response.ok) {
            loggedInUserId = userId; // Ensure this is set
            totalPomodoroMinutes = data.total_pomodoro_minutes; // Use underscore naming
            weeklyStudyGoals = data.weekly_goal; // Use underscore naming
            userXp = data.xp; // Get XP from backend

            // Update the HTML input field with the fetched weekly goal (convert minutes to hours)
            if (weeklyGoalInput) { // Check if the element exists
                weeklyGoalInput.value = (weeklyStudyGoals / 60).toFixed(0);
            }

            // Update progress bar and XP display
            updateProgressBar();
            displayXp(); // Call function to display XP
            
            // Display user greeting (ensure this is still here)
            if (greetingContainer && data.nombre) {
                greetingContainer.textContent = `Hola, ${data.nombre}!`;
            }

        } else {
            console.error('Error al obtener datos del usuario:', data.message);
            alert(data.message || 'Error al cargar los datos del usuario.');
            // Optionally, log out if user data can't be fetched
            logoutUsuario(); 
        }
    } catch (error) {
        console.error('Error de conexión al obtener datos del usuario:', error);
        alert('Error de conexión al cargar los datos del usuario.');
        // Optionally, log out on connection error
        logoutUsuario();
    }
}

// MODIFICATION: Function to populate the single weekly study goal input
function populateGoalsInputs() {
    // Convert minutes from backend to hours for display in input
    const hours = weeklyStudyGoals / 60;
    if (weeklyGoalInput) {
        weeklyGoalInput.value = hours;
    }
}

// MODIFICATION: Function to save single weekly study goal to backend
// Function to save weekly goals
async function saveWeeklyGoals() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert('Necesitas iniciar sesión para guardar tus objetivos.');
        window.location.href = 'auth_interface.html';
        return;
    }

    // Get the value from the weekly goal input, convert to minutes
    const newWeeklyGoalHours = parseInt(weeklyGoalInput.value);
    if (isNaN(newWeeklyGoalHours) || newWeeklyGoalHours < 0) {
        alert('Por favor, introduce una meta semanal válida en horas.');
        return;
    }
    const newWeeklyGoalMinutes = newWeeklyGoalHours * 60; // Convert hours to minutes

    try {
        const response = await fetch('https://pomodoro-gamified.onrender.com/api/user/save-goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId, weekly_goal: newWeeklyGoalMinutes })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            // Update frontend immediately with data from backend
            weeklyStudyGoals = data.weekly_goal; // Use underscore naming
            totalPomodoroMinutes = data.total_pomodoro_minutes; // Use underscore naming (ensure this is updated from backend)
            userXp = data.xp; // Update XP
            updateProgressBar(); // Recalculate progress with new goal and total
            displayXp(); // Update XP display
        } else {
            throw new Error(data.message || 'Error al guardar objetivos.');
        }
    } catch (error) {
        console.error('Error al guardar objetivos:', error);
        alert('Error al guardar objetivos: ' + error.message);
    }
}

// NEW: Function to update the progress bar display
function updateProgressBar() {
    // MODIFICATION: totalDesiredMinutes is now directly from weeklyStudyGoals (which is in minutes)
    const totalDesiredMinutes = weeklyStudyGoals;

    totalDesiredTimeDisplay.textContent = totalDesiredMinutes;
    currentPomodoroTimeDisplay.textContent = totalPomodoroMinutes;

    let percentage = 0;
    if (totalDesiredMinutes > 0) {
        percentage = (totalPomodoroMinutes / totalDesiredMinutes) * 100;
    }
    percentage = Math.min(100, Math.max(0, percentage)); // Cap between 0 and 100

    progressBarFill.style.width = `${percentage}%`;
    progressPercentageValue.textContent = Math.round(percentage); // Display rounded percentage
}

// ======================================
// Event Listeners
// ======================================
playPauseButton.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

resetButton.addEventListener('click', resetTimer);

// NEW: Event listener for saving goals
saveGoalsBtn.addEventListener('click', saveWeeklyGoals);

// ======================================
// Initialization on page load
// ======================================
document.addEventListener('DOMContentLoaded', () => {
    const usuario = localStorage.getItem('usuario');
    loggedInUserId = localStorage.getItem('userId'); // Get userId from localStorage

    // Redirect if not logged in
    if (!usuario || !loggedInUserId) {
        alert('Tenés que iniciar sesión primero.');
        window.location.href = 'auth_interface.html';
        return; // Stop execution if not logged in
    }

    // Display user greeting
    if (greetingContainer) {
        greetingContainer.textContent = `Hola, ${usuario}!`;
    }

    // NEW: Fetch user data and update UI
    fetchUserData();
    updateDisplay(); // Initial display of timer
});

// Logout function (from original code, kept for completeness)
function logoutUsuario() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('userId'); // <-- Ensure this is present
    window.location.href = 'auth_interface.html'; // Redirect to auth_interface.html
}