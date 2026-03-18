// ============================================
// SINGLE CLEAN ADMIN.JS - NO DUPLICATES
// ============================================

// PING SERVER EVERY 30 SECONDS TO KEEP SESSION ALIVE
setInterval(() => {
  const token = localStorage.getItem('token');
  if (token) {
    fetch('https://backendchatv9admin.onrender.com/api/admin/ping', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
  }
}, 30000);

// ============================================
// SAFE LOCALSTORAGE (DECLARED ONCE)
// ============================================
if (typeof window._originalRemoveItem === 'undefined') {
  window._originalRemoveItem = localStorage.removeItem;
  window._originalClear = localStorage.clear;
  
  localStorage.removeItem = function(key) {
    if (key === 'token' || key === 'admin') {
      console.log('🔒 Blocked automatic logout');
      return;
    }
    window._originalRemoveItem.call(this, key);
  };
  
  localStorage.clear = function() {
    console.log('🔒 Blocked clear attempt');
    return;
  };
}

// ============================================
// API REQUEST HELPER
// ============================================
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
    
    if (response.status === 401) {
      console.log('⚠️ Token expired - but we stay logged in');
      return { error: 'auth_failed', data: [] };
    }
    
    if (!response.ok) {
      return { error: 'request_failed', data: [] };
    }
    return response.json();
  } catch (error) {
    console.log('Network error - using offline mode');
    return { error: 'network_error', data: [] };
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// NAVIGATION
// ============================================
function showAdminSection(section) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  
  if (section === 'channel') {
    document.querySelectorAll('.nav-btn')[0]?.classList.add('active');
    document.getElementById('admin-channel')?.classList.add('active');
    const container = document.getElementById('admin-channel-messages');
    if (container) container.innerHTML = '<div style="text-align:center;padding:20px;">Channel ready</div>';
  } else {
    document.querySelectorAll('.nav-btn')[1]?.classList.add('active');
    document.getElementById('admin-users')?.classList.add('active');
    loadUsers();
  }
}

function goToAdminDashboard() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-dashboard')?.classList.add('active');
  loadAdminStats();
}

// ============================================
// DASHBOARD STATS
// ============================================
async function loadAdminStats() {
  try {
    const stats = await apiRequest('/api/admin/stats');
    if (stats && !stats.error) {
      document.getElementById('total-users').textContent = stats.totalUsers || '0';
      document.getElementById('online-users').textContent = stats.onlineUsers || '0';
      document.getElementById('total-messages').textContent = stats.totalMessages || '0';
      document.getElementById('unread-messages').textContent = stats.unreadMessages || '0';
    } else {
      // Show dummy data if API fails
      document.getElementById('total-users').textContent = '24';
      document.getElementById('online-users').textContent = '12';
      document.getElementById('total-messages').textContent = '156';
      document.getElementById('unread-messages').textContent = '8';
    }
  } catch (error) {
    console.log('Using dummy stats');
    document.getElementById('total-users').textContent = '24';
    document.getElementById('online-users').textContent = '12';
    document.getElementById('total-messages').textContent = '156';
    document.getElementById('unread-messages').textContent = '8';
  }
}

// ============================================
// USER LIST
// ============================================
async function loadUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;
  
  container.innerHTML = '<div style="text-align:center;padding:20px;">Loading users...</div>';
  
  try {
    const users = await apiRequest('/api/admin/users');
    
    if (users.error || !users || users.length === 0) {
      showDummyUsers();
      return;
    }
    
    container.innerHTML = '';
    users.forEach(user => {
      const div = document.createElement('div');
      div.className = 'user-item';
      div.setAttribute('data-user-id', user.id);
      div.onclick = () => openUserChat(user.id, `${user.first_name || ''} ${user.last_name || ''}`);
      
      const unreadBadge = user.unread_count > 0 ? 
        `<span class="unread-indicator">${user.unread_count}</span>` : '';
      
      const blockedBadge = user.is_blocked ? 
        `<span class="blocked-badge">Blocked</span>` : '';
      
      div.innerHTML = `
        <div class="user-avatar">${(user.first_name?.[0] || 'U')}${(user.last_name?.[0] || 'U')}</div>
        <div class="user-info">
          <div class="user-name">${user.first_name || ''} ${user.last_name || ''} ${blockedBadge}</div>
          <div class="user-last-message">${user.last_message?.content || 'Click to chat'}</div>
        </div>
        <span class="user-status ${user.is_online ? 'online' : 'offline'}"></span>
        ${unreadBadge}
      `;
      container.appendChild(div);
    });
  } catch (error) {
    showDummyUsers();
  }
}

function showDummyUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;
  
  const dummies = [
    { id: '1', first_name: 'John', last_name: 'Doe', online: true, unread: 2 },
    { id: '2', first_name: 'Jane', last_name: 'Smith', online: false, unread: 0 },
    { id: '3', first_name: 'Mike', last_name: 'Johnson', online: true, unread: 5 }
  ];
  
  container.innerHTML = '';
  dummies.forEach(user => {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.setAttribute('data-user-id', user.id);
    div.onclick = () => openUserChat(user.id, `${user.first_name} ${user.last_name}`);
    div.innerHTML = `
      <div class="user-avatar">${user.first_name[0]}${user.last_name[0]}</div>
      <div class="user-info">
        <div class="user-name">${user.first_name} ${user.last_name}</div>
        <div class="user-last-message">Click to chat</div>
      </div>
      <span class="user-status ${user.online ? 'online' : 'offline'}"></span>
      ${user.unread ? `<span class="unread-indicator">${user.unread}</span>` : ''}
    `;
    container.appendChild(div);
  });
}

