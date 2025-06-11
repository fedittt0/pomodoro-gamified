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
async function handleTimerEnd() {
    pauseTimer();
    const completedMinutes = (currentMode === 'Pomodoro') ? pomodoroDuration / 60 : 0; // Only add if Pomodoro finished

    if (currentMode === 'Pomodoro') {
        pomodorosCompleted++;
        // NEW: Send completed Pomodoro time to backend
        if (loggedInUserId && completedMinutes > 0) {
            try {
                const response = await fetch('https://pomodoro-gamified.onrender.com/api/pomodoro/add-time', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: loggedInUserId, minutesToAdd: completedMinutes })
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log('Pomodoro time updated on backend:', data.totalPomodoroMinutes);
                    totalPomodoroMinutes = data.totalPomodoroMinutes; // Update local variable
                    updateProgressBar(); // Update progress bar after adding time
                } else {
                    console.error('Failed to update Pomodoro time on backend.');
                }
            } catch (error) {
                console.error('Error sending Pomodoro time to backend:', error);
            }
        }

        if (pomodorosCompleted % pomodorosUntilLongBreak === 0) {
            currentMode = 'Long Break';
            timer = longBreakDuration;
        } else {
            currentMode = 'Short Break';
            timer = shortBreakDuration;
        }
    } else {
        currentMode = 'Pomodoro';
        timer = pomodoroDuration;
    }
    updateDisplay();
    // Optional: Auto-start next mode, or wait for user input
    // startTimer();
}

// ======================================
// User Authentication & Data Management
// ======================================

// NEW: Function to fetch user data from backend
async function fetchUserData() {
    if (!loggedInUserId) {
        console.error('No user ID found for fetching data.');
        return;
    }
    try {
        const response = await fetch(`https://pomodoro-gamified.onrender.com/api/user/data?userId=${loggedInUserId}`);
        if (response.ok) {
            const data = await response.json();
            totalPomodoroMinutes = data.totalPomodoroMinutes;
            // MODIFICATION: Fetch single weeklyGoal from backend
            weeklyStudyGoals = data.weeklyGoal; // This is already in minutes from backend
            console.log('User data fetched:', { totalPomodoroMinutes, weeklyStudyGoals });
            updateProgressBar();
            populateGoalsInputs(); // Populate inputs after fetching
        } else {
            console.error('Failed to fetch user data:', response.statusText);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
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
async function saveWeeklyGoals() {
    const totalHours = parseInt(weeklyGoalInput.value) || 0; // Get value from single input

    if (!loggedInUserId) {
        alert('No se pudo guardar: Usuario no identificado.');
        return;
    }

    try {
        const response = await fetch('https://pomodoro-gamified.onrender.com/api/user/save-goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // MODIFICATION: Send totalHours to backend
            body: JSON.stringify({ userId: loggedInUserId, totalHours: totalHours })
        });
        if (response.ok) {
            const data = await response.json();
            // MODIFICATION: Update local weeklyStudyGoals (it's in minutes from backend)
            weeklyStudyGoals = data.weeklyGoal;
            alert('Objetivo semanal guardado con éxito!');
            updateProgressBar(); // Update progress bar after saving goals
        } else {
            alert('Error al guardar objetivos.');
            console.error('Failed to save goals:', response.statusText);
        }
    } catch (error) {
        alert('Error de conexión al guardar objetivos.');
        console.error('Error saving goals:', error);
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
    localStorage.removeItem('userId'); // Also remove userId on logout
    window.location.reload();
}