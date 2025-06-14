// xp_shop.js

// No local const/let for backendBaseUrl, loggedInUserId, xp, totalPomodoroMinutes, weeklyStudyGoals, lastResetDate.
// These are all made global on the 'window' object by script.js, which is loaded before this file.
// We also removed the local DOM element const declarations as they can be accessed directly.

const addRewardButton = document.getElementById('add-reward-button');
const rewardsContainer = document.getElementById('rewards-container');

// Add Reward Modal Elements
const addRewardModal = document.getElementById('addRewardModal');
const modalCloseButton = document.querySelector('#addRewardModal .close-button');
const rewardNameInput = document.getElementById('reward-name-input');
const rewardCostInput = document.getElementById('reward-cost-input');
const add10XpButton = document.getElementById('add-10-xp-btn');
const saveRewardButton = document.getElementById('save-reward-btn');

// --- Helper Functions ---
function updateXPBubble() {
    // Access window.xp directly and get the xpBubble DOM element directly
    const xpBubbleElement = document.getElementById('xp-bubble');
    if (xpBubbleElement && typeof window.xp !== 'undefined') {
        xpBubbleElement.textContent = `XP: ${window.xp}`;
    }
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        // modalElement.classList.add('show'); // If you add CSS animation for this class
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        // modalElement.classList.remove('show'); // If you add CSS animation for this class
    }
}

// --- API Calls ---

// Fetch user data (including XP) - this function now relies on the common
// fetchUserDataCommon from script.js to populate global window.xp and window.loggedInUserId.
async function fetchUserData() {
    // window.loggedInUserId is set by script.js's DOMContentLoaded, which runs first.
    if (!window.loggedInUserId) {
        console.error('No user ID found in localStorage.');
        window.location.href = 'auth_interface.html'; // Redirect to login
        return;
    }

    try {
        const data = await window.fetchUserDataCommon(); // Use the common function from script.js
        if (data) {
            // window.xp is already updated by fetchUserDataCommon.
            updateXPBubble(); // Update XP bubble using the globally updated window.xp

            // Display user greeting
            const greetingContainerElement = document.querySelector('.greeting-container'); // Get element directly
            const usuario = localStorage.getItem('usuario');
            if (greetingContainerElement && usuario) {
                greetingContainerElement.textContent = `Hola, ${usuario}!`;
            }
        }
    } catch (error) {
        console.error('Error fetching user data in xp_shop:', error);
    }
}

// Fetch rewards from the backend
async function fetchRewards() {
    try {
        // Use window.backendBaseUrl to access the globally declared backend URL
        const response = await fetch(`${window.backendBaseUrl}/api/rewards`);
        if (response.ok) {
            const rewards = await response.json();
            displayRewards(rewards);
        } else {
            console.error('Failed to fetch rewards:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error fetching rewards:', error);
    }
}

// Add a new reward to the backend
async function addReward() {
    const name = rewardNameInput.value.trim();
    const cost = parseInt(rewardCostInput.value);

    if (!name || isNaN(cost) || cost <= 0) {
        // IMPORTANT: Replace alert() with a custom modal here
        alert('Por favor, ingresa un nombre y un costo válido para la recompensa.');
        return;
    }

    try {
        // Use window.backendBaseUrl to access the globally declared backend URL
        const response = await fetch(`${window.backendBaseUrl}/api/rewards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cost })
        });

        if (response.ok) {
            // IMPORTANT: Replace alert() with a custom modal here
            alert('Recompensa añadida con éxito!');
            rewardNameInput.value = '';
            rewardCostInput.value = '10'; // Reset to default
            hideModal(addRewardModal);
            fetchRewards(); // Refresh the list of rewards
        } else {
            const errorData = await response.json();
            // IMPORTANT: Replace alert() with a custom modal here
            alert('Error al añadir recompensa: ' + (errorData.message || 'Error desconocido.'));
        }
    } catch (error) {
        console.error('Error adding reward:', error);
        // IMPORTANT: Replace alert() with a custom modal here
        alert('Error al añadir recompensa. Intenta de nuevo.');
    }
}

// Purchase a reward
async function purchaseReward(rewardId, cost) {
    // Access window.xp directly as it's now a global variable
    if (typeof window.xp === 'undefined' || window.xp < cost) {
        // IMPORTANT: Replace alert() with a custom modal here
        alert('¡No tienes suficiente XP para comprar esta recompensa!');
        return;
    }

    // IMPORTANT: Replace confirm() with a custom modal for better UX and consistency
    if (!confirm(`¿Estás seguro de que quieres comprar esta recompensa por ${cost} XP?`)) {
        return;
    }

    try {
        // Use window.backendBaseUrl and window.loggedInUserId to access global variables
        const response = await fetch(`${window.backendBaseUrl}/api/user/purchase-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: window.loggedInUserId, rewardId, cost })
        });

        if (response.ok) {
            const data = await response.json();
            window.xp = data.newXp; // Update global XP
            updateXPBubble(); // Update XP bubble using the globally updated window.xp
            // IMPORTANT: Replace alert() with a custom modal here
            alert(`¡Recompensa comprada con éxito! Tu nuevo XP es: ${window.xp}`);
            fetchRewards(); // Refresh rewards to update button states (disabled if not enough XP)
        } else {
            const errorData = await response.json();
            // IMPORTANT: Replace alert() with a custom modal here
            alert('Error al comprar recompensa: ' + (errorData.message || 'Error desconocido.'));
        }
    } catch (error) {
        console.error('Error purchasing reward:', error);
        // IMPORTANT: Replace alert() with a custom modal here
        alert('Error al comprar recompensa. Intenta de nuevo.');
    }
}


