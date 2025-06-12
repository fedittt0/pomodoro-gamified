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
let weeklyStudyGoals = 0; // Total desired study time for the week in minutes
let xp = 0; // User's XP

// Global variable for last reset date from backend
let lastResetDate = null;

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const modeLabel = document.getElementById('mode-label');
const playPauseButton = document.getElementById('play-pause');
const resetButton = document.getElementById('reset');
const pomodoroCountDisplay = document.getElementById('pomodoro-count');
const breakLabel = document.getElementById('break-label'); // NEW: Reference for the break label
const xpBubble = document.getElementById('xp-bubble');
const currentPomodoroTimeDisplay = document.getElementById('current-pomodoro-time');
const totalDesiredTimeDisplay = document.getElementById('total-desired-time');

// New DOM Elements for Study Goals & Progress
const greetingContainer = document.querySelector('.greeting-container');
const weeklyGoalInput = document.getElementById('weekly-goal'); // Main page goal input
const saveGoalsBtn = document.getElementById('save-goals-btn'); // Main page save button

// DOM Elements for Weekly Goal Modal
const weeklyGoalModal = document.getElementById('weeklyGoalModal');
const modalCloseButton = document.querySelector('#weeklyGoalModal .close-button');
const modalWeeklyGoalInput = document.getElementById('modal-weekly-goal-input');
const saveModalGoalBtn = document.getElementById('save-modal-goal-btn');

// Progress bar elements
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercentageDisplay = document.getElementById('progress-percentage');
const progressTextDisplay = document.getElementById('progress-text');


// Helper function to format time for display
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Function to update the main display elements
function updateDisplay() {
    timerDisplay.textContent = formatTime(timer);
    modeLabel.textContent = currentMode;
}

// Function to switch between Pomodoro, Short Break, Long Break
function switchMode() {
    if (currentMode === 'Pomodoro') {
        pomodorosCompleted++;
        pomodoroCountDisplay.textContent = pomodorosCompleted; // Update session count

        // Add time to backend BEFORE switching mode visually
        addPomodoroTime(pomodoroDuration / 60);

        if (pomodorosCompleted % pomodorosUntilLongBreak === 0 && pomodorosCompleted > 0) {
            currentMode = 'Long Break';
            timer = longBreakDuration;
            if (breakLabel) breakLabel.textContent = '¡Descanso Largo!';
            document.body.style.backgroundColor = '#d4edda'; // Example: green for long break
        } else {
            currentMode = 'Short Break';
            timer = shortBreakDuration;
            if (breakLabel) breakLabel.textContent = 'Descanso Corto';
            document.body.style.backgroundColor = '#f8d7da'; // Example: red for short break
        }
    } else { // If currentMode was a break (Short Break or Long Break)
        currentMode = 'Pomodoro';
        timer = pomodoroDuration;
        if (breakLabel) breakLabel.textContent = ''; // Clear break label
        document.body.style.backgroundColor = ''; // Reset background
    }
    updateDisplay(); // Update display with new mode and timer
}

// Start the timer
function startTimer() {
    if (isRunning) return; // Prevent multiple intervals
    isRunning = true;
    playPauseButton.textContent = 'Pausar';
    timerInterval = setInterval(() => {
        timer--;
        updateDisplay();
        if (timer <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            playPauseButton.textContent = 'Iniciar'; // Reset button text
            alert('¡Tiempo terminado!'); // Simple alert for now
            switchMode(); // This will set the new timer and mode
            startTimer(); // Auto-start the new mode (break or next pomodoro)
        }
    }, 1000);
}

// Pause the timer
function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    playPauseButton.textContent = 'Iniciar';
}

// Reset the timer to current mode's default duration
function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    playPauseButton.textContent = 'Iniciar';
    if (currentMode === 'Pomodoro') {
        timer = pomodoroDuration;
    } else if (currentMode === 'Short Break') {
        timer = shortBreakDuration;
    } else { // Long Break
        timer = longBreakDuration;
    }
    updateDisplay();
}

