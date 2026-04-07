// JSONBin.io configuration
const JSONBIN_CONFIG = {
    binId: '69d51134856a6821890a37c8', // Replace with your actual bin ID
    apiKey: '$2a$10$7RKHOZacvPLaz5YLJReSj.uCgoukwtVUtA3jcmlbX9j.FC2u4D2dq', // Replace with your actual API key
    baseUrl: 'https://api.jsonbin.io/v3'
};



// Initialize vote data structure
let pollData = {
    1: { morning: 0, afternoon: 0, evening: 0 },
    2: { speed: 0, quality: 0, communication: 0, pricing: 0 },
    3: { 'very-satisfied': 0, 'satisfied': 0, 'neutral': 0, 'dissatisfied': 0, 'very-dissatisfied': 0 }
};

// Cache management
let dataCache = {
    data: null,
    timestamp: 0,
    ttl: 30000
};

// Check if user has voted
function hasVoted() {
    return localStorage.getItem('hasVoted') === 'true';
}

// Mark user as voted
function markAsVoted(vote) {
    localStorage.setItem('hasVoted', 'true');
    localStorage.setItem('userVote', vote);
}

// Get user's vote
function getUserVote() {
    return localStorage.getItem('userVote');
}

// Show loading indicator
function showQuickLoading(show = true) {
    let indicator = document.getElementById('quick-loading');
    
    if (show && !indicator) {
        indicator = document.createElement('div');
        indicator.id = 'quick-loading';
        indicator.innerHTML = '<div class="quick-spinner"></div>';
        indicator.className = 'quick-loading-indicator';
        document.body.appendChild(indicator);
    } else if (!show && indicator) {
        indicator.remove();
    }
}

// Check if cache is valid
function isCacheValid() {
    return dataCache.data && (Date.now() - dataCache.timestamp) < dataCache.ttl;
}

// Load data from server
async function loadDataFromServer(useCache = true) {
    if (useCache && isCacheValid()) {
        pollData = { ...dataCache.data };
        return pollData;
    }

    try {
        showQuickLoading(true);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${JSONBIN_CONFIG.baseUrl}/b/${JSONBIN_CONFIG.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.apiKey,
                'X-Bin-Meta': 'false'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        dataCache = {
            data: { ...data },
            timestamp: Date.now(),
            ttl: 30000
        };
        
        pollData = data;
        localStorage.setItem('pollData', JSON.stringify(pollData));
        localStorage.setItem('pollDataCache', JSON.stringify(dataCache));
        
        return pollData;
        
    } catch (error) {
        console.warn('Server load failed, using fallback:', error.message);
        
        const savedCache = localStorage.getItem('pollDataCache');
        const savedData = localStorage.getItem('pollData');
        
        if (savedCache && savedData) {
            const cache = JSON.parse(savedCache);
            if ((Date.now() - cache.timestamp) < 300000) {
                pollData = JSON.parse(savedData);
                dataCache = cache;
                return pollData;
            }
        }
        
        return pollData;
        
    } finally {
        showQuickLoading(false);
    }
}

// Save data to server
async function saveDataToServer(retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            showQuickLoading(true);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(`${JSONBIN_CONFIG.baseUrl}/b/${JSONBIN_CONFIG.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_CONFIG.apiKey
                },
                body: JSON.stringify(pollData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            dataCache = {
                data: { ...pollData },
                timestamp: Date.now(),
                ttl: 30000
            };
            
            localStorage.setItem('pollData', JSON.stringify(pollData));
            localStorage.setItem('pollDataCache', JSON.stringify(dataCache));
            
            return true;
            
        } catch (error) {
            console.warn(`Save attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === retries) {
                localStorage.setItem('pollData', JSON.stringify(pollData));
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        } finally {
            showQuickLoading(false);
        }
    }
}

// Preload data
function preloadData() {
    const savedCache = localStorage.getItem('pollDataCache');
    const savedData = localStorage.getItem('pollData');
    
    if (savedCache && savedData) {
        const cache = JSON.parse(savedCache);
        if ((Date.now() - cache.timestamp) < 120000) {
            pollData = JSON.parse(savedData);
            dataCache = cache;
            updateAllResults();
            
            loadDataFromServer(false).then(() => {
                updateAllResults();
            });
            
            return true;
        }
    }
    
    return false;
}

// Calculate total votes for a poll
function getTotalVotes(pollId) {
    return Object.values(pollData[pollId]).reduce((sum, votes) => sum + votes, 0);
}

// Update all results
function updateAllResults() {
    Object.keys(pollData).forEach(pollId => {
        updateResults(pollId);
    });
}

// Update results display
function updateResults(pollId) {
    const totalVotes = getTotalVotes(pollId);
    
    // Update total votes display
    const totalElement = document.getElementById(`total-${pollId}`);
    if (totalElement) {
        totalElement.textContent = totalVotes;
    }
    
    // Update each option's percentage and progress bar
    Object.keys(pollData[pollId]).forEach(option => {
        const votes = pollData[pollId][option];
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        
        const progressBar = document.querySelector(`[data-poll="${pollId}"][data-option="${option}"].progress`);
        const percentageSpan = document.querySelector(`[data-poll="${pollId}"][data-option="${option}"].percentage`);
        
        if (progressBar && percentageSpan) {
            progressBar.style.width = `${percentage}%`;
            percentageSpan.textContent = `${percentage}% (${votes} votes)`;
        }
    });
}

