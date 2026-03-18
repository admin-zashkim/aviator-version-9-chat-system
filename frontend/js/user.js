// Navigation
function openChannelChat() {
    hideAllPages();
    document.getElementById('channel-chat').classList.add('active');
    loadChannelMessages();
    getChannelMembers();
}

function openAdminDirectChat() {
    hideAllPages();
    document.getElementById('admin-direct-chat').classList.add('active');
    loadDirectMessages();
    checkUserBlockStatus();
}

function goToDashboard() {
    hideAllPages();
    document.getElementById('user-dashboard').classList.add('active');
}

// Get channel members count
async function getChannelMembers() {
    try {
        const data = await apiRequest('/api/channel/members');
        document.getElementById('channel-members').textContent = `${data.online} members`;
    } catch (error) {
        console.error('Get members error:', error);
    }
}

// Load channel messages
async function loadChannelMessages() {
    try {
        const messages = await apiRequest('/api/channel/messages');
        const container = document.getElementById('channel-messages');
        container.innerHTML = '';
        
        messages.forEach(message => {
            if (!message.is_deleted) {
                appendChannelMessage(message);
            }
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Load channel messages error:', error);
    }
}

// Append channel message
function appendChannelMessage(message) {
    const container = document.getElementById('channel-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-wrapper received';
    messageDiv.dataset.messageId = message.id;
    
    let mediaHtml = '';
    if (message.media_url && message.media_type) {
        const fullUrl = `${BACKEND_URL}${message.media_url}`;
        if (message.media_type === 'image') {
            mediaHtml = `<div class="message-media"><img src="${fullUrl}" alt="Image" onclick="window.open('${fullUrl}')"></div>`;
        } else if (message.media_type === 'video') {
            mediaHtml = `<div class="message-media"><video src="${fullUrl}" controls onclick="window.open('${fullUrl}')"></video></div>`;
        }
    }
    
    const contentHtml = message.content ? `<div class="message-bubble received">${linkify(escapeHtml(message.content))}</div>` : '';
    
    messageDiv.innerHTML = `
        ${mediaHtml}
        ${contentHtml}
        <div class="message-time">${formatMessageTime(message.sent_at)}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    // Mark as read
    if (!message.is_read) {
        markChannelMessageRead(message.id);
    }
}

// Mark channel message as read
async function markChannelMessageRead(messageId) {
    try {
        await apiRequest(`/api/channel/mark-read/${messageId}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Mark read error:', error);
    }
}

// Load direct messages with admin
async function loadDirectMessages() {
    const user = getUser();
    if (!user) return;
    
    try {
        // Get admin ID first (assuming first admin)
        const messages = await apiRequest(`/api/messages/direct/${user.id}`);
        const container = document.getElementById('direct-messages');
        container.innerHTML = '';
        
        messages.forEach(message => {
            appendUserDirectMessage(message);
        });
        
        container.scrollTop = container.scrollHeight;
        
        // Mark unread messages as read
        const unreadIds = messages
            .filter(m => !m.is_read && m.is_from_admin)
            .map(m => m.id);
        
        if (unreadIds.length > 0) {
            markMessagesAsRead(unreadIds, false);
        }
    } catch (error) {
        console.error('Load direct messages error:', error);
    }
}

// Append direct message (user view)
function appendUserDirectMessage(message) {
    const container = document.getElementById('direct-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-wrapper ${message.is_from_admin ? 'received' : 'sent'}`;
    messageDiv.dataset.messageId = message.id;
    
    const contentHtml = message.content ? `<div class="message-bubble ${message.is_from_admin ? 'received' : 'sent'}">${linkify(escapeHtml(message.content))}</div>` : '';
    
    messageDiv.innerHTML = `
        ${contentHtml}
        <div class="message-time">${formatMessageTime(message.sent_at)}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Send message to admin
document.getElementById('send-btn')?.addEventListener('click', sendMessage);
document.getElementById('message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Typing indicator
let typingTimeout;
document.getElementById('message-input')?.addEventListener('input', () => {
    const user = getUser();
    if (!user) return;
    
    emitTyping(true, 'admin');
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        emitTyping(false, 'admin');
    }, 1000);
});

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    const user = getUser();
    if (!user) return;
    
    try {
        // Get admin ID (assuming first admin)
        const adminId = 'admin-id'; // You'll need to fetch this
        
        const message = await apiRequest('/api/messages/send', {
            method: 'POST',
            body: JSON.stringify({
                content,
                adminId
            })
        });
        
        // Play send sound
        playNotificationSound();
        
        // Clear input
        input.value = '';
        
        // Add message to UI
        appendUserDirectMessage({
            ...message,
            is_from_admin: false
        });
    } catch (error) {
        console.error('Send message error:', error);
        alert(error.message);
    }
}

// Block overlay
function showBlockedOverlay(message) {
    const overlay = document.getElementById('blocked-overlay');
    const inputArea = document.getElementById('chat-input-area');
    
    overlay.style.display = 'block';
    inputArea.style.display = 'none';
    
    document.querySelector('#blocked-overlay p').textContent = message;
}

function hideBlockedOverlay() {
    document.getElementById('blocked-overlay').style.display = 'none';
    document.getElementById('chat-input-area').style.display = 'flex';
}

// Request review
async function requestReview() {
    try {
        const data = await apiRequest('/api/user/request-review', {
            method: 'POST'
        });
        
        alert(data.message);
        document.getElementById('review-btn').disabled = true;
        
        // Update attempts left
        const attemptsLeft = document.getElementById('attempts-left');
        if (attemptsLeft) {
            attemptsLeft.textContent = `Attempts left: ${data.attemptsLeft}`;
        }
    } catch (error) {
        console.error('Review request error:', error);
        
        if (error.message.includes('wait')) {
            alert(error.message);
        } else {
            alert('Failed to send review request');
        }
    }
}

function updateReviewAttempts(attemptsLeft, cooldown) {
    const attemptsEl = document.getElementById('attempts-left');
    if (attemptsEl) {
        if (attemptsLeft > 0) {
            attemptsEl.textContent = `Attempts left: ${attemptsLeft} (Next in ${cooldown}h)`;
        } else {
            attemptsEl.textContent = 'No more attempts left';
            document.getElementById('review-btn').disabled = true;
        }
    }
}

// Typing indicators
function showTypingIndicator(type) {
    let indicator = document.getElementById('typing-indicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        
        if (type === 'admin') {
            document.getElementById('direct-messages').appendChild(indicator);
        }
    }
    
    document.getElementById('direct-messages').scrollTop = document.getElementById('direct-messages').scrollHeight;
}

function hideTypingIndicator(type) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Update admin unread badge
function updateAdminUnreadBadge() {
    // This would need to track unread count
    // For now, just show badge
    document.getElementById('admin-unread').style.display = 'inline';
}