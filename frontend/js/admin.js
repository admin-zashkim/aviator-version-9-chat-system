// Admin navigation
function showAdminSection(section) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.admin-section');
    
    navBtns.forEach(btn => btn.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    if (section === 'channel') {
        navBtns[0].classList.add('active');
        document.getElementById('admin-channel').classList.add('active');
    } else {
        navBtns[1].classList.add('active');
        document.getElementById('admin-users').classList.add('active');
    }
}

function goToAdminDashboard() {
    hideAllPages();
    document.getElementById('admin-dashboard').classList.add('active');
}

// Load admin stats
async function loadAdminStats() {
    try {
        const stats = await apiRequest('/api/admin/stats');
        
        document.getElementById('total-users').textContent = stats.totalUsers;
        document.getElementById('online-users').textContent = stats.onlineUsers;
        document.getElementById('total-messages').textContent = stats.totalMessages;
        document.getElementById('unread-messages').textContent = stats.unreadMessages;
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load users list
async function loadUsers(filter = 'all') {
    try {
        const users = await apiRequest(`/api/admin/users?filter=${filter}`);
        const container = document.getElementById('users-list');
        container.innerHTML = '';
        
        users.forEach(user => {
            appendUserToList(user);
        });
    } catch (error) {
        console.error('Load users error:', error);
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
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    userDiv.onclick = () => openUserChat(user.id, `${user.first_name} ${user.last_name}`);
    
    const lastMessage = user.last_message ? 
        (user.last_message.content || 'Media message') : 'No messages yet';
    
    const unreadBadge = user.unread_count > 0 ? 
        `<span class="unread-indicator">${user.unread_count}</span>` : '';
    
    const blockedBadge = user.is_blocked ? 
        `<span class="blocked-badge">Blocked</span>` : '';
    
    userDiv.innerHTML = `
        <div class="user-avatar">${user.first_name.charAt(0)}${user.last_name.charAt(0)}</div>
        <div class="user-info">
            <div class="user-name">${user.first_name} ${user.last_name} ${blockedBadge}</div>
            <div class="user-last-message">${escapeHtml(lastMessage)}</div>
        </div>
        <div class="user-time">${user.last_message ? formatMessageTime(user.last_message.sent_at) : ''}</div>
        <span class="user-status ${user.is_online ? 'online' : 'offline'}"></span>
        ${unreadBadge}
    `;
    
    container.appendChild(userDiv);
}

// Update user online status
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
    if (document.getElementById('admin-user-chat').classList.contains('active') &&
        document.getElementById('admin-user-chat').dataset.userId === userId) {
        document.getElementById('chat-user-status').textContent = isOnline ? 'online' : 'offline';
        document.getElementById('chat-user-status').className = isOnline ? 'online-status' : '';
    }
}

// Update user unread count
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

// Load channel messages for admin
async function loadChannelMessages() {
    try {
        const messages = await apiRequest('/api/channel/messages');
        const container = document.getElementById('admin-channel-messages');
        container.innerHTML = '';
        
        messages.forEach(message => {
            if (!message.is_deleted) {
                appendChannelMessageAdmin(message);
            }
        });
    } catch (error) {
        console.error('Load channel messages error:', error);
    }
}

function appendChannelMessageAdmin(message) {
    const container = document.getElementById('admin-channel-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'channel-message-item';
    messageDiv.dataset.messageId = message.id;
    
    let mediaHtml = '';
    if (message.media_url && message.media_type) {
        const fullUrl = `${BACKEND_URL}${message.media_url}`;
        if (message.media_type === 'image') {
            mediaHtml = `<div class="message-media"><img src="${fullUrl}" alt="Image"></div>`;
        } else if (message.media_type === 'video') {
            mediaHtml = `<div class="message-media"><video src="${fullUrl}" controls></video></div>`;
        }
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span>${formatMessageTime(message.sent_at)}</span>
            <button class="delete-message-btn" onclick="deleteChannelMessage('${message.id}')">Delete</button>
        </div>
        ${mediaHtml}
        <div class="message-content">${message.content ? linkify(escapeHtml(message.content)) : ''}</div>
    `;
    
    container.appendChild(messageDiv);
}

// Send channel message
document.getElementById('channel-message-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const content = document.getElementById('channel-content').value;
    const mediaFile = document.getElementById('channel-media').files[0];
    
    if (!content && !mediaFile) return;
    
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (mediaFile) formData.append('media', mediaFile);
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/channel/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
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
        playNotificationSound();
    } catch (error) {
        console.error('Send channel message error:', error);
        alert('Failed to send message');
    }
});

// Delete channel message
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

// Open user chat
let currentChatUserId = null;

function openUserChat(userId, userName) {
    hideAllPages();
    document.getElementById('admin-user-chat').classList.add('active');
    document.getElementById('admin-user-chat').dataset.userId = userId;
    document.getElementById('chat-user-name').textContent = userName;
    
    currentChatUserId = userId;
    
    loadUserMessages(userId);
}

async function loadUserMessages(userId) {
    try {
        const messages = await apiRequest(`/api/messages/direct/${userId}`);
        const container = document.getElementById('admin-user-messages');
        container.innerHTML = '';
        
        messages.forEach(message => {
            appendAdminDirectMessage(message);
        });
        
        container.scrollTop = container.scrollHeight;
        
        // Mark unread as read
        const unreadIds = messages
            .filter(m => !m.is_read && !m.is_from_admin)
            .map(m => m.id);
        
        if (unreadIds.length > 0) {
            markMessagesAsRead(unreadIds, true);
        }
    } catch (error) {
        console.error('Load user messages error:', error);
    }
}

function appendAdminDirectMessage(message) {
    const container = document.getElementById('admin-user-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-wrapper ${message.is_from_admin ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id;
    
    const contentHtml = message.content ? 
        `<div class="message-bubble ${message.is_from_admin ? 'sent' : 'received'}">${linkify(escapeHtml(message.content))}</div>` : '';
    
    messageDiv.innerHTML = `
        ${contentHtml}
        <div class="message-time">${formatMessageTime(message.sent_at)}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Send message to user
document.getElementById('admin-send-btn')?.addEventListener('click', sendAdminMessage);
document.getElementById('admin-message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAdminMessage();
    }
});

// Admin typing indicator
let adminTypingTimeout;
document.getElementById('admin-message-input')?.addEventListener('input', () => {
    if (!currentChatUserId) return;
    
    emitTyping(true, currentChatUserId, true);
    
    clearTimeout(adminTypingTimeout);
    adminTypingTimeout = setTimeout(() => {
        emitTyping(false, currentChatUserId, true);
    }, 1000);
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
        playNotificationSound();
        
        // Clear input
        input.value = '';
        
        // Add to UI
        appendAdminDirectMessage({
            ...message,
            is_from_admin: true
        });
    } catch (error) {
        console.error('Send admin message error:', error);
        alert(error.message);
    }
}

// Toggle block user
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
        } else {
            await apiRequest(`/api/admin/user/block/${currentChatUserId}`, {
                method: 'POST'
            });
            btn.classList.add('blocked');
            btn.style.background = '#dc3545';
        }
    } catch (error) {
        console.error('Toggle block error:', error);
        alert('Failed to update block status');
    }
}

// Handle review requests
function addReviewRequest(data) {
    // You can add a notification badge or list here
    console.log('Review request:', data);
}

// Load initial data
document.addEventListener('DOMContentLoaded', () => {
    if (getAdmin()) {
        loadAdminStats();
        loadUsers();
        loadChannelMessages();
    }
});