// --- DOM Manipulation ---

// Display rewards in the container
function displayRewards(rewards) {
    rewardsContainer.innerHTML = ''; // Clear previous rewards
    if (rewards.length === 0) {
        rewardsContainer.innerHTML = '<p>No hay recompensas disponibles aún. ¡Añade algunas!</p>';
        return;
    }

    rewards.forEach(reward => {
        const rewardItem = document.createElement('div');
        rewardItem.classList.add('reward-item');
        rewardItem.dataset.rewardId = reward._id; // Store reward ID

        const rewardName = document.createElement('span');
        rewardName.classList.add('reward-name');
        rewardName.textContent = reward.name;

        const rewardCost = document.createElement('span');
        rewardCost.classList.add('reward-cost');
        rewardCost.textContent = `${reward.cost} XP`;

        const buyButton = document.createElement('button');
        buyButton.classList.add('buy-reward-btn');
        buyButton.textContent = 'Comprar';
        // Access window.xp directly as it's now a global variable
        buyButton.disabled = (typeof window.xp === 'undefined' || window.xp < reward.cost); // Disable if not enough XP
        buyButton.addEventListener('click', () => purchaseReward(reward._id, reward.cost));

        rewardItem.appendChild(rewardName);
        rewardItem.appendChild(rewardCost);
        rewardItem.appendChild(buyButton);

        rewardsContainer.appendChild(rewardItem);
    });
}


// --- Event Listeners ---
addRewardButton.addEventListener('click', () => showModal(addRewardModal));
modalCloseButton.addEventListener('click', () => hideModal(addRewardModal));
addRewardModal.addEventListener('click', (event) => {
    if (event.target === addRewardModal) { // Close if clicked on backdrop
        hideModal(addRewardModal);
    }
});

add10XpButton.addEventListener('click', () => {
    let currentCost = parseInt(rewardCostInput.value);
    if (isNaN(currentCost)) currentCost = 0;
    rewardCostInput.value = currentCost + 10;
});

saveRewardButton.addEventListener('click', addReward);


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Call fetchUserData and fetchRewards, which now correctly use the global variables.
    // fetchUserData now calls window.fetchUserDataCommon internally, which populates window.xp.
    await fetchUserData(); // This ensures window.loggedInUserId and window.xp are populated.
    await fetchRewards(); // This uses window.xp to enable/disable buy buttons.
});

// REMOVED: Duplicative logoutUsuario function. It's already defined in script.js and loaded before this script.
