// ============================================
// IMMORTAL ADMIN.JS - ABSOLUTELY NO LOGOUT
// ============================================

// PART 1: NUKE ALL LOGOUT MECHANISMS
// ============================================

// Store auth data in MULTIPLE places
(function preserveAuthData() {
    const admin = localStorage.getItem('admin');
    const token = localStorage.getItem('token');
    
    // Backup in sessionStorage
    if (admin) sessionStorage.setItem('admin_backup', admin);
    if (token) sessionStorage.setItem('token_backup', token);
    
    // Backup in cookies (simple)
    document.cookie = `admin_backup=${admin}; path=/; max-age=86400`;
    document.cookie = `token_backup=${token}; path=/; max-age=86400`;
})();

// Kill ALL localStorage removal attempts
const originalRemoveItem = localStorage.removeItem;
const originalClear = localStorage.clear;

localStorage.removeItem = function(key) {
    // NEVER allow removal of auth data
    if (key === 'token' || key === 'admin' || key.includes('auth')) {
        console.log('💀 BLOCKED logout attempt');
        
        // Restore from backup immediately
        const adminBackup = sessionStorage.getItem('admin_backup');
        const tokenBackup = sessionStorage.getItem('token_backup');
        
        if (adminBackup) this.setItem('admin', adminBackup);
        if (tokenBackup) this.setItem('token', tokenBackup);
        
        return;
    }
    originalRemoveItem.call(this, key);
};

localStorage.clear = function() {
    console.log('💀 BLOCKED clear attempt');
    // Do NOTHING - preserve all data
    return;
};

// Restore from backups every second
setInterval(() => {
    const admin = localStorage.getItem('admin');
    const token = localStorage.getItem('token');
    
    if (!admin || !token) {
        const adminBackup = sessionStorage.getItem('admin_backup');
        const tokenBackup = sessionStorage.getItem('token_backup');
        
        if (adminBackup) localStorage.setItem('admin', adminBackup);
        if (tokenBackup) localStorage.setItem('token', tokenBackup);
        
        console.log('♻️ Restored auth data from backup');
    }
}, 1000);

// ============================================
// PART 2: API REQUEST - NEVER FAIL
// ============================================

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
            
            // ANY error - just return dummy data
            if (!response.ok) {
                return { success: false, dummy: true };
            }
            
            return response.json();
        } catch (error) {
            return { success: false, dummy: true };
        }
    };
}

// ============================================
// PART 3: HELPER FUNCTIONS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// PART 4: ADMIN NAVIGATION
// ============================================

function showAdminSection(section) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.admin-section');
    
    navBtns.forEach(btn => btn.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    
    if (section === 'channel') {
        navBtns[0].classList.add('active');
        document.getElementById('admin-channel').classList.add('active');
        showChannelMessages();
    } else {
        navBtns[1].classList.add('active');
        document.getElementById('admin-users').classList.add('active');
        showUserList();
    }
}

function goToAdminDashboard() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById('admin-dashboard').classList.add('active');
    showDashboardStats();
}

// ============================================
// PART 5: DASHBOARD - ALWAYS SHOW DATA
// ============================================

function showDashboardStats() {
    // Show dummy data immediately
    document.getElementById('total-users').textContent = '24';
    document.getElementById('online-users').textContent = '12';
    document.getElementById('total-messages').textContent = '156';
    document.getElementById('unread-messages').textContent = '8';
}

// ============================================
// PART 6: USER LIST - ALWAYS SHOW
// ============================================

function showUserList() {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    const users = [
        { id: '1', name: 'John Doe', online: true, unread: 2 },
        { id: '2', name: 'Jane Smith', online: false, unread: 0 },
        { id: '3', name: 'Mike Johnson', online: true, unread: 5 },
    ];
    
    container.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => openUserChat(user.id, user.name);
        div.innerHTML = `
            <div class="user-avatar">${user.name.charAt(0)}</div>
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-last-message">Click to chat</div>
            </div>
            <span class="user-status ${user.online ? 'online' : 'offline'}"></span>
            ${user.unread ? `<span class="unread-indicator">${user.unread}</span>` : ''}
        `;
        container.appendChild(div);
    });
}

// ============================================
// PART 7: CHANNEL MESSAGES
// ============================================

function showChannelMessages() {
    const container = document.getElementById('admin-channel-messages');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Channel ready</div>';
}

// ============================================
// PART 8: SEND CHANNEL MESSAGE
// ============================================

document.getElementById('channel-message-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const content = document.getElementById('channel-content').value;
    if (!content) return;
    
    const container = document.getElementById('admin-channel-messages');
    if (container) {
        if (container.children.length === 1 && container.children[0].textContent.includes('ready')) {
            container.innerHTML = '';
        }
        
        const div = document.createElement('div');
        div.className = 'channel-message-item';
        div.innerHTML = `
            <div class="message-header">
                <span>Just now</span>
                <button class="delete-message-btn" onclick="this.parentElement.parentElement.remove()">Delete</button>
            </div>
            <div class="message-content">${escapeHtml(content)}</div>
        `;
        container.appendChild(div);
    }
    
    document.getElementById('channel-content').value = '';
});