// Function to send Pomodoro time to the backend
async function addPomodoroTime(minutes) {
    try {
        const response = await fetch(`${backendBaseUrl}/api/pomodoro/add-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loggedInUserId, minutes: minutes })
        });

        if (response.ok) {
            const data = await response.json();
            totalPomodoroMinutes = data.total_pomodoro_minutes;
            weeklyStudyGoals = data.weekly_goal;
            xp = data.xp; // Update global XP from response
            updateProgressBar(); // Update progress bar after adding time
            console.log('Tiempo de Pomodoro y XP agregados con éxito:', data);
        } else {
            console.error('Error al agregar tiempo de Pomodoro:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error al comunicarse con la API para agregar tiempo:', error);
    }
}

// Fetch user data from the backend
async function fetchUserData() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        console.error('No user ID found in localStorage.');
        return;
    }

    try {
        const response = await fetch(`${backendBaseUrl}/api/user/data?userId=${userId}`);
        if (response.ok) {
            const data = await response.json();
            totalPomodoroMinutes = data.total_pomodoro_minutes;
            weeklyStudyGoals = data.weekly_goal;
            xp = data.xp; // Ensure XP is being updated
            lastResetDate = new Date(data.last_reset_date); // Store last reset date as Date object

            // IMPORTANT: Update display elements with fetched data
            if (currentPomodoroTimeDisplay) {
                currentPomodoroTimeDisplay.textContent = `${totalPomodoroMinutes} minutos`;
            }
            if (totalDesiredTimeDisplay) {
                totalDesiredTimeDisplay.textContent = `${weeklyStudyGoals} minutos`;
            }
            if (xpBubble) {
                xpBubble.textContent = `XP: ${xp}`;
            }

            updateProgressBar(); // Update progress bar with fetched data
            // Assuming weeklyGoalInput is for a form field, update it too
            // If the modal-weekly-goal-input exists and you want to show it on load:
            const modalWeeklyGoalInput = document.getElementById('modal-weekly-goal-input');
            if (modalWeeklyGoalInput) {
                modalWeeklyGoalInput.value = (weeklyStudyGoals / 60).toFixed(0); // Set modal input field in hours
            }

        } else {
            console.error('Failed to fetch user data:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}

// saveWeeklyGoals to handle input from main page or modal
async function saveWeeklyGoals(event) {
    let inputSource;
    if (event && event.target && (event.target.id === 'save-goals-btn' || event.target.id === 'save-modal-goal-btn')) {
        inputSource = event.target.id;
    } else {
        inputSource = 'main-page';
    }

    const currentWeeklyGoalInput = (inputSource === 'save-modal-goal-btn') ? modalWeeklyGoalInput : weeklyGoalInput;
    const hours = parseFloat(currentWeeklyGoalInput.value);

    if (isNaN(hours) || hours < 0) {
        alert('Por favor, ingresa un número válido para la meta semanal.');
        return;
    }

    const minutes = hours * 60; // Convert hours to minutes

    try {
        const response = await fetch(`${backendBaseUrl}/api/user/save-goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loggedInUserId, weekly_goal: minutes })
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.mensaje);
            weeklyStudyGoals = data.weekly_goal; // Update global variable with saved goal
            totalPomodoroMinutes = data.total_pomodoro_minutes; // Update total minutes (might have been reset by backend)
            xp = data.xp; // Update XP

            updateProgressBar(); // Update progress bar display
            // Ensure the main page input also reflects the newly set goal
            weeklyGoalInput.value = (weeklyStudyGoals / 60).toFixed(0); 

            if (inputSource === 'save-modal-goal-btn') {
                hideGoalModal(); // Hide modal if saved from there
            }
        } else {
            const errorData = await response.json();
            alert('Error al guardar objetivo: ' + (errorData.mensaje || 'Error desconocido.'));
        }
    } catch (error) {
        console.error('Error saving weekly goals:', error);
        alert('Error al guardar objetivo. Intenta de nuevo.');
    }
}

