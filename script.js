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
    ttl: 30000 // 30 seconds cache
};

// Show loading indicator for specific elements
function showElementLoading(elementId, show = true) {
    const element = document.getElementById(elementId);
    if (element) {
        if (show) {
            element.style.opacity = '0.6';
            element.style.pointerEvents = 'none';
        } else {
            element.style.opacity = '1';
            element.style.pointerEvents = 'auto';
        }
    }
}

// Show minimal loading indicator
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

// Load data with caching and timeout
async function loadDataFromServer(useCache = true) {
    // Return cached data if valid
    if (useCache && isCacheValid()) {
        pollData = { ...dataCache.data };
        return pollData;
    }

    try {
        showQuickLoading(true);
        
        // Set a timeout for the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
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
        
        // Update cache
        dataCache = {
            data: { ...data },
            timestamp: Date.now(),
            ttl: 30000
        };
        
        pollData = data;
        
        // Save to localStorage as backup
        localStorage.setItem('pollData', JSON.stringify(pollData));
        localStorage.setItem('pollDataCache', JSON.stringify(dataCache));
        
        return pollData;
        
    } catch (error) {
        console.warn('Server load failed, using fallback:', error.message);
        
        // Try cached localStorage data
        const savedCache = localStorage.getItem('pollDataCache');
        const savedData = localStorage.getItem('pollData');
        
        if (savedCache && savedData) {
            const cache = JSON.parse(savedCache);
            // Use localStorage cache if it's less than 5 minutes old
            if ((Date.now() - cache.timestamp) < 300000) {
                pollData = JSON.parse(savedData);
                dataCache = cache;
                return pollData;
            }
        }
        
        // Final fallback to default structure
        return pollData;
        
    } finally {
        showQuickLoading(false);
    }
}

// Optimized save with retry logic
async function saveDataToServer(retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            showQuickLoading(true);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
            
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

            // Update cache immediately
            dataCache = {
                data: { ...pollData },
                timestamp: Date.now(),
                ttl: 30000
            };
            
            // Save to localStorage
            localStorage.setItem('pollData', JSON.stringify(pollData));
            localStorage.setItem('pollDataCache', JSON.stringify(dataCache));
            
            return true;
            
        } catch (error) {
            console.warn(`Save attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === retries) {
                // Final fallback - save locally only
                localStorage.setItem('pollData', JSON.stringify(pollData));
                throw error;
            }
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        } finally {
            showQuickLoading(false);
        }
    }
}

// Preload data on page load
function preloadData() {
    // Load cached data from localStorage immediately
    const savedCache = localStorage.getItem('pollDataCache');
    const savedData = localStorage.getItem('pollData');
    
    if (savedCache && savedData) {
        const cache = JSON.parse(savedCache);
        // Use localStorage data if it's less than 2 minutes old for instant loading
        if ((Date.now() - cache.timestamp) < 120000) {
            pollData = JSON.parse(savedData);
            dataCache = cache;
            
            // Update UI immediately with cached data
            updateAllResults();
            
            // Then fetch fresh data in background
            loadDataFromServer(false).then(() => {
                updateAllResults();
            });
            
            return true;
        }
    }
    
    return false;
}

// Update all poll results
function updateAllResults() {
    Object.keys(pollData).forEach(pollId => {
        if (getTotalVotes(pollId) > 0) {
            updateResults(pollId);
        }
    });
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

// Update results display (optimized)
function updateResults(pollId) {
    const resultsDiv = document.getElementById(`results-${pollId}`);
    if (!resultsDiv) return;
    
    const totalVotes = getTotalVotes(pollId);
    
    // Update total votes display
    const totalElement = document.getElementById(`total-${pollId}`);
    if (totalElement) {
        totalElement.textContent = totalVotes;
    }
    
    // Batch DOM updates
    const updates = [];
    Object.keys(pollData[pollId]).forEach(option => {
        const votes = pollData[pollId][option];
        const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
        
        const progressBar = resultsDiv.querySelector(`[data-option="${option}"].progress`);
        const percentageSpan = resultsDiv.querySelector(`[data-option="${option}"].percentage`);
        
        if (progressBar && percentageSpan) {
            updates.push(() => {
                progressBar.style.width = `${percentage}%`;
                percentageSpan.textContent = `${percentage}% (${votes} votes)`;
            });
        }
    });
    
    // Apply all updates at once
    updates.forEach(update => update());
    
    // Show results
    resultsDiv.style.display = 'block';
}

// Optimized vote handler
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
    
    // Disable form immediately
    const inputs = form.querySelectorAll('input');
    const button = form.querySelector('button');
    inputs.forEach(input => input.disabled = true);
    button.disabled = true;
    button.textContent = 'Submitting...';
    
    // Optimistic update - update UI immediately
    pollData[pollId][selectedOption]++;
    updateResults(pollId);
    markAsVoted(pollId);
    
    try {
        // Save to server in background
        await saveDataToServer();
        
        button.textContent = 'Voted!';
        showSuccessMessage(form, 'Thank you for your vote!');
        
    } catch (error) {
        console.error('Error submitting vote:', error);
        
        // Revert optimistic update
        pollData[pollId][selectedOption]--;
        updateResults(pollId);
        localStorage.removeItem(`voted_${pollId}`);
        
        // Re-enable form
        inputs.forEach(input => input.disabled = false);
        button.disabled = false;
        button.textContent = 'Vote';
        
        showErrorMessage('Failed to submit vote. Please try again.');
    }
}

// Show success message (optimized)
function showSuccessMessage(form, message) {
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = message;
    form.parentNode.insertBefore(successMessage, form);
    
    setTimeout(() => successMessage.remove(), 3000);
}

// Show error message (optimized)
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `${message} <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>`;
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('main'));
    
    setTimeout(() => {
        if (errorDiv.parentNode) errorDiv.remove();
    }, 5000);
}

// Background refresh (less frequent)
async function backgroundRefresh() {
    try {
        await loadDataFromServer(false); // Force fresh data
        updateAllResults();
    } catch (error) {
        console.warn('Background refresh failed:', error);
    }
}

// Initialize the application (optimized)
async function init() {
    // Try to load cached data first for instant display
    const hasCachedData = preloadData();
    
    // Set up forms immediately
    document.querySelectorAll('.poll-form').forEach(form => {
        const pollId = form.dataset.poll;
        form.addEventListener('submit', handleVote);
        
        if (hasVoted(pollId)) {
            const inputs = form.querySelectorAll('input');
            const button = form.querySelector('button');
            inputs.forEach(input => input.disabled = true);
            button.disabled = true;
            button.textContent = 'Already Voted';
        }
    });
    
    // If no cached data, load from server
    if (!hasCachedData) {
        await loadDataFromServer();
        updateAllResults();
    }
    
    // Add refresh button
    addRefreshButton();
}

// Add refresh button
function addRefreshButton() {
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '🔄 Refresh';
    refreshButton.className = 'refresh-btn';
    refreshButton.onclick = async () => {
        await loadDataFromServer(false);
        updateAllResults();
        
        // Show quick feedback
        refreshButton.textContent = '✓ Updated';
        setTimeout(() => {
            refreshButton.textContent = '🔄 Refresh';
        }, 1500);
    };
    
    document.querySelector('header').appendChild(refreshButton);
}

// Reduced auto-refresh frequency
setInterval(backgroundRefresh, 60000); // Every 60 seconds instead of 30

// Start the application
document.addEventListener('DOMContentLoaded', init);
