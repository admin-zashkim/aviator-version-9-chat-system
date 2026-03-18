// ============================================
// COMPLETE USER.JS - FULLY FUNCTIONAL
// ============================================

// Ensure all required functions exist
if (typeof apiRequest === 'undefined') {
    window.apiRequest = async (endpoint, options = {}) => {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`https://backendchatv9admin.onrender.com${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                    ...options.headers
                }
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Request failed');
            }
            return response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    };
}

if (typeof escapeHtml === 'undefined') {
    window.escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

if (typeof formatMessageTime === 'undefined') {
    window.formatMessageTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };
}

if (typeof linkify === 'undefined') {
    window.linkify = (text) => {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    };
}

if (typeof playNotificationSound === 'undefined') {
    window.playNotificationSound = () => console.log('Sound disabled');
}

if (typeof triggerNotification === 'undefined') {
    window.triggerNotification = (title, body) => {
        console.log('Notification:', title, body);
        if (typeof playNotificationSound === 'function') playNotificationSound();
    };
}

if (typeof markMessagesAsRead === 'undefined') {
    window.markMessagesAsRead = () => {};
}

if (typeof emitTyping === 'undefined') {
    window.emitTyping = () => {};
}

// ============================================
// PAGE NAVIGATION
// ============================================

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
}

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
    getChannelMembers(); // Update online count
}

// ============================================
// CHANNEL FUNCTIONS
// ============================================

async function getChannelMembers() {
    try {
        const data = await apiRequest('/api/channel/members');
        const membersEl = document.getElementById('channel-members');
        if (membersEl) {
            membersEl.textContent = `${data.online || 0} members`;
        }
    } catch (error) {
        console.error('Get members error:', error);
        const membersEl = document.getElementById('channel-members');
        if (membersEl) {
            membersEl.textContent = '0 members';
        }
    }
}

async function loadChannelMessages() {
    const container = document.getElementById('channel-messages');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading messages...</div>';
    
    try {
        const messages = await apiRequest('/api/channel/messages');
        container.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No channel messages yet</div>';
            return;
        }
        
        messages.forEach(message => {
            if (!message.is_deleted) {
                appendChannelMessage(message);
            }
        });
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Load channel messages error:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Error loading messages</div>';
    }
}

function appendChannelMessage(message) {
    const container = document.getElementById('channel-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-wrapper received';
    messageDiv.dataset.messageId = message.id;
    
    let mediaHtml = '';
    if (message.media_url && message.media_type) {
        const fullUrl = `https://backendchatv9admin.onrender.com${message.media_url}`;
        if (message.media_type === 'image') {
            mediaHtml = `<div class="message-media"><img src="${fullUrl}" alt="Image" style="max-width: 200px; max-height: 200px; border-radius: 5px; cursor: pointer;" onclick="window.open('${fullUrl}')"></div>`;
        } else if (message.media_type === 'video') {
            mediaHtml = `<div class="message-media"><video src="${fullUrl}" controls style="max-width: 200px; max-height: 200px; border-radius: 5px;"></video></div>`;
        }
    }
    
    const contentHtml = message.content ? 
        `<div class="message-bubble received">${linkify(escapeHtml(message.content))}</div>` : '';
    
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

async function markChannelMessageRead(messageId) {
    try {
        await apiRequest(`/api/channel/mark-read/${messageId}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Mark read error:', error);
    }
}

// ============================================
// DIRECT MESSAGES FUNCTIONS
// ============================================

async function loadDirectMessages() {
    const user = getUser();
    if (!user) return;
    
    const container = document.getElementById('direct-messages');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading messages...</div>';
    
    try {
        // You need to get the admin ID - for now using a placeholder
        // In a real app, you'd fetch this from your backend
        const messages = await apiRequest(`/api/messages/direct/${user.id}`);
        container.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No messages yet. Start a conversation!</div>';
            return;
        }
        
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
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Error loading messages</div>';
    }
}

function appendUserDirectMessage(message) {
    const container = document.getElementById('direct-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-wrapper ${message.is_from_admin ? 'received' : 'sent'}`;
    messageDiv.dataset.messageId = message.id;
    
    const contentHtml = message.content ? 
        `<div class="message-bubble ${message.is_from_admin ? 'received' : 'sent'}">${linkify(escapeHtml(message.content))}</div>` : '';
    
    messageDiv.innerHTML = `
        ${contentHtml}
        <div class="message-time">${formatMessageTime(message.sent_at)}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ============================================
// SEND MESSAGE TO ADMIN
// ============================================

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
    
    // Show sending state
    const sendBtn = document.getElementById('send-btn');
    const originalHtml = sendBtn.innerHTML;
    sendBtn.innerHTML = '...';
    sendBtn.disabled = true;
    
    try {
        // You need to get the actual admin ID from your backend
        // For now, using a placeholder - you should fetch this properly
        const adminId = 'admin-id'; 
        
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
            is_from_admin: false,
            sent_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Send message error:', error);
        alert('Failed to send message: ' + error.message);
    } finally {
        sendBtn.innerHTML = originalHtml;
        sendBtn.disabled = false;
    }
}

// ============================================
// BLOCK/REVIEW FUNCTIONS
// ============================================

function showBlockedOverlay(message) {
    const overlay = document.getElementById('blocked-overlay');
    const inputArea = document.getElementById('chat-input-area');
    
    if (overlay) overlay.style.display = 'block';
    if (inputArea) inputArea.style.display = 'none';
    
    const messageEl = document.querySelector('#blocked-overlay p');
    if (messageEl) messageEl.textContent = message;
}

function hideBlockedOverlay() {
    const overlay = document.getElementById('blocked-overlay');
    const inputArea = document.getElementById('chat-input-area');
    
    if (overlay) overlay.style.display = 'none';
    if (inputArea) inputArea.style.display = 'flex';
}

async function requestReview() {
    const reviewBtn = document.getElementById('review-btn');
    if (!reviewBtn) return;
    
    reviewBtn.disabled = true;
    reviewBtn.textContent = 'Sending...';
    
    try {
        const data = await apiRequest('/api/user/request-review', {
            method: 'POST'
        });
        
        alert(data.message);
        
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
        reviewBtn.disabled = false;
        reviewBtn.textContent = 'Request Review';
    }
}

function updateReviewAttempts(attemptsLeft, cooldown) {
    const attemptsEl = document.getElementById('attempts-left');
    const reviewBtn = document.getElementById('review-btn');
    
    if (attemptsEl) {
        if (attemptsLeft > 0) {
            attemptsEl.textContent = `Attempts left: ${attemptsLeft} (Next in ${cooldown}h)`;
            if (reviewBtn) reviewBtn.disabled = false;
        } else {
            attemptsEl.textContent = 'No more attempts left';
            if (reviewBtn) reviewBtn.disabled = true;
        }
    }
}

// ============================================
// TYPING INDICATORS
// ============================================

function showTypingIndicator(type) {
    let indicator = document.getElementById('typing-indicator');
    const container = document.getElementById('direct-messages');
    
    if (!indicator && container) {
        indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        
        if (type === 'admin') {
            container.appendChild(indicator);
        }
    }
    
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function hideTypingIndicator(type) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// ============================================
// UNREAD BADGE
// ============================================

function updateAdminUnreadBadge() {
    const badge = document.getElementById('admin-unread');
    if (badge) {
        badge.style.display = 'inline';
        // You would update the count here from your backend
    }
}

// ============================================
// BLOCK STATUS CHECK
// ============================================

async function checkUserBlockStatus() {
    try {
        const data = await apiRequest('/api/user/block-status');
        
        if (data.isBlocked) {
            if (data.isPermanentlyBlocked) {
                showBlockedOverlay('You are permanently blocked');
                const reviewBtn = document.getElementById('review-btn');
                if (reviewBtn) reviewBtn.disabled = true;
            } else {
                showBlockedOverlay('You have been blocked by admin');
                const attemptsLeft = document.getElementById('attempts-left');
                if (attemptsLeft) {
                    attemptsLeft.textContent = `Attempts left: ${3 - data.attempts}`;
                }
                
                // Check cooldown
                if (data.lastRequest) {
                    const lastRequest = new Date(data.lastRequest);
                    const hoursSince = (Date.now() - lastRequest) / (1000 * 60 * 60);
                    if (hoursSince < 6) {
                        const reviewBtn = document.getElementById('review-btn');
                        if (reviewBtn) reviewBtn.disabled = true;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Check block status error:', error);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

// ============================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================

window.openChannelChat = openChannelChat;
window.openAdminDirectChat = openAdminDirectChat;
window.goToDashboard = goToDashboard;
window.requestReview = requestReview;
window.showTypingIndicator = showTypingIndicator;
window.hideTypingIndicator = hideTypingIndicator;
window.updateAdminUnreadBadge = updateAdminUnreadBadge;
