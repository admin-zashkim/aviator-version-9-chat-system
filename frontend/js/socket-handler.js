// Check if socket.io is loaded
if (typeof io === 'undefined') {
    console.error('❌ CRITICAL: Socket.io not loaded! Make sure CDN is in HTML');
    console.error('📦 Add this to your HTML: <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>');
} else {
    console.log('✅ Socket.io loaded successfully. Version:', io.version);
}

let socket = null;

function initializeSocket() {
    // Double-check socket.io is available
    if (typeof io === 'undefined') {
        console.error('❌ Cannot initialize socket: io is not defined');
        console.error('💡 Fix: Add socket.io CDN to your HTML');
        return null;
    }
    
    const token = getToken();
    if (!token) {
        console.log('🔌 No token available, skipping socket initialization');
        return null;
    }
    
    console.log('🔌 Initializing socket with backend:', BACKEND_URL);
    
    try {
        // Disconnect existing socket if any
        if (socket && socket.connected) {
            console.log('🔄 Disconnecting existing socket');
            socket.disconnect();
        }
        
        socket = io(BACKEND_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 20000
        });
        
        socket.on('connect', () => {
            console.log('✅ Socket connected successfully! Socket ID:', socket.id);
            
            const user = getUser();
            const admin = getAdmin();
            
            if (user) {
                console.log('👤 User online:', user.email);
                socket.emit('user-online', { userId: user.id, userType: 'user' });
            } else if (admin) {
                console.log('👑 Admin online:', admin.username);
                socket.emit('user-online', { userId: admin.id, userType: 'admin' });
            }
        });
        
        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            console.log('🔄 Retrying connection...');
        });
        
        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected. Reason:', reason);
            if (reason === 'io server disconnect') {
                setTimeout(() => {
                    console.log('🔄 Attempting to reconnect...');
                    socket.connect();
                }, 1000);
            }
        });
        
        socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });
        
        socket.on('reconnect', (attemptNumber) => {
            console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
        });
        
        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('🔄 Reconnection attempt #', attemptNumber);
        });
        
        // Channel messages
        socket.on('channel-message', (message) => {
            console.log('📢 Channel message received:', message);
            
            const channelChat = document.getElementById('channel-chat');
            if (channelChat && channelChat.classList.contains('active')) {
                if (typeof appendChannelMessage === 'function') {
                    appendChannelMessage(message);
                }
            }
            
            if (typeof triggerNotification === 'function') {
                triggerNotification('Channel', message.content || 'New media message');
            }
        });
        
        socket.on('channel-message-deleted', (data) => {
            console.log('🗑️ Channel message deleted:', data);
            const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
        });
        
        // Direct messages
        socket.on('direct-message', (message) => {
            console.log('💬 Direct message received:', message);
            
            const admin = getAdmin();
            const user = getUser();
            const adminUserChat = document.getElementById('admin-user-chat');
            const adminDirectChat = document.getElementById('admin-direct-chat');
            
            if (admin && adminUserChat && adminUserChat.classList.contains('active')) {
                const currentUserId = adminUserChat.dataset.userId;
                if (message.user_id === currentUserId) {
                    if (typeof appendAdminDirectMessage === 'function') {
                        appendAdminDirectMessage(message);
                    }
                    if (typeof markMessagesAsRead === 'function') {
                        markMessagesAsRead([message.id], true);
                    }
                }
            } else if (user && adminDirectChat && adminDirectChat.classList.contains('active')) {
                if (typeof appendUserDirectMessage === 'function') {
                    appendUserDirectMessage(message);
                }
                if (typeof markMessagesAsRead === 'function') {
                    markMessagesAsRead([message.id], false);
                }
            }
            
            if (admin && message.user_id && typeof updateUserUnreadCount === 'function') {
                updateUserUnreadCount(message.user_id);
            } else if (user && !message.is_from_admin && typeof updateAdminUnreadBadge === 'function') {
                updateAdminUnreadBadge();
            }
            
            if (typeof triggerNotification === 'function') {
                if (admin) {
                    triggerNotification(`User ${message.user?.first_name || ''}`, message.content);
                } else if (user && message.is_from_admin) {
                    triggerNotification('Admin', message.content);
                }
            }
        });
        
        // Notifications
        socket.on('notification', (data) => {
            console.log('🔔 Notification received:', data);
            if (data.sound && typeof playNotificationSound === 'function') playNotificationSound();
            if (data.vibrate && typeof vibrate === 'function') vibrate();
            if (data.title && data.body && typeof showBrowserNotification === 'function') {
                showBrowserNotification(data.title, data.body);
            }
        });
        
        // Online status updates
        socket.on('online-count', (count) => {
            console.log('👥 Online count:', count);
            const channelMembers = document.getElementById('channel-members');
            if (channelMembers) {
                channelMembers.textContent = `${count} members`;
            }
        });
        
        socket.on('user-status-change', (data) => {
            console.log('🟢 User status change:', data);
            if (typeof updateUserOnlineStatus === 'function') {
                updateUserOnlineStatus(data.userId, data.isOnline);
            }
        });
        
        // Admin typing
        socket.on('admin-typing', (data) => {
            if (data.isTyping && typeof showTypingIndicator === 'function') {
                showTypingIndicator('admin');
            } else if (typeof hideTypingIndicator === 'function') {
                hideTypingIndicator('admin');
            }
        });
        
        // User typing
        socket.on('user-typing', (data) => {
            if (data.isTyping && typeof showTypingIndicator === 'function') {
                showTypingIndicator('user', data.userId);
            } else if (typeof hideTypingIndicator === 'function') {
                hideTypingIndicator('user', data.userId);
            }
        });
        
        // Messages read
        socket.on('messages-read', (data) => {
            console.log('👁️ Messages read:', data);
            if (data.messageIds && Array.isArray(data.messageIds)) {
                data.messageIds.forEach(id => {
                    const messageElement = document.querySelector(`[data-message-id="${id}"]`);
                    if (messageElement) {
                        messageElement.classList.add('read');
                    }
                });
            }
        });
        
        // Block/Unblock events
        socket.on('user-blocked', (data) => {
            console.log('🚫 User blocked:', data);
            if (getUser() && typeof showBlockedOverlay === 'function') {
                showBlockedOverlay(data.message);
            }
        });
        
        socket.on('user-unblocked', (data) => {
            console.log('✅ User unblocked:', data);
            if (getUser() && typeof hideBlockedOverlay === 'function') {
                hideBlockedOverlay();
            }
        });
        
        // Review responses
        socket.on('review-approved', (data) => {
            console.log('✅ Review approved:', data);
            alert(data.message);
            if (typeof hideBlockedOverlay === 'function') {
                hideBlockedOverlay();
            }
        });
        
        socket.on('review-rejected', (data) => {
            console.log('❌ Review rejected:', data);
            alert(data.message);
            if (typeof updateReviewAttempts === 'function') {
                updateReviewAttempts(data.attemptsLeft, data.cooldown);
            }
        });
        
        socket.on('review-request', (data) => {
            console.log('📝 Review request:', data);
            if (getAdmin() && typeof addReviewRequest === 'function') {
                addReviewRequest(data);
            }
            if (typeof triggerNotification === 'function') {
                triggerNotification('Review Request', `${data.userName} requested review (Attempt ${data.attempt})`);
            }
        });
        
        return socket;
        
    } catch (error) {
        console.error('❌ Socket initialization error:', error);
        return null;
    }
}

// Socket emit helpers
function emitTyping(isTyping, recipientId, isAdmin = false) {
    if (!socket || !socket.connected) {
        console.log('⚠️ Cannot emit typing: socket not connected');
        return;
    }
    
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
    if (!socket || !socket.connected || !messageIds || !messageIds.length) {
        return;
    }
    
    const user = getUser();
    const admin = getAdmin();
    
    socket.emit('mark-read', {
        messageIds,
        userId: user?.id || admin?.id,
        isAdmin
    });
}

// Auto-initialize if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    const user = getUser();
    const admin = getAdmin();
    
    if (token && (user || admin)) {
        console.log('🔄 Auto-initializing socket on page load');
        setTimeout(initializeSocket, 1000);
    }
});
