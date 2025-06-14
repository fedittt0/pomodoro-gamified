// script.js

// Pomodoro timer settings (remain local to this script's scope for now)
const pomodoroDuration = 20 * 60; // 20 minutes
const shortBreakDuration = 5 * 60; // 5 minutes
const longBreakDuration = 10 * 60; // 10 minutes
const pomodorosUntilLongBreak = 4;

let timer = pomodoroDuration;
let timerInterval = null;
let isRunning = false;
let pomodorosCompleted = 0; // Pomodoros completed in current session (resets on page load)
let currentMode = 'Pomodoro'; // Modes: Pomodoro, Short Break, Long Break

// Global variables for user data and goals - now attached to window object
window.loggedInUserId = null;
window.totalPomodoroMinutes = 0; // Accumulated time from backend
window.weeklyStudyGoals = 0; // Total desired study time for the week in minutes
window.xp = 0; // User's XP

// Global variable for last reset date from backend - attached to window object
window.lastResetDate = null;

// Declare backendBaseUrl once globally accessible via window object
window.backendBaseUrl = 'https://pomodoro-gamified.onrender.com'; // IMPORTANT: Replace with your actual Render backend URL

// DOM Elements (Only those that might be present on ALL pages, or handled conditionally)
const xpBubble = document.getElementById('xp-bubble');
const greetingContainer = document.querySelector('.greeting-container');


// ======================================\
// Helper function to format time for display
// ======================================\
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// ======================================\
// Logout function (accessible globally)
// ======================================\
function logoutUsuario() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('userId'); // Also remove userId on logout
    window.location.href = 'auth_interface.html'; // Redirect to auth_interface.html
}


