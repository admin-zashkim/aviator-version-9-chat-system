// ============================================
// COMPLETE ADMIN.JS - FULLY FUNCTIONAL
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
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
}

if (typeof linkify === 'undefined') {
    window.linkify = (text) => {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
    };
}

if (typeof playNotificationSound === 'undefined') {
    window.playNotificationSound = () => console.log('Sound disabled');
}

if (typeof markMessagesAsRead === 'undefined') {
    window.markMessagesAsRead = () => {};
}

if (typeof emitTyping === 'undefined') {
    window.emitTyping = () => {};
}

// ============================================
// ADMIN NAVIGATION
// ============================================

function showAdminSection(section) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.admin-section');
    
    navBtns.forEach(btn => btn.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    if (section === 'channel') {
        navBtns[0].classList.add('active');
        document.getElementById('admin-channel').classList.add('active');
        loadChannelMessages(); // Load messages when channel tab is opened
    } else {
        navBtns[1].classList.add('active');
        document.getElementById('admin-users').classList.add('active');
        loadUsers(); // Load users when users tab is opened
    }
}

function goToAdminDashboard() {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById('admin-dashboard').classList.add('active');
    
    // Reload stats
    loadAdminStats();
}

// ============================================
// LOAD ADMIN STATS
// ============================================

async function loadAdminStats() {
    try {
        const stats = await apiRequest('/api/admin/stats');
        
        document.getElementById('total-users').textContent = stats.totalUsers || '0';
        document.getElementById('online-users').textContent = stats.onlineUsers || '0';
        document.getElementById('total-messages').textContent = stats.totalMessages || '0';
        document.getElementById('unread-messages').textContent = stats.unreadMessages || '0';
    } catch (error) {
        console.error('Load stats error:', error);
        // Set default values on error
        document.getElementById('total-users').textContent = '0';
        document.getElementById('online-users').textContent = '0';
        document.getElementById('total-messages').textContent = '0';
        document.getElementById('unread-messages').textContent = '0';
    }
}

// ============================================
// LOAD USERS LIST
// ============================================

async function loadUsers(filter = 'all') {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading users...</div>';
    
    try {
        const users = await apiRequest(`/api/admin/users?filter=${filter}`);
        container.innerHTML = '';
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;">No users found</div>';
            return;
        }
        
        users.forEach(user => {
            appendUserToList(user);
        });
    } catch (error) {
        console.error('Load users error:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Error loading users</div>';
    }
}

function filterUsers(filter) {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadUsers(filter);
}

function appendUserToList(user) {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    userDiv.setAttribute('data-user-id', user.id);
    userDiv.onclick = () => openUserChat(user.id, `${user.first_name} ${user.last_name}`);
    
    // Get last message
    let lastMessage = 'No messages yet';
    let lastMessageTime = '';
    
    if (user.last_message) {
        lastMessage = user.last_message.content || 'Media message';
        lastMessageTime = user.last_message.sent_at || '';
    }
    
    const unreadBadge = user.unread_count > 0 ? 
        `<span class="unread-indicator">${user.unread_count}</span>` : '';
    
    const blockedBadge = user.is_blocked ? 
        `<span class="blocked-badge">Blocked</span>` : '';
    
    userDiv.innerHTML = `
        <div class="user-avatar">${user.first_name?.charAt(0) || 'U'}${user.last_name?.charAt(0) || 'U'}</div>
        <div class="user-info">
            <div class="user-name">${user.first_name || ''} ${user.last_name || ''} ${blockedBadge}</div>
            <div class="user-last-message">${escapeHtml(lastMessage.substring(0, 30))}${lastMessage.length > 30 ? '...' : ''}</div>
        </div>
        <div class="user-time">${lastMessageTime ? formatMessageTime(lastMessageTime) : ''}</div>
        <span class="user-status ${user.is_online ? 'online' : 'offline'}"></span>
        ${unreadBadge}
    `;
    
    container.appendChild(userDiv);
}

// ============================================
// UPDATE USER ONLINE STATUS
// ============================================

