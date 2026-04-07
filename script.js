// JSONBin.io configuration
const JSONBIN_CONFIG = {
    binId: '69d51134856a6821890a37c8', // Replace with your actual bin ID
    apiKey: '$2a$10$7RKHOZacvPLaz5YLJReSj.uCgoukwtVUtA3jcmlbX9j.FC2u4D2dq', // Replace with your actual API key
    baseUrl: 'https://api.jsonbin.io/v3'
};

// Initialize vote data structure
let pollData = {
    1: {
        morning: 0,
        afternoon: 0,
        evening: 0
    },
    2: {
        speed: 0,
        quality: 0,
        communication: 0,
        pricing: 0
    },
    3: {
        'very-satisfied': 0,
        'satisfied': 0,
        'neutral': 0,
        'dissatisfied': 0,
        'very-dissatisfied': 0
    }
};

// Show loading indicator
function showLoading(show = true) {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <strong>Error:</strong> ${message}
        <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>
    `;
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('main'));
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Load data from JSONBin.io
async function loadDataFromServer() {
    try {
        showLoading(true);
        
        const response = await fetch(`${JSONBIN_CONFIG.baseUrl}/b/${JSONBIN_CONFIG.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.apiKey,
                'X-Bin-Meta': 'false'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        pollData = data;
        console.log('Data loaded from server:', pollData);
        
    } catch (error) {
        console.error('Error loading data from server:', error);
        showError('Failed to load voting data. Using local data instead.');
        
        // Fallback to localStorage
        const savedData = localStorage.getItem('pollData');
        if (savedData) {
            pollData = JSON.parse(savedData);
        }
    } finally {
        showLoading(false);
    }
}

