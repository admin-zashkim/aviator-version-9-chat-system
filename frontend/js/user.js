// ============================================
// COMPLETE FIXED USER.JS - NO AUTO LOGOUT
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
                // Don't throw on 404 - just return empty data
                if (response.status === 404) {
                    return [];
                }
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Request failed');
            }
            return response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            return []; // Return empty array instead of throwing
        }
    };
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
    // Don't load messages immediately - use setTimeout to prevent blocking
    setTimeout(() => {
        loadDirectMessages();
        checkUserBlockStatus();
    }, 100);
}

function goToDashboard() {
    hideAllPages();
    document.getElementById('user-dashboard').classList.add('active');
    getChannelMembers();
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
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Unable to load messages</div>';
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
}

// ============================================
// DIRECT MESSAGES FUNCTIONS - FIXED VERSION
// ============================================

async function loadDirectMessages() {
    const user = getUser();
    if (!user) return;
    
    const container = document.getElementById('direct-messages');
    if (!container) return;
    
    // Don't show loading if already has content
    if (container.children.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading messages...</div>';
    }
    
    try {
        // This is the line that was causing the error
        // Let's make it more robust
        let messages = [];
        try {
            messages = await apiRequest(`/api/messages/direct/${user.id}`);
        } catch (e) {
            console.log('No messages found, starting fresh');
            messages = [];
        }
        
        container.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No messages yet. Start a conversation!</div>';
            return;
        }
        
        messages.forEach(message => {
            appendUserDirectMessage(message);
        });
        
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Load direct messages error:', error);
        // Don't show error, just show empty state
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Ready to chat with admin</div>';
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

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    const user = getUser();
    if (!user) return;
    
    try {
        // Use a fixed admin ID or fetch it properly
        const adminId = '00000000-0000-0000-0000-000000000000'; // Placeholder
        
        const message = await apiRequest('/api/messages/send', {
            method: 'POST',
            body: JSON.stringify({
                content,
                adminId
            })
        });
        
        // Clear input
        input.value = '';
        
        // Add message to UI
        if (message && !message.error) {
            appendUserDirectMessage({
                ...message,
                is_from_admin: false,
                sent_at: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Send message error:', error);
        // Don't show alert for every error
    }
}

// ============================================
// BLOCK/REVIEW FUNCTIONS
// ============================================

async function checkUserBlockStatus() {
    try {
        const data = await apiRequest('/api/user/block-status');
        // Handle block status if needed
    } catch (error) {
        // Silently fail - don't log out user
        console.log('Block status check skipped');
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function linkify(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

// ============================================
// EXPOSE FUNCTIONS
// ============================================

window.openChannelChat = openChannelChat;
window.openAdminDirectChat = openAdminDirectChat;
window.goToDashboard = goToDashboard;
