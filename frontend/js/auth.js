// Use the global variable from config.js
const BACKEND_URL = window.BACKEND_URL || 'https://backendchatv9admin.onrender.com';

// Show/hide pages
function showUserAuth() {
    hideAllPages();
    document.getElementById('user-auth-page').classList.add('active');
}

function showAdminLogin() {
    hideAllPages();
    document.getElementById('admin-auth-page').classList.add('active');
}

function showUserDashboard() {
    hideAllPages();
    document.getElementById('user-dashboard').classList.add('active');
}

function showAdminDashboard() {
    hideAllPages();
    document.getElementById('admin-dashboard').classList.add('active');
}

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
}

// Auth tabs
function showAuthTab(tab) {
    const tabs = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    
    if (tab === 'login') {
        tabs[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('signup-form').classList.add('active');
    }
}

// User Signup
document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('signup-firstname').value;
    const lastName = document.getElementById('signup-lastname').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (password !== confirm) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            setToken(data.token);
            setUser(data.user);
            
            // Request notification permission
            if (Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
            
            initializeSocket();
            showUserDashboard();
            document.getElementById('user-name').textContent = `${data.user.first_name} ${data.user.last_name}`;
        } else {
            alert(data.error || 'Signup failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed. Please try again.');
    }
});

// User Login
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            setToken(data.token);
            setUser(data.user);
            
            // Request notification permission
            if (Notification.permission !== 'granted') {
                Notification.requestPermission();
            }
            
            initializeSocket();
            showUserDashboard();
            document.getElementById('user-name').textContent = `${data.user.first_name} ${data.user.last_name}`;
            
            // Check block status
            checkUserBlockStatus();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});

// Admin Login
document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            setToken(data.token);
            setAdmin(data.admin);
            
            initializeSocket();
            showAdminDashboard();
            loadAdminStats();
            loadUsers();
            loadChannelMessages();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        alert('Login failed. Please try again.');
    }
});

// Logout
async function logout() {
    const user = getUser();
    const admin = getAdmin();
    
    if (user) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
        });
    } else if (admin) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: admin.id })
        });
    }
    
    if (socket) {
        socket.disconnect();
    }
    
    clearAuth();
    showUserAuth();
}

// Check if user is blocked
async function checkUserBlockStatus() {
    try {
        const data = await apiRequest('/api/user/block-status');
        
        if (data.isBlocked) {
            if (data.isPermanentlyBlocked) {
                showBlockedOverlay('You are permanently blocked');
                document.getElementById('review-btn').disabled = true;
            } else {
                showBlockedOverlay('You have been blocked by admin');
                document.getElementById('attempts-left').textContent = 
                    `Attempts left: ${3 - data.attempts}`;
                
                if (data.lastRequest) {
                    const lastRequest = new Date(data.lastRequest);
                    const hoursSince = (Date.now() - lastRequest) / (1000 * 60 * 60);
                    if (hoursSince < 6) {
                        document.getElementById('review-btn').disabled = true;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Check block status error:', error);
    }
}

// Check auth on load
document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    const user = getUser();
    const admin = getAdmin();
    
    if (token) {
        if (user) {
            initializeSocket();
            showUserDashboard();
            document.getElementById('user-name').textContent = `${user.first_name} ${user.last_name}`;
            checkUserBlockStatus();
        } else if (admin) {
            initializeSocket();
            showAdminDashboard();
            loadAdminStats();
            loadUsers();
            loadChannelMessages();
        }
    } else {
        showUserAuth();
    }
});