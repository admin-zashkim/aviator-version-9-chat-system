// Use the global variable from config.js with fallback
const BACKEND_URL = window.BACKEND_URL || 'https://backendchatv9admin.onrender.com';
console.log('🚀 Backend URL:', BACKEND_URL);

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
    
    // Get form values
    const firstName = document.getElementById('signup-firstname').value.trim();
    const lastName = document.getElementById('signup-lastname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    // Validate
    if (!firstName || !lastName || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password !== confirm) {
        alert('❌ Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        alert('❌ Password must be at least 6 characters');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;
    
    try {
        console.log('📝 Signup attempt for:', email);
        
        const response = await fetch(`${BACKEND_URL}/api/auth/user/signup`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ firstName, lastName, email, password })
        });
        
        // Get response text first
        const responseText = await response.text();
        console.log('📥 Raw response:', responseText);
        
        // Parse JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Failed to parse JSON:', responseText);
            alert('Server error: Invalid response format');
            return;
        }
        
        if (response.ok && data.success) {
            console.log('✅ Signup successful!');
            
            // Save auth data
            setToken(data.token);
            setUser(data.user);
            
            // Request notification permission
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                await Notification.requestPermission();
            }
            
            // Initialize socket and show dashboard
            if (typeof initializeSocket === 'function') {
                initializeSocket();
            }
            
            showUserDashboard();
            document.getElementById('user-name').textContent = `${data.user.first_name} ${data.user.last_name}`;
            
            // Check block status
            if (typeof checkUserBlockStatus === 'function') {
                checkUserBlockStatus();
            }
            
            alert('✅ Account created successfully!');
        } else {
            console.log('❌ Signup failed:', data.error || 'Unknown error');
            alert(`❌ Signup failed: ${data.error || 'Please try again'}`);
        }
    } catch (error) {
        console.error('🔥 Signup error:', error);
        alert(`❌ Connection error: ${error.message}. Check if backend is running at ${BACKEND_URL}`);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// User Login
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
        console.log('🔐 Login attempt for:', email);
        console.log('🌐 Backend URL:', BACKEND_URL);
        
        const response = await fetch(`${BACKEND_URL}/api/auth/user/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('📥 Response status:', response.status);
        
        // Get response text first
        const responseText = await response.text();
        console.log('📥 Raw response:', responseText);
        
        // Parse JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Failed to parse JSON:', responseText);
            alert('Server error: Invalid response format');
            return;
        }
        
        if (response.ok && data.success) {
            console.log('✅ Login successful!');
            
            // Save auth data
            setToken(data.token);
            setUser(data.user);
            
            // Request notification permission
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                await Notification.requestPermission();
            }
            
            // Initialize socket
            if (typeof initializeSocket === 'function') {
                initializeSocket();
            }
            
            // Show dashboard
            showUserDashboard();
            document.getElementById('user-name').textContent = `${data.user.first_name} ${data.user.last_name}`;
            
            // Check block status
            if (typeof checkUserBlockStatus === 'function') {
                checkUserBlockStatus();
            }
        } else {
            console.log('❌ Login failed:', data.error || 'Invalid credentials');
            alert(`❌ Login failed: ${data.error || 'Invalid email or password'}`);
        }
    } catch (error) {
        console.error('🔥 Login error:', error);
        alert(`❌ Connection error: ${error.message}. Make sure backend is running at ${BACKEND_URL}`);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Admin Login
document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
        console.log('👤 Admin login attempt for:', username);
        
        const response = await fetch(`${BACKEND_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        // Get response text first
        const responseText = await response.text();
        console.log('📥 Raw response:', responseText);
        
        // Parse JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Failed to parse JSON:', responseText);
            alert('Server error: Invalid response format');
            return;
        }
        
        if (response.ok && data.success) {
            console.log('✅ Admin login successful!');
            
            setToken(data.token);
            setAdmin(data.admin);
            
            if (typeof initializeSocket === 'function') {
                initializeSocket();
            }
            
            showAdminDashboard();
            
            // Load admin data
            if (typeof loadAdminStats === 'function') loadAdminStats();
            if (typeof loadUsers === 'function') loadUsers();
            if (typeof loadChannelMessages === 'function') loadChannelMessages();
        } else {
            console.log('❌ Admin login failed:', data.error || 'Invalid credentials');
            alert(`❌ Login failed: ${data.error || 'Invalid username or password'}`);
        }
    } catch (error) {
        console.error('🔥 Admin login error:', error);
        alert(`❌ Connection error: ${error.message}`);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Logout
async function logout() {
    const user = getUser();
    const admin = getAdmin();
    
    try {
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
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    if (typeof socket !== 'undefined' && socket) {
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
            const overlay = document.getElementById('blocked-overlay');
            const reviewBtn = document.getElementById('review-btn');
            const attemptsLeft = document.getElementById('attempts-left');
            
            if (overlay) overlay.style.display = 'block';
            
            if (data.isPermanentlyBlocked) {
                if (overlay) overlay.querySelector('p').textContent = 'You are permanently blocked';
                if (reviewBtn) reviewBtn.disabled = true;
            } else {
                if (overlay) overlay.querySelector('p').textContent = 'You have been blocked by admin';
                if (attemptsLeft) {
                    attemptsLeft.textContent = `Attempts left: ${3 - data.attempts}`;
                }
                
                if (data.lastRequest) {
                    const lastRequest = new Date(data.lastRequest);
                    const hoursSince = (Date.now() - lastRequest) / (1000 * 60 * 60);
                    if (hoursSince < 6 && reviewBtn) {
                        reviewBtn.disabled = true;
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
    console.log('📱 App loaded, checking authentication...');
    
    const token = getToken();
    const user = getUser();
    const admin = getAdmin();
    
    if (token) {
        if (user) {
            console.log('👤 User authenticated:', user.email);
            if (typeof initializeSocket === 'function') {
                initializeSocket();
            }
            showUserDashboard();
            document.getElementById('user-name').textContent = `${user.first_name} ${user.last_name}`;
            checkUserBlockStatus();
        } else if (admin) {
            console.log('👑 Admin authenticated:', admin.username);
            if (typeof initializeSocket === 'function') {
                initializeSocket();
            }
            showAdminDashboard();
            if (typeof loadAdminStats === 'function') loadAdminStats();
            if (typeof loadUsers === 'function') loadUsers();
            if (typeof loadChannelMessages === 'function') loadChannelMessages();
        }
    } else {
        console.log('🔓 No authentication found, showing login');
        showUserAuth();
    }
});