function updateUserOnlineStatus(userId, isOnline) {
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => {
        if (item.dataset.userId === userId) {
            const statusDot = item.querySelector('.user-status');
            if (statusDot) {
                statusDot.className = `user-status ${isOnline ? 'online' : 'offline'}`;
            }
        }
    });
    
    // Update in chat if open
    const chatContainer = document.getElementById('admin-user-chat');
    if (chatContainer && chatContainer.classList.contains('active') &&
        chatContainer.dataset.userId === userId) {
        const statusEl = document.getElementById('chat-user-status');
        if (statusEl) {
            statusEl.textContent = isOnline ? 'online' : 'offline';
            statusEl.className = isOnline ? 'online-status' : '';
        }
    }
}

// ============================================
// UPDATE USER UNREAD COUNT
// ============================================

function updateUserUnreadCount(userId) {
    const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (userItem) {
        let unreadBadge = userItem.querySelector('.unread-indicator');
        if (unreadBadge) {
            const count = parseInt(unreadBadge.textContent) + 1;
            unreadBadge.textContent = count;
        } else {
            unreadBadge = document.createElement('span');
            unreadBadge.className = 'unread-indicator';
            unreadBadge.textContent = '1';
            userItem.appendChild(unreadBadge);
        }
    }
}

// ============================================
// LOAD CHANNEL MESSAGES
// ============================================

async function loadChannelMessages() {
    const container = document.getElementById('admin-channel-messages');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading messages...</div>';
    
    try {
        const messages = await apiRequest('/api/channel/messages');
        container.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;">No channel messages yet</div>';
            return;
        }
        
        messages.forEach(message => {
            if (!message.is_deleted) {
                appendChannelMessageAdmin(message);
            }
        });
    } catch (error) {
        console.error('Load channel messages error:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Error loading messages</div>';
    }
}