// ======================================\
// Functions specific to Pomodoro Timer page (index.html)
// These will only run if the relevant DOM elements exist.
// ======================================\
function initializePomodoroPage() {
    const timerDisplay = document.getElementById('timer-display');
    const modeLabel = document.getElementById('mode-label');
    const playPauseButton = document.getElementById('play-pause');
    const resetButton = document.getElementById('reset');
    const pomodoroCountDisplay = document.getElementById('pomodoro-count');
    const breakLabel = document.getElementById('break-label');
    const currentPomodoroTimeDisplay = document.getElementById('current-pomodoro-time');
    const totalDesiredTimeDisplay = document.getElementById('total-desired-time');
    const weeklyGoalInput = document.getElementById('weekly-goal'); // Assuming this is present on index.html
    const saveGoalsBtn = document.getElementById('save-goals-btn'); // Assuming this is present on index.html
    const weeklyGoalModal = document.getElementById('weeklyGoalModal');
    const modalCloseButton = document.querySelector('#weeklyGoalModal .close-button');
    const modalWeeklyGoalInput = document.getElementById('modal-weekly-goal-input');
    const saveModalGoalBtn = document.getElementById('save-modal-goal-btn');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressPercentageDisplay = document.getElementById('progress-percentage');
    const editGoalBtn = document.getElementById('edit-goal-btn'); // FIXED: Get the edit goal button

    // Only proceed if core Pomodoro elements exist
    if (timerDisplay && modeLabel && playPauseButton && resetButton) {

        // Function to update the main display elements
        function updateDisplay() {
            timerDisplay.textContent = formatTime(timer);
            modeLabel.textContent = currentMode;
        }

        // Function to switch between Pomodoro, Short Break, Long Break
        function switchMode() {
            if (currentMode === 'Pomodoro') {
                pomodorosCompleted++;
                if (pomodoroCountDisplay) {
                    pomodoroCountDisplay.textContent = pomodorosCompleted; // Update session count
                }

                // Add time to backend BEFORE switching mode visually
                addPomodoroTime(pomodoroDuration / 60);

                if (pomodorosCompleted % pomodorosUntilLongBreak === 0 && pomodorosCompleted > 0) {
                    currentMode = 'Long Break';
                    timer = longBreakDuration;
                    if (breakLabel) breakLabel.textContent = '¡Descanso Largo!';
                    document.body.style.backgroundColor = '#f9fff9'; // Soft green from new CSS
                } else {
                    currentMode = 'Short Break';
                    timer = shortBreakDuration;
                    if (breakLabel) breakLabel.textContent = 'Descanso Corto';
                    document.body.style.backgroundColor = '#fff9f9'; // Soft red from new CSS
                }
            } else { // If currentMode was a break (Short Break or Long Break)
                currentMode = 'Pomodoro';
                timer = pomodoroDuration;
                if (breakLabel) breakLabel.textContent = ''; // Clear break label
                document.body.style.backgroundColor = ''; // Reset background to primary from CSS
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
                    // IMPORTANT: Replace alert() with a custom modal here for better UX
                    console.log('¡Tiempo terminado!'); // Log instead of alert
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
                const response = await fetch(`${window.backendBaseUrl}/api/pomodoro/add-time`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: window.loggedInUserId, minutes: minutes })
                });

                if (response.ok) {
                    const data = await response.json();
                    window.totalPomodoroMinutes = data.total_pomodoro_minutes;
                    window.weeklyStudyGoals = data.weekly_goal;
                    window.xp = data.xp; // Update global XP from response
                    updateProgressBar(); // Update progress bar after adding time
                    console.log('Tiempo de Pomodoro y XP agregados con éxito:', data);
                    updateXPBubble(); // Ensure XP bubble is updated here too
                } else {
                    console.error('Error al agregar tiempo de Pomodoro:', response.status, response.statusText);
                }
            } catch (error) {
                console.error('Error al comunicarse con la API para agregar tiempo:', error);
            }
        }

        // Fetch user data from the backend (shared function, but specific updates here)
        // This function is now only responsible for updating Pomodoro page specific elements
        // Global data update is handled by fetchUserDataCommon()
        async function fetchUserDataAndSetupPage() {
            // Data is already fetched by fetchUserDataCommon()
            // We just need to update the local display elements
            if (currentPomodoroTimeDisplay) {
                currentPomodoroTimeDisplay.textContent = `${window.totalPomodoroMinutes} minutos`;
            }
            if (totalDesiredTimeDisplay) {
                totalDesiredTimeDisplay.textContent = `${window.weeklyStudyGoals} minutos`;
            }
            // xpBubble update is in fetchUserDataCommon()
            
            updateProgressBar();
            if (modalWeeklyGoalInput) {
                modalWeeklyGoalInput.value = (window.weeklyStudyGoals / 60).toFixed(0);
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
                // IMPORTANT: Replace alert() with a custom modal
                alert('Por favor, ingresa un número válido para la meta semanal.');
                return;
            }

            const minutes = hours * 60; // Convert hours to minutes

            try {
                const response = await fetch(`${window.backendBaseUrl}/api/user/save-goals`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: window.loggedInUserId, weekly_goal: minutes })
                });

                if (response.ok) {
                    const data = await response.json();
                    // IMPORTANT: Replace alert() with a custom modal
                    alert(data.mensaje);
                    window.weeklyStudyGoals = data.weekly_goal; // Update global variable with saved goal
                    window.totalPomodoroMinutes = data.total_pomodoro_minutes; // Update total minutes (might have been reset by backend)
                    window.xp = data.xp; // Update global XP

                    updateProgressBar(); // Update progress bar display
                    // Ensure the main page input also reflects the newly set goal
                    if (weeklyGoalInput) {
                        weeklyGoalInput.value = (window.weeklyStudyGoals / 60).toFixed(0);
                    }

                    if (inputSource === 'save-modal-goal-btn') {
                        hideGoalModal(); // Hide modal if saved from there
                    }
                    updateXPBubble(); // Ensure XP bubble is updated here too
                } else {
                    const errorData = await response.json();
                    // IMPORTANT: Replace alert() with a custom modal
                    alert('Error al guardar objetivo: ' + (errorData.mensaje || 'Error desconocido.'));
                }
            } catch (error) {
                console.error('Error saving weekly goals:', error);
                // IMPORTANT: Replace alert() with a custom modal
                alert('Error al guardar objetivo. Intenta de nuevo.');
            }
        }

        // Function to update the progress bar
        function updateProgressBar() {
            console.log('--- updateProgressBar called ---');
            console.log('global totalPomodoroMinutes:', window.totalPomodoroMinutes);
            console.log('global weeklyStudyGoals:', window.weeklyStudyGoals);
            console.log('progressBarFill element (should NOT be null):', progressBarFill);
            console.log('progressPercentageDisplay element (should NOT be null):', progressPercentageDisplay);

            let percentage = 0;
            let goalHours = (window.weeklyStudyGoals / 60);
            let currentHours = (window.totalPomodoroMinutes / 60);

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
            if (progressPercentageDisplay) {
                progressPercentageDisplay.textContent = `${currentHours.toFixed(1)} / ${goalHours.toFixed(1)} horas`;
                console.log('Setting progressPercentageDisplay content to:', `${currentHours.toFixed(1)} / ${goalHours.toFixed(1)} horas`);
            } else {
                console.error('ERROR: progressPercentageDisplay element not found in DOM!');
            }
        }

        // Function to check if today is Monday
        function isMonday() {
            const today = new Date();
            return today.getDay() === 1; // Monday is 1 (Sunday is 0)
        }

        // Functions to show/hide the weekly goal modal
        function showGoalModal() {
            if (weeklyGoalModal && modalWeeklyGoalInput) {
                // Set the input value to the current weekly goal (or 0 if not set)
                modalWeeklyGoalInput.value = (window.weeklyStudyGoals / 60).toFixed(0);
                weeklyGoalModal.style.display = 'flex'; // Use flex to center
                // Add show class for modal animation
                setTimeout(() => weeklyGoalModal.classList.add('show'), 10); // Small delay to allow display to apply
            }
        }

        function hideGoalModal() {
            if (weeklyGoalModal) {
                weeklyGoalModal.classList.remove('show');
                // Hide modal after animation completes
                setTimeout(() => {
                    weeklyGoalModal.style.display = 'none';
                }, 300); // Match CSS transition duration
            }
        }

        // ======================================\
        // Event Listeners (Pomodoro specific)
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
        if (saveGoalsBtn) {
            saveGoalsBtn.addEventListener('click', saveWeeklyGoals);
        }

        // Event listener for opening the weekly goal modal FIXED
        if (editGoalBtn) {
            editGoalBtn.addEventListener('click', showGoalModal);
        }

        // Event listener for saving goals from the modal
        if (saveModalGoalBtn) {
            saveModalGoalBtn.addEventListener('click', saveWeeklyGoals);
        }

        // Event listeners for closing the modal
        if (modalCloseButton) {
            modalCloseButton.addEventListener('click', hideGoalModal);
        }
        if (weeklyGoalModal) {
            weeklyGoalModal.addEventListener('click', (event) => {
                if (event.target === weeklyGoalModal) { // Close if clicked on backdrop
                    hideGoalModal();
                }
            });
        }

        // Initial display of timer (Pomodoro 20:00)
        updateDisplay();

        // Logic to display weekly goal modal on Monday ONLY if weeklyStudyGoals is 0
        // and if it's the Pomodoro page
        if (isMonday() && window.weeklyStudyGoals === 0 && weeklyGoalModal) {
            showGoalModal();
        }
        
        // Initial setup of Pomodoro page specific user data
        fetchUserDataAndSetupPage();
    }
}