// Save data to JSONBin.io
async function saveDataToServer() {
    try {
        showLoading(true);
        
        const response = await fetch(`${JSONBIN_CONFIG.baseUrl}/b/${JSONBIN_CONFIG.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_CONFIG.apiKey
            },
            body: JSON.stringify(pollData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Data saved to server:', result);
        
        // Also save locally as backup
        localStorage.setItem('pollData', JSON.stringify(pollData));
        
    } catch (error) {
        console.error('Error saving data to server:', error);
        showError('Failed to save vote to server. Your vote has been saved locally.');
        
        // Fallback to localStorage
        localStorage.setItem('pollData', JSON.stringify(pollData));
    } finally {
        showLoading(false);
    }
}

// Check if user has already voted for a specific poll
function hasVoted(pollId) {
    return localStorage.getItem(`voted_${pollId}`) === 'true';
}

// Mark user as voted for a specific poll
function markAsVoted(pollId) {
    localStorage.setItem(`voted_${pollId}`, 'true');
}

// Calculate total votes for a poll
function getTotalVotes(pollId) {
    return Object.values(pollData[pollId]).reduce((sum, votes) => sum + votes, 0);
}

// Update results display
function updateResults(pollId) {
    const resultsDiv = document.getElementById(`results-${pollId}`);
    const totalVotes = getTotalVotes(pollId);
    
    // Update total votes display
    document.getElementById(`total-${pollId}`).textContent = totalVotes;
    
    // Update each option's percentage and progress bar
    Object.keys(pollData[pollId]).forEach(option => {
        const votes = pollData[pollId][option];
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        
        const progressBar = resultsDiv.querySelector(`[data-option="${option}"].progress`);
        const percentageSpan = resultsDiv.querySelector(`[data-option="${option}"].percentage`);
        
        if (progressBar && percentageSpan) {
            progressBar.style.width = `${percentage}%`;
            percentageSpan.textContent = `${percentage}% (${votes} votes)`;
        }
    });
    
    // Show results
    resultsDiv.style.display = 'block';
}

// Handle form submission
async function handleVote(event) {
    event.preventDefault();
    
    const form = event.target;
    const pollId = form.dataset.poll;
    const formData = new FormData(form);
    const selectedOption = formData.get(`poll${pollId}`);
    
    if (!selectedOption) {
        alert('Please select an option before voting.');
        return;
    }
    
    if (hasVoted(pollId)) {
        alert('You have already voted on this poll.');
        return;
    }
    
    // Disable form immediately to prevent double-clicking
    const inputs = form.querySelectorAll('input');
    const button = form.querySelector('button');
    inputs.forEach(input => input.disabled = true);
    button.disabled = true;
    button.textContent = 'Submitting...';
    
    try {
        // Record the vote
        pollData[pollId][selectedOption]++;
        
        // Save to server
        await saveDataToServer();
        
        // Mark user as voted
        markAsVoted(pollId);
        
        // Update button text
        button.textContent = 'Voted!';
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Thank you for your vote! Results updated.';
        form.parentNode.insertBefore(successMessage, form);
        
        // Update and show results
        updateResults(pollId);
        
        // Remove success message after 3 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
        
    } catch (error) {
        console.error('Error submitting vote:', error);
        
        // Re-enable form on error
        inputs.forEach(input => input.disabled = false);
        button.disabled = false;
        button.textContent = 'Vote';
        
        // Revert the vote count
        pollData[pollId][selectedOption]--;
        
        showError('Failed to submit your vote. Please try again.');
    }
}

// Refresh results from server
async function refreshResults() {
    await loadDataFromServer();
    
    // Update all visible results
    Object.keys(pollData).forEach(pollId => {
        const resultsDiv = document.getElementById(`results-${pollId}`);
        if (resultsDiv.style.display !== 'none') {
            updateResults(pollId);
        }
    });
    
    // Show success message
    const refreshMessage = document.createElement('div');
    refreshMessage.className = 'success-message';
    refreshMessage.textContent = 'Results refreshed!';
    refreshMessage.style.position = 'fixed';
    refreshMessage.style.top = '20px';
    refreshMessage.style.right = '20px';
    refreshMessage.style.zIndex = '1000';
    document.body.appendChild(refreshMessage);
    
    setTimeout(() => {
        refreshMessage.remove();
    }, 2000);
}

// Initialize the application
async function init() {
    // Load data from server first
    await loadDataFromServer();
    
    // Add event listeners to all forms
    document.querySelectorAll('.poll-form').forEach(form => {
        const pollId = form.dataset.poll;
        
        form.addEventListener('submit', handleVote);
        
        // Check if user has already voted and disable form if so
        if (hasVoted(pollId)) {
            const inputs = form.querySelectorAll('input');
            const button = form.querySelector('button');
            inputs.forEach(input => input.disabled = true);
            button.disabled = true;
            button.textContent = 'Already Voted';
        }
    });
    
    // Show results for all polls that have votes
    Object.keys(pollData).forEach(pollId => {
        if (getTotalVotes(pollId) > 0) {
            updateResults(pollId);
        }
    });
    
    // Add refresh button
    addRefreshButton();
}

// Add refresh button for real-time updates
function addRefreshButton() {
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '🔄 Refresh Results';
    refreshButton.className = 'refresh-btn';
    refreshButton.onclick = refreshResults;
    
    // Insert after header
    const header = document.querySelector('header');
    header.appendChild(refreshButton);
}

// Optional: Add a reset function for testing (remove in production)
async function resetAllPolls() {
    if (confirm('Are you sure you want to reset all poll data? This cannot be undone.')) {
        // Reset poll data
        pollData = {
            1: { morning: 0, afternoon: 0, evening: 0 },
            2: { speed: 0, quality: 0, communication: 0, pricing: 0 },
            3: { 'very-satisfied': 0, 'satisfied': 0, 'neutral': 0, 'dissatisfied': 0, 'very-dissatisfied': 0 }
        };
        
        try {
            await saveDataToServer();
            localStorage.clear();
            location.reload();
        } catch (error) {
            showError('Failed to reset polls on server.');
        }
    }
}

// Auto-refresh results every 30 seconds
setInterval(async () => {
    await loadDataFromServer();
    Object.keys(pollData).forEach(pollId => {
        const resultsDiv = document.getElementById(`results-${pollId}`);
        if (resultsDiv.style.display !== 'none') {
            updateResults(pollId);
        }
    });
}, 30000);

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Add admin reset button (for testing purposes)
document.addEventListener('DOMContentLoaded', () => {
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset All Polls (Admin)';
    resetButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #e53e3e;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
        z-index: 1000;
    `;
    resetButton.onclick = resetAllPolls;
    document.body.appendChild(resetButton);
});
