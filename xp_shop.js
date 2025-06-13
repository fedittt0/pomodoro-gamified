// xp_shop.js

const backendBaseUrl = 'https://pomodoro-gamified.onrender.com'; // Your backend URL
let loggedInUserId = null;
let xp = 0; // Current XP from user data

// DOM Elements for XP Shop
const xpBubble = document.getElementById('xp-bubble'); // From index.html, also used here
const greetingContainer = document.querySelector('.greeting-container'); // From index.html

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
    if (xpBubble) {
        xpBubble.textContent = `XP: ${xp}`;
    }
}

function showModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
    }
}

function hideModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

// --- API Calls ---

// Fetch user data (including XP)
async function fetchUserData() {
    loggedInUserId = localStorage.getItem('userId');
    if (!loggedInUserId) {
        console.error('No user ID found in localStorage.');
        window.location.href = 'auth_interface.html'; // Redirect to login
        return;
    }

    try {
        const response = await fetch(`${backendBaseUrl}/api/user/data?userId=${loggedInUserId}`);
        if (response.ok) {
            const data = await response.json();
            xp = data.xp;
            updateXPBubble(); // Update XP bubble on page load

            // Display user greeting
            const usuario = localStorage.getItem('usuario');
            if (greetingContainer && usuario) {
                greetingContainer.textContent = `Hola, ${usuario}!`;
            }
        } else {
            console.error('Failed to fetch user data:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}

// Fetch rewards from the backend
async function fetchRewards() {
    try {
        const response = await fetch(`${backendBaseUrl}/api/rewards`);
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
        alert('Por favor, ingresa un nombre y un costo válido para la recompensa.');
        return;
    }

    try {
        const response = await fetch(`${backendBaseUrl}/api/rewards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cost })
        });

        if (response.ok) {
            alert('Recompensa añadida con éxito!');
            rewardNameInput.value = '';
            rewardCostInput.value = '10'; // Reset to default
            hideModal(addRewardModal);
            fetchRewards(); // Refresh the list of rewards
        } else {
            const errorData = await response.json();
            alert('Error al añadir recompensa: ' + (errorData.message || 'Error desconocido.'));
        }
    } catch (error) {
        console.error('Error adding reward:', error);
        alert('Error al añadir recompensa. Intenta de nuevo.');
    }
}

// Purchase a reward
async function purchaseReward(rewardId, cost) {
    if (xp < cost) {
        alert('¡No tienes suficiente XP para comprar esta recompensa!');
        return;
    }

    if (!confirm(`¿Estás seguro de que quieres comprar esta recompensa por ${cost} XP?`)) {
        return;
    }

    try {
        const response = await fetch(`${backendBaseUrl}/api/user/purchase-reward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: loggedInUserId, rewardId, cost })
        });

        if (response.ok) {
            const data = await response.json();
            xp = data.newXp; // Update global XP
            updateXPBubble(); // Update XP bubble
            alert(`¡Recompensa comprada con éxito! Tu nuevo XP es: ${xp}`);
            // Optionally, you might want to hide/disable the purchased item
            // or refresh the rewards list if purchasing is a one-time thing.
            fetchRewards(); // Refresh rewards to update button states (disabled if not enough XP)
        } else {
            const errorData = await response.json();
            alert('Error al comprar recompensa: ' + (errorData.message || 'Error desconocido.'));
        }
    } catch (error) {
        console.error('Error purchasing reward:', error);
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
        buyButton.disabled = xp < reward.cost; // Disable if not enough XP
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
    await fetchUserData(); // Get current XP
    await fetchRewards(); // Load rewards
});

// Logout function (re-defined here for xp_shop.html, or could be in a shared script)
function logoutUsuario() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('userId');
    window.location.href = 'auth_interface.html';
}