// ======================================\
// Initialization on page load (Global)
// This runs on ALL pages where script.js is loaded
// ======================================\
document.addEventListener('DOMContentLoaded', async () => {
    window.loggedInUserId = localStorage.getItem('userId');
    const usuario = localStorage.getItem('usuario');

    // Debugging for redirection
    console.log('DOMContentLoaded: Checking login status.');
    console.log('Usuario:', usuario, 'UserID:', window.loggedInUserId);

    // Redirect if not logged in (applies to both index.html and xp_shop.html)
    if (!usuario || !window.loggedInUserId) {
        console.warn('User not logged in or session expired. Redirecting to auth page.');
        // IMPORTANT: Replace alert() with a custom modal for better UX
        alert('Tenés que iniciar sesión primero.');
        window.location.href = 'auth_interface.html'; // Assuming auth_interface.html is your login page
        return; // Stop execution if not logged in
    }

    // Display user greeting (present on both pages)
    if (greetingContainer) {
        greetingContainer.textContent = `Hola, ${usuario}!`;
    }

    // Always fetch user data to update XP bubble and check login status
    await fetchUserDataCommon(); // Use a common fetch function

    // Determine if it's the Pomodoro page and initialize its specific features
    if (document.getElementById('timer-display')) { // Check for a unique element on index.html
        initializePomodoroPage();
    }
    // xp_shop.js will handle its own page-specific initialization after this script runs
});


// Common function to fetch user data, used by both script.js (index.html) and xp_shop.js
// This avoids code duplication and ensures XP bubble is updated correctly.
async function fetchUserDataCommon() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        console.error('No user ID found in localStorage for common fetch.');
        return null; // Return null if no userId
    }

    try {
        const response = await fetch(`${window.backendBaseUrl}/api/user/data?userId=${userId}`);
        if (response.ok) {
            const data = await response.json();
            window.xp = data.xp; // Update global XP
            window.totalPomodoroMinutes = data.total_pomodoro_minutes; // Also update for index.html
            window.weeklyStudyGoals = data.weekly_goal; // Also update for index.html
            window.lastResetDate = new Date(data.last_reset_date); // Also update for index.html

            if (xpBubble) {
                xpBubble.textContent = `XP: ${window.xp}`;
            }
            console.log('fetchUserDataCommon: User data fetched successfully.');
            return data; // Return data for page-specific use
        } else {
            console.error('Failed to fetch user data in common fetch:', response.status, response.statusText);
            // If fetching fails, clear local storage and redirect to login, as data is inconsistent
            if (response.status === 404 || response.status === 401) {
                console.warn('User data fetch failed with 401/404. Clearing session and redirecting.');
                localStorage.removeItem('usuario');
                localStorage.removeItem('userId');
                alert('Tu sesión ha expirado o es inválida. Inicia sesión de nuevo.'); // Inform user
                window.location.href = 'auth_interface.html';
            }
        }
    } catch (error) {
        console.error('Error fetching user data in common fetch:', error);
        // Catch network errors etc. and potentially redirect
        alert('Error de conexión al servidor. Por favor, intenta de nuevo.'); // Inform user
        localStorage.removeItem('usuario'); // Clear session on network error too
        localStorage.removeItem('userId');
        window.location.href = 'auth_interface.html';
    }
    return null;
}