function appendChannelMessageAdmin(message) {
    const container = document.getElementById('admin-channel-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'channel-message-item';
    messageDiv.dataset.messageId = message.id;
    
    let mediaHtml = '';
    if (message.media_url && message.media_type) {
        const fullUrl = `https://backendchatv9admin.onrender.com${message.media_url}`;
        if (message.media_type === 'image') {
            mediaHtml = `<div class="message-media"><img src="${fullUrl}" alt="Image" style="max-width: 200px; max-height: 200px;"></div>`;
        } else if (message.media_type === 'video') {
            mediaHtml = `<div class="message-media"><video src="${fullUrl}" controls style="max-width: 200px; max-height: 200px;"></video></div>`;
        }
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span>${message.sent_at ? formatMessageTime(message.sent_at) : ''}</span>
            <button class="delete-message-btn" onclick="deleteChannelMessage('${message.id}')">Delete</button>
        </div>
        ${mediaHtml}
        <div class="message-content">${message.content ? linkify(escapeHtml(message.content)) : ''}</div>
    `;
    
    container.appendChild(messageDiv);
}

// ============================================
// SEND CHANNEL MESSAGE
// ============================================

document.getElementById('channel-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = document.getElementById('channel-content').value;
    const mediaFile = document.getElementById('channel-media').files[0];
    
    if (!content && !mediaFile) return;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;
    
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (mediaFile) formData.append('media', mediaFile);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`https://backendchatv9admin.onrender.com/api/channel/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const message = await response.json();
        
        if (message.error) {
            alert(message.error);
            return;
        }
        
        // Clear form
        document.getElementById('channel-content').value = '';
        document.getElementById('channel-media').value = '';
        
        // Add to UI
        appendChannelMessageAdmin(message);
        
        // Play sound
        if (typeof playNotificationSound === 'function') {
            playNotificationSound();
        }
    } catch (error) {
        console.error('Send channel message error:', error);
        alert('Failed to send message');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// ============================================
// DELETE CHANNEL MESSAGE
// ============================================

async function deleteChannelMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
        await apiRequest(`/api/channel/message/${messageId}`, {
            method: 'DELETE'
        });
        
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    } catch (error) {
        console.error('Delete message error:', error);
        alert('Failed to delete message');
    }
}

// ============================================
// OPEN USER CHAT
// ============================================

let currentChatUserId = null;

function openUserChat(userId, userName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const chatPage = document.getElementById('admin-user-chat');
    chatPage.classList.add('active');
    chatPage.dataset.userId = userId;
    document.getElementById('chat-user-name').textContent = userName;
    
    currentChatUserId = userId;
    
    // Reset block button
    const blockBtn = document.getElementById('block-user-btn');
    if (blockBtn) {
        blockBtn.classList.remove('blocked');
        blockBtn.style.background = '';
    }
    
    loadUserMessages(userId);
}

async function loadUserMessages(userId) {
    const container = document.getElementById('admin-user-messages');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading messages...</div>';
    
    try {
        const messages = await apiRequest(`/api/messages/direct/${userId}`);
        container.innerHTML = '';
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">No messages yet. Start a conversation!</div>';
            return;
        }
        
        messages.forEach(message => {
            appendAdminDirectMessage(message);
        });
        
        container.scrollTop = container.scrollHeight;
        
        // Mark unread as read
        const unreadIds = messages
            .filter(m => !m.is_read && !m.is_from_admin)
            .map(m => m.id);
        
        if (unreadIds.length > 0 && typeof markMessagesAsRead === 'function') {
            markMessagesAsRead(unreadIds, true);
        }
    } catch (error) {
        console.error('Load user messages error:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Error loading messages</div>';
    }
}

function appendAdminDirectMessage(message) {
    const container = document.getElementById('admin-user-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-wrapper ${message.is_from_admin ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    
    const contentHtml = message.content ? 
        `<div class="message-bubble ${message.is_from_admin ? 'sent' : 'received'}">${linkify(escapeHtml(message.content))}</div>` : '';
    
    messageDiv.innerHTML = `
        ${contentHtml}
        <div class="message-time">${message.sent_at ? formatMessageTime(message.sent_at) : ''}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ============================================
// SEND MESSAGE TO USER
// ============================================

document.getElementById('admin-send-btn')?.addEventListener('click', sendAdminMessage);
document.getElementById('admin-message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAdminMessage();
    }
});

async function sendAdminMessage() {
    const input = document.getElementById('admin-message-input');
    const content = input.value.trim();
    
    if (!content || !currentChatUserId) return;
    
    try {
        const message = await apiRequest('/api/admin/messages/send', {
            method: 'POST',
            body: JSON.stringify({
                content,
                userId: currentChatUserId
            })
        });
        
        // Play send sound
        if (typeof playNotificationSound === 'function') {
            playNotificationSound();
        }
        
        // Clear input
        input.value = '';
        
        // Add to UI
        appendAdminDirectMessage({
            ...message,
            is_from_admin: true,
            sent_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Send admin message error:', error);
        alert('Failed to send message: ' + error.message);
    }
}

// ============================================
// TOGGLE BLOCK USER
// ============================================

async function toggleBlockUser() {
    if (!currentChatUserId) return;
    
    const btn = document.getElementById('block-user-btn');
    const isBlocking = btn.classList.contains('blocked');
    
    try {
        if (isBlocking) {
            await apiRequest(`/api/admin/user/unblock/${currentChatUserId}`, {
                method: 'POST'
            });
            btn.classList.remove('blocked');
            btn.style.background = '';
            alert('User unblocked');
        } else {
            await apiRequest(`/api/admin/user/block/${currentChatUserId}`, {
                method: 'POST'
            });
            btn.classList.add('blocked');
            btn.style.background = '#dc3545';
            alert('User blocked');
        }
    } catch (error) {
        console.error('Toggle block error:', error);
        alert('Failed to update block status: ' + error.message);
    }
}

// ============================================
// REVIEW REQUESTS
// ============================================

function addReviewRequest(data) {
    console.log('Review request received:', data);
    // You can add UI notification here
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const admin = JSON.parse(localStorage.getItem('admin') || 'null');
    if (admin) {
        console.log('Admin logged in:', admin.username);
        loadAdminStats();
        loadUsers();
        loadChannelMessages();
    }
});

// Make functions globally available
window.showAdminSection = showAdminSection;
window.goToAdminDashboard = goToAdminDashboard;
window.filterUsers = filterUsers;
window.openUserChat = openUserChat;
window.deleteChannelMessage = deleteChannelMessage;
window.toggleBlockUser = toggleBlockUser;
window.addReviewRequest = addReviewRequest;
window.updateUserOnlineStatus = updateUserOnlineStatus;
window.updateUserUnreadCount = updateUserUnreadCount;
