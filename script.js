// Initialize vote data
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

// Load existing data from localStorage
function loadData() {
    const savedData = localStorage.getItem('pollData');
    if (savedData) {
        pollData = JSON.parse(savedData);
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('pollData', JSON.stringify(pollData));
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
            percentageSpan.textContent = `${percentage}%`;
        }
    });
    
    // Show results
    resultsDiv.style.display = 'block';
}

// Handle form submission
function handleVote(event) {
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
    
    // Record the vote
    pollData[pollId][selectedOption]++;
    
    // Mark user as voted
    markAsVoted(pollId);
    
    // Save data
    saveData();
    
    // Disable form
    const inputs = form.querySelectorAll('input');
    const button = form.querySelector('button');
    inputs.forEach(input => input.disabled = true);
    button.disabled = true;
    button.textContent = 'Voted!';
    
    // Show success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.textContent = 'Thank you for your vote!';
    form.parentNode.insertBefore(successMessage, form);
    
    // Update and show results
    updateResults(pollId);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        successMessage.remove();
    }, 3000);
}

// Initialize the application
function init() {
    loadData();
    
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
            
            // Show results for polls user has voted on
            updateResults(pollId);
        }
    });
    
    // Show results for all polls that have votes
    Object.keys(pollData).forEach(pollId => {
        if (getTotalVotes(pollId) > 0) {
            updateResults(pollId);
        }
    });
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Optional: Add a reset function for testing (remove in production)
function resetAllPolls() {
    if (confirm('Are you sure you want to reset all poll data? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
    }
}

// Add reset button (for admin/testing purposes)
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