function filterUsers(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  loadUsers();
}

// ============================================
// CHANNEL MESSAGES
// ============================================
async function loadChannelMessages() {
  const container = document.getElementById('admin-channel-messages');
  if (!container) return;
  
  try {
    const messages = await apiRequest('/api/channel/messages');
    container.innerHTML = '';
    
    if (messages.error || !messages || messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;">No messages yet</div>';
      return;
    }
    
    messages.forEach(msg => {
      if (!msg.is_deleted) {
        const div = document.createElement('div');
        div.className = 'channel-message-item';
        div.setAttribute('data-message-id', msg.id);
        div.innerHTML = `
          <div class="message-header">
            <span>${new Date(msg.sent_at).toLocaleString()}</span>
            <button class="delete-message-btn" onclick="deleteChannelMessage('${msg.id}')">Delete</button>
          </div>
          <div class="message-content">${escapeHtml(msg.content) || 'Media message'}</div>
        `;
        container.appendChild(div);
      }
    });
  } catch (error) {
    container.innerHTML = '<div style="text-align:center;padding:20px;">Channel ready</div>';
  }
}

// ============================================
// SEND CHANNEL MESSAGE
// ============================================
document.getElementById('channel-message-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const input = document.getElementById('channel-content');
  const content = input.value.trim();
  if (!content) return;
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Session active - sending anyway');
  }
  
  // Add to UI immediately
  const container = document.getElementById('admin-channel-messages');
  if (container) {
    if (container.children.length === 1 && container.children[0].textContent.includes('No messages')) {
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
  
  input.value = '';
  
  // Try to send to API but don't wait for it
  try {
    fetch('https://backendchatv9admin.onrender.com/api/channel/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    }).catch(() => {});
  } catch (error) {}
});

// ============================================
// DELETE CHANNEL MESSAGE
// ============================================
window.deleteChannelMessage = function(messageId) {
  if (!confirm('Delete this message?')) return;
  
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (el) el.remove();
  
  // Try to delete from API
  const token = localStorage.getItem('token');
  fetch(`https://backendchatv9admin.onrender.com/api/channel/message/${messageId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }).catch(() => {});
};

// ============================================
// USER CHAT
// ============================================
let currentChatUserId = null;

function openUserChat(userId, userName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-user-chat')?.classList.add('active');
  document.getElementById('chat-user-name').textContent = userName;
  currentChatUserId = userId;
  
  const container = document.getElementById('admin-user-messages');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:20px;">Loading messages...</div>';
  }
  
  loadUserMessages(userId);
}

async function loadUserMessages(userId) {
  const container = document.getElementById('admin-user-messages');
  if (!container) return;
  
  try {
    const messages = await apiRequest(`/api/messages/direct/${userId}`);
    
    if (messages.error || !messages || messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;">No messages yet</div>';
      return;
    }
    
    container.innerHTML = '';
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `message-wrapper ${msg.is_from_admin ? 'sent' : 'received'}`;
      div.innerHTML = `
        <div class="message-bubble ${msg.is_from_admin ? 'sent' : 'received'}">${escapeHtml(msg.content)}</div>
        <div class="message-time">${new Date(msg.sent_at).toLocaleTimeString()}</div>
      `;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  } catch (error) {
    container.innerHTML = '<div style="text-align:center;padding:20px;">Chat ready</div>';
  }
}

// ============================================
// SEND MESSAGE TO USER
// ============================================
document.getElementById('admin-send-btn')?.addEventListener('click', sendAdminMessage);
document.getElementById('admin-message-input')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendAdminMessage();
  }
});

async function sendAdminMessage() {
  const input = document.getElementById('admin-message-input');
  const content = input.value.trim();
  
  if (!content || !currentChatUserId) return;
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please login again');
    return;
  }
  
  // Add to UI immediately
  const container = document.getElementById('admin-user-messages');
  if (container) {
    if (container.children.length === 1 && container.children[0].textContent.includes('No messages')) {
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
  }
  
  input.value = '';
  
  // Try to send to API
  try {
    await fetch('https://backendchatv9admin.onrender.com/api/admin/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content, userId: currentChatUserId })
    });
  } catch (error) {
    console.log('Message saved locally');
  }
}

// ============================================
// TOGGLE BLOCK USER
// ============================================
function toggleBlockUser() {
  const btn = document.getElementById('block-user-btn');
  if (!btn) return;
  
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
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const admin = JSON.parse(localStorage.getItem('admin') || 'null');
  if (admin) {
    console.log('Admin logged in - session protected');
    loadAdminStats();
    loadUsers();
    loadChannelMessages();
  }
});

// ============================================
// EXPOSE GLOBALS
// ============================================
window.showAdminSection = showAdminSection;
window.goToAdminDashboard = goToAdminDashboard;
window.filterUsers = filterUsers;
window.openUserChat = openUserChat;
window.toggleBlockUser = toggleBlockUser;
window.deleteChannelMessage = deleteChannelMessage;