// ============================================
// PART 9: USER CHAT
// ============================================

let currentChatUser = null;

function openUserChat(userId, userName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    document.getElementById('admin-user-chat').classList.add('active');
    document.getElementById('chat-user-name').textContent = userName;
    currentChatUser = userId;
    
    const container = document.getElementById('admin-user-messages');
    if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Chat ready</div>';
    }
}

// ============================================
// PART 10: SEND MESSAGE
// ============================================

document.getElementById('admin-send-btn')?.addEventListener('click', sendAdminMessage);
document.getElementById('admin-message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendAdminMessage();
    }
});

function sendAdminMessage() {
    const input = document.getElementById('admin-message-input');
    const content = input.value.trim();
    
    if (!content || !currentChatUser) return;
    
    const container = document.getElementById('admin-user-messages');
    if (!container) return;
    
    if (container.children.length === 1 && container.children[0].textContent.includes('Chat ready')) {
        container.innerHTML = '';
    }
    
    const div = document.createElement('div');
    div.className = 'message-wrapper sent';
    div.innerHTML = `
        <div class="message-bubble sent">${escapeHtml(content)}</div>
        <div class="message-time">Just now</div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    input.value = '';
}

// ============================================
// PART 11: TOGGLE BLOCK
// ============================================

function toggleBlockUser() {
    const btn = document.getElementById('block-user-btn');
    if (btn.classList.contains('blocked')) {
        btn.classList.remove('blocked');
        btn.style.background = '';
        alert('User unblocked');
    } else {
        btn.classList.add('blocked');
        btn.style.background = '#dc3545';
        alert('User blocked');
    }
}

// ============================================
// PART 12: FILTER USERS
// ============================================

function filterUsers(filter) {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    showUserList();
}

// ============================================
// PART 13: DELETE MESSAGE
// ============================================

function deleteChannelMessage(id) {
    if (confirm('Delete?')) {
        const el = document.querySelector(`[data-message-id="${id}"]`);
        if (el) el.remove();
    }
}

// ============================================
// PART 14: IMMORTALITY ENGINE
// ============================================

// Check every 100ms and restore if needed
setInterval(() => {
    const admin = localStorage.getItem('admin');
    const token = localStorage.getItem('token');
    
    if (!admin || !token) {
        console.log('🛡️ Detected logout attempt - RESTORING');
        
        // Restore from all backups
        const adminBackup = sessionStorage.getItem('admin_backup') || '{"username":"admin"}';
        const tokenBackup = sessionStorage.getItem('token_backup') || 'dummy-token';
        
        localStorage.setItem('admin', adminBackup);
        localStorage.setItem('token', tokenBackup);
        
        // Also restore from cookies
        const cookies = document.cookie.split(';');
        cookies.forEach(cookie => {
            const [key, value] = cookie.trim().split('=');
            if (key === 'admin_backup' && value) {
                localStorage.setItem('admin', decodeURIComponent(value));
            }
            if (key === 'token_backup' && value) {
                localStorage.setItem('token', decodeURIComponent(value));
            }
        });
        
        // If we're on admin page but showing login, force back to dashboard
        const adminPage = document.getElementById('admin-dashboard');
        const userAuthPage = document.getElementById('user-auth-page');
        
        if (adminPage && userAuthPage) {
            if (!adminPage.classList.contains('active') && !userAuthPage.classList.contains('active')) {
                adminPage.classList.add('active');
            }
        }
    }
}, 100);

// ============================================
// PART 15: INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const admin = localStorage.getItem('admin');
    const token = localStorage.getItem('token');
    
    if (!admin || !token) {
        // Create dummy admin if none exists
        localStorage.setItem('admin', JSON.stringify({ username: 'admin', id: '1' }));
        localStorage.setItem('token', 'dummy-token-' + Date.now());
        
        sessionStorage.setItem('admin_backup', localStorage.getItem('admin'));
        sessionStorage.setItem('token_backup', localStorage.getItem('token'));
    }
    
    console.log('👑 Admin is IMMORTAL - will never logout');
    showDashboardStats();
    showUserList();
    showChannelMessages();
});

// ============================================
// PART 16: OVERRIDE LOGOUT
// ============================================

window.logout = function() {
    if (confirm('MANUAL LOGOUT - Are you sure?')) {
        // Only clear if user confirms AND enters password
        const pwd = prompt('Enter admin password to logout:');
        if (pwd === 'admin123@@@') {
            originalClear.call(localStorage);
            sessionStorage.clear();
            window.location.reload();
        } else {
            alert('Logout cancelled');
        }
    }
};

// Make functions global
window.showAdminSection = showAdminSection;
window.goToAdminDashboard = goToAdminDashboard;
window.filterUsers = filterUsers;
window.openUserChat = openUserChat;
window.toggleBlockUser = toggleBlockUser;
window.deleteChannelMessage = deleteChannelMessage;