// Get option display text
function getOptionDisplayText(vote) {
    const optionMap = {
        '1-morning': 'Meeting Time: Morning (9-11 AM)',
        '1-afternoon': 'Meeting Time: Afternoon (1-3 PM)',
        '1-evening': 'Meeting Time: Evening (5-7 PM)',
        '2-speed': 'Service Priority: Faster response times',
        '2-quality': 'Service Priority: Higher quality deliverables',
        '2-communication': 'Service Priority: Better communication',
        '2-pricing': 'Service Priority: More competitive pricing',
        '3-very-satisfied': 'Satisfaction: Very Satisfied',
        '3-satisfied': 'Satisfaction: Satisfied',
        '3-neutral': 'Satisfaction: Neutral',
        '3-dissatisfied': 'Satisfaction: Dissatisfied',
        '3-very-dissatisfied': 'Satisfaction: Very Dissatisfied'
    };
    
    return optionMap[vote] || vote;
}

// Handle vote submission
async function handleVote(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const selectedVote = formData.get('vote');
    
    if (!selectedVote) {
        alert('Please select one option before voting.');
        return;
    }
    
    if (hasVoted()) {
        alert('You have already voted. You can only vote once.');
        return;
    }
    
    // Parse the vote (format: "pollId-option")
    const [pollId, option] = selectedVote.split('-');
    
    // Disable form
    const inputs = form.querySelectorAll('input');
    const button = form.querySelector('button');
    inputs.forEach(input => input.disabled = true);
    button.disabled = true;
    button.textContent = 'Submitting...';
    
    // Optimistic update
    pollData[pollId][option]++;
    updateResults(pollId);
    
    try {
        // Save to server
        await saveDataToServer();
        
        // Mark as voted
        markAsVoted(selectedVote);
        
        // Show voted state
        showVotedState();
        
        // Show success message
        showSuccessMessage('Thank you for your vote! Your response has been recorded.');
        
    } catch (error) {
        console.error('Error submitting vote:', error);
        
        // Revert optimistic update
        pollData[pollId][option]--;
        updateResults(pollId);
        
        // Re-enable form
        inputs.forEach(input => input.disabled = false);
        button.disabled = false;
        button.textContent = 'Submit My Vote';
        
        showErrorMessage('Failed to submit your vote. Please try again.');
    }
}

// Show voted state
function showVotedState() {
    const votingSection = document.getElementById('voting-section');
    const voteForm = document.getElementById('vote-form');
    const alreadyVoted = document.getElementById('already-voted');
    const userVoteDisplay = document.getElementById('user-vote-display');
    
    voteForm.style.display = 'none';
    alreadyVoted.style.display = 'block';
    
    const userVote = getUserVote();
    if (userVote) {
        userVoteDisplay.textContent = getOptionDisplayText(userVote);
    }
}

// Show success message
function showSuccessMessage(message) {
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = message;
    document.querySelector('.container').insertBefore(successMessage, document.querySelector('main'));
    
    setTimeout(() => successMessage.remove(), 4000);
}

// Show error message
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `${message} <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>`;
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('main'));
    
    setTimeout(() => {
        if (errorDiv.parentNode) errorDiv.remove();
    }, 5000);
}

// Background refresh
async function backgroundRefresh() {
    try {
        await loadDataFromServer(false);
        updateAllResults();
    } catch (error) {
        console.warn('Background refresh failed:', error);
    }
}

// Initialize the application
async function init() {
    // Try to load cached data first
    const hasCachedData = preloadData();
    
    // Set up form
    const voteForm = document.getElementById('vote-form');
    if (voteForm) {
        voteForm.addEventListener('submit', handleVote);
    }
    
    // Check if user has already voted
    if (hasVoted()) {
        showVotedState();
    }
    
    // If no cached data, load from server
    if (!hasCachedData) {
        await loadDataFromServer();
        updateAllResults();
    }
    
    addRefreshButton();
}

// Add refresh button
function addRefreshButton() {
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '🔄 Refresh Results';
    refreshButton.className = 'refresh-btn';
    refreshButton.onclick = async () => {
        await loadDataFromServer(false);
        updateAllResults();
        
        refreshButton.textContent = '✓ Updated';
        setTimeout(() => {
            refreshButton.textContent = '🔄 Refresh Results';
        }, 1500);
    };
    
    document.querySelector('header').appendChild(refreshButton);
}

// Auto-refresh every 60 seconds
setInterval(backgroundRefresh, 60000);

// Start the application
document.addEventListener('DOMContentLoaded', init);

// Admin reset function
async function resetAllPolls() {
    if (confirm('Are you sure you want to reset all poll data? This cannot be undone.')) {
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
            showErrorMessage('Failed to reset polls on server.');
        }
    }
}

// Add admin reset button
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
