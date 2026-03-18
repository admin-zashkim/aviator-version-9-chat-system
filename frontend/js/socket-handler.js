let socket = null;

function initializeSocket() {
    const token = getToken();
    if (!token) return;
    
    socket = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket']
    });
    
    socket.on('connect', () => {
        console.log('Socket connected');
        
        const user = getUser();
        const admin = getAdmin();
        
        if (user) {
            socket.emit('user-online', { userId: user.id, userType: 'user' });
        } else if (admin) {
            socket.emit('user-online', { userId: admin.id, userType: 'admin' });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
    
    // Channel messages
    socket.on('channel-message', (message) => {
        if (document.getElementById('channel-chat').classList.contains('active')) {
            appendChannelMessage(message);
        }
        
        // Update unread count in background
        if (!document.getElementById('channel-chat').classList.contains('active')) {
            updateChannelUnread(message.id);
        }
        
        triggerNotification('Channel', message.content || 'New media message');
    });
    
    socket.on('channel-message-deleted', (data) => {
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });
    
    // Direct messages
    socket.on('direct-message', (message) => {
        const admin = getAdmin();
        const user = getUser();
        
        if (admin && document.getElementById('admin-user-chat').classList.contains('active')) {
            const currentUserId = document.getElementById('admin-user-chat').dataset.userId;
            if (message.user_id === currentUserId) {
                appendAdminDirectMessage(message);
                markMessagesAsRead([message.id], true);
            }
        } else if (user && document.getElementById('admin-direct-chat').classList.contains('active')) {
            appendUserDirectMessage(message);
            markMessagesAsRead([message.id], false);
        }
        
        // Update unread badge
        if (admin && message.user_id) {
            updateUserUnreadCount(message.user_id);
        } else if (user && !message.is_from_admin) {
            updateAdminUnreadBadge();
        }
        
        // Trigger notification
        if (admin) {
            triggerNotification(`User ${message.user?.first_name || ''}`, message.content);
        } else if (user && message.is_from_admin) {
            triggerNotification('Admin', message.content);
        }
    });
    
    // Notifications
    socket.on('notification', (data) => {
        if (data.sound) playNotificationSound();
        if (data.vibrate) vibrate();
        if (data.title && data.body) {
            showBrowserNotification(data.title, data.body);
        }
    });
    
    // Online status updates
    socket.on('online-count', (count) => {
        const channelMembers = document.getElementById('channel-members');
        if (channelMembers) {
            channelMembers.textContent = `${count} members`;
        }
    });
    
    socket.on('user-status-change', (data) => {
        updateUserOnlineStatus(data.userId, data.isOnline);
    });
    
    // Admin typing
    socket.on('admin-typing', (data) => {
        if (data.isTyping) {
            showTypingIndicator('admin');
        } else {
            hideTypingIndicator('admin');
        }
    });
    
    // User typing
    socket.on('user-typing', (data) => {
        if (data.isTyping) {
            showTypingIndicator('user', data.userId);
        } else {
            hideTypingIndicator('user', data.userId);
        }
    });
    
    // Messages read
    socket.on('messages-read', (data) => {
        data.messageIds.forEach(id => {
            const messageElement = document.querySelector(`[data-message-id="${id}"]`);
            if (messageElement) {
                messageElement.classList.add('read');
            }
        });
    });
    
    // Block/Unblock events
    socket.on('user-blocked', (data) => {
        if (getUser()) {
            showBlockedOverlay(data.message);
        }
    });
    
    socket.on('user-unblocked', (data) => {
        if (getUser()) {
            hideBlockedOverlay();
        }
    });
    
    // Review responses
    socket.on('review-approved', (data) => {
        alert(data.message);
        hideBlockedOverlay();
    });
    
    socket.on('review-rejected', (data) => {
        alert(data.message);
        updateReviewAttempts(data.attemptsLeft, data.cooldown);
    });
    
    socket.on('review-request', (data) => {
        if (getAdmin()) {
            addReviewRequest(data);
            triggerNotification('Review Request', `${data.userName} requested review (Attempt ${data.attempt})`);
        }
    });
}

// Socket emit helpers
function emitTyping(isTyping, recipientId, isAdmin = false) {
    if (!socket) return;
    
    const user = getUser();
    const admin = getAdmin();
    
    socket.emit('typing', {
        userId: user?.id || admin?.id,
        isTyping,
        recipientId,
        isAdmin
    });
}

function markMessagesAsRead(messageIds, isAdmin = false) {
    if (!socket || !messageIds.length) return;
    
    const user = getUser();
    const admin = getAdmin();
    
    socket.emit('mark-read', {
        messageIds,
        userId: user?.id || admin?.id,
        isAdmin
    });
}