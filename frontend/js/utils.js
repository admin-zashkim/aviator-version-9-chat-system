// Notification System
const notificationSound = document.getElementById('notification-sound');

function playNotificationSound() {
    if (notificationSound) {
        notificationSound.currentTime = 0;
        notificationSound.play().catch(e => console.log('Sound play failed:', e));
    }
}

function showBrowserNotification(title, body) {
    if (!("Notification" in window)) {
        console.log("Browser doesn't support notifications");
        return;
    }
    
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: '/icons/channelIcon.png'
        });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification(title, {
                    body: body,
                    icon: '/icons/channelIcon.png'
                });
            }
        });
    }
}

function vibrate(pattern = 200) {
    if (window.navigator.vibrate) {
        window.navigator.vibrate(pattern);
    }
}

function triggerNotification(title, body) {
    playNotificationSound();
    showBrowserNotification(title, body);
    vibrate();
}

// Date formatting
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// URL detection and linking
function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

// Local storage helpers
function setToken(token) {
    localStorage.setItem('chat_token', token);
}

function getToken() {
    return localStorage.getItem('chat_token');
}

function setUser(user) {
    localStorage.setItem('chat_user', JSON.stringify(user));
}

function getUser() {
    const user = localStorage.getItem('chat_user');
    return user ? JSON.parse(user) : null;
}

function setAdmin(admin) {
    localStorage.setItem('chat_admin', JSON.stringify(admin));
}

function getAdmin() {
    const admin = localStorage.getItem('chat_admin');
    return admin ? JSON.parse(admin) : null;
}

function clearAuth() {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_admin');
}

// API helper
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                clearAuth();
                window.location.href = '/';
                return null;
            }
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}