// Function to update the progress bar
function updateProgressBar() {
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressBarText = document.getElementById('progress-bar-text');

    console.log('--- updateProgressBar called ---');
    console.log('global totalPomodoroMinutes:', totalPomodoroMinutes);
    console.log('global weeklyStudyGoals:', weeklyStudyGoals);
    console.log('progressBarFill element (should NOT be null):', progressBarFill);
    console.log('progressBarText element (should NOT be null):', progressBarText);

    let percentage = 0;
    let goalHours = (weeklyStudyGoals / 60);
    let currentHours = (totalPomodoroMinutes / 60);

    if (goalHours > 0) {
        percentage = (currentHours / goalHours) * 100;
        if (percentage > 100) percentage = 100; // Cap at 100%
    }

    console.log('Calculated currentHours:', currentHours);
    console.log('Calculated goalHours:', goalHours);
    console.log('Calculated percentage:', percentage);


    // Update the width of the fill bar
    if (progressBarFill) {
        progressBarFill.style.width = `${percentage.toFixed(1)}%`;
        console.log('Setting progressBarFill width to:', `${percentage.toFixed(1)}%`);
    } else {
        console.error('ERROR: progressBarFill element not found in DOM!');
    }

    // Update the text display
    if (progressBarText) {
        progressBarText.textContent = `${currentHours.toFixed(1)} / ${goalHours.toFixed(1)} horas`;
        console.log('Setting progressBarText content to:', `${currentHours.toFixed(1)} / ${goalHours.toFixed(1)} horas`);
    } else {
        console.error('ERROR: progressBarText element not found in DOM!');
    }

    // Update XP bubble
    if (xpBubble) { // Make sure xpBubble is defined globally too, or define it here
        xpBubble.textContent = `XP: ${xp}`;
        console.log('Setting xpBubble content to:', `XP: ${xp}`);
    }
}

// Function to check if today is Monday
function isMonday() {
    const today = new Date();
    return today.getDay() === 1; // Monday is 1 (Sunday is 0)
}

// Functions to show/hide the weekly goal modal
function showGoalModal() {
    if (weeklyGoalModal) {
        // Set the input value to the current weekly goal (or 0 if not set)
        modalWeeklyGoalInput.value = (weeklyStudyGoals / 60).toFixed(0);
        weeklyGoalModal.style.display = 'flex'; // Use flex to center
    }
}

function hideGoalModal() {
    if (weeklyGoalModal) {
        weeklyGoalModal.style.display = 'none';
    }
}

// ======================================\
// Event Listeners
// ======================================\
playPauseButton.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
});

resetButton.addEventListener('click', resetTimer);

// Event listener for saving goals from the main page input
saveGoalsBtn.addEventListener('click', saveWeeklyGoals);

// Event listener for saving goals from the modal
saveModalGoalBtn.addEventListener('click', saveWeeklyGoals);

// Event listeners for closing the modal
modalCloseButton.addEventListener('click', hideGoalModal);
weeklyGoalModal.addEventListener('click', (event) => {
    if (event.target === weeklyGoalModal) { // Close if clicked on backdrop
        hideGoalModal();
    }
});


// ======================================\
// Initialization on page load
// ======================================\
const backendBaseUrl = 'https://pomodoro-gamified.onrender.com'; // IMPORTANT: Replace with your actual Render backend URL

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = localStorage.getItem('usuario');
    loggedInUserId = localStorage.getItem('userId');

    // Redirect if not logged in
    if (!usuario || !loggedInUserId) {
        alert('Tenés que iniciar sesión primero.');
        window.location.href = 'auth_interface.html'; // Assuming auth_interface.html is your login page
        return; // Stop execution if not logged in
    }

    // Display user greeting
    if (greetingContainer) {
        greetingContainer.textContent = `Hola, ${usuario}!`;
    }

    await fetchUserData(); // Wait for user data to be fetched first

    // Logic to display weekly goal modal on Monday ONLY if weeklyStudyGoals is 0
    if (isMonday() && weeklyStudyGoals === 0) {
        showGoalModal();
    }

    updateDisplay(); // Initial display of timer (Pomodoro 20:00)
});

// Logout function
function logoutUsuario() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('userId'); // Also remove userId on logout
    window.location.href = 'auth_interface.html'; // Redirect to auth_interface.html
}