const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create uploads directory if not exists
const uploadDir = path.join(__dirname, 'uploads');
const imageDir = path.join(uploadDir, 'images');
const videoDir = path.join(uploadDir, 'videos');
[uploadDir, imageDir, videoDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, imageDir);
    } else if (file.mimetype.startsWith('video/')) {
      cb(null, videoDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  }
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');
    
    // Create tables one by one - NOT all in one query!
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        unique_user_id VARCHAR(50) UNIQUE NOT NULL,
        is_blocked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_online BOOLEAN DEFAULT false,
        avatar_url TEXT
      )
    `);
    console.log('✅ Users table created');

    // Admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_online BOOLEAN DEFAULT false
      )
    `);
    console.log('✅ Admins table created');

    // Channel messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id VARCHAR(100) UNIQUE NOT NULL,
        content TEXT,
        media_url TEXT,
        media_type VARCHAR(20),
        sent_by UUID REFERENCES admins(id),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP
      )
    `);
    console.log('✅ Channel messages table created');

    // Direct messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id VARCHAR(100) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id),
        admin_id UUID REFERENCES admins(id),
        content TEXT,
        media_url TEXT,
        media_type VARCHAR(20),
        is_from_admin BOOLEAN DEFAULT false,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP
      )
    `);
    console.log('✅ Direct messages table created');

    // Blocked users
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) UNIQUE,
        blocked_by UUID REFERENCES admins(id),
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        review_attempts INTEGER DEFAULT 0,
        last_review_request TIMESTAMP,
        is_permanently_blocked BOOLEAN DEFAULT false
      )
    `);
    console.log('✅ Blocked users table created');

    // Review requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        reviewed_by UUID REFERENCES admins(id),
        reviewed_at TIMESTAMP,
        attempt_number INTEGER DEFAULT 1
      )
    `);
    console.log('✅ Review requests table created');

    // Channel read status
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_read_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        message_id UUID REFERENCES channel_messages(id),
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, message_id)
      )
    `);
    console.log('✅ Channel read status table created');

    // Create default admin if not exists (separate query)
    const adminResult = await client.query('SELECT id FROM admins WHERE username = $1', ['admin']);
    
    if (adminResult.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123@@@', 10);
      await client.query(
        'INSERT INTO admins (username, password_hash) VALUES ($1, $2)',
        ['admin', hashedPassword]
      );
      console.log('✅ Default admin created');
    }
    
    console.log('🎉 Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error; // This will cause the server to exit and Render will restart it
  } finally {
    client.release();
  }
}

// Call the function
initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1); // Exit if database fails
});

// Middleware for verifying user token
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No token provided');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await pool.query('SELECT id, email, first_name, last_name, unique_user_id, is_blocked FROM users WHERE id = $1', [decoded.id]);
    
    if (user.rows.length === 0) throw new Error('User not found');
    if (user.rows[0].is_blocked) throw new Error('User is blocked');
    
    req.user = user.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Middleware for verifying admin token
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No token provided');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await pool.query('SELECT id, username FROM admins WHERE id = $1', [decoded.id]);
    
    if (admin.rows.length === 0) throw new Error('Admin not found');
    
    req.admin = admin.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ==================== API ROUTES ====================

// User Signup
app.post('/api/auth/user/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  
  try {
    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Generate unique user ID
    const uniqueUserId = 'USER-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = await pool.query(
      'INSERT INTO users (first_name, last_name, email, password_hash, unique_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, email, unique_user_id',
      [firstName, lastName, email, hashedPassword, uniqueUserId]
    );
    
    // Generate token
    const token = jwt.sign(
      { id: newUser.rows[0].id, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      success: true,
      token,
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/api/auth/user/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.rows[0].is_blocked) {
      return res.status(403).json({ error: 'Your account has been blocked' });
    }
    
    // Update online status
    await pool.query('UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [user.rows[0].id]);
    
    const token = jwt.sign(
      { id: user.rows[0].id, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.rows[0].id,
        first_name: user.rows[0].first_name,
        last_name: user.rows[0].last_name,
        email: user.rows[0].email,
        unique_user_id: user.rows[0].unique_user_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Login
app.post('/api/auth/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const admin = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    
    if (admin.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, admin.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update online status
    await pool.query('UPDATE admins SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [admin.rows[0].id]);
    
    const token = jwt.sign(
      { id: admin.rows[0].id, type: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin.rows[0].id,
        username: admin.rows[0].username
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout (update online status)
app.post('/api/auth/logout', async (req, res) => {
  const { userId, adminId } = req.body;
  
  try {
    if (userId) {
      await pool.query('UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    }
    if (adminId) {
      await pool.query('UPDATE admins SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [adminId]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard stats (admin only)
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const onlineUsers = await pool.query('SELECT COUNT(*) FROM users WHERE is_online = true');
    const totalMessages = await pool.query('SELECT COUNT(*) FROM direct_messages');
    const unreadMessages = await pool.query('SELECT COUNT(*) FROM direct_messages WHERE is_read = false AND is_from_admin = false');
    
    res.json({
      totalUsers: totalUsers.rows[0].count,
      onlineUsers: onlineUsers.rows[0].count,
      totalMessages: totalMessages.rows[0].count,
      unreadMessages: unreadMessages.rows[0].count
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users with last message (admin)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  const { filter } = req.query; // 'unread' or 'all'
  
  try {
    const users = await pool.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.unique_user_id, 
        u.is_blocked, u.is_online, u.last_seen,
        (
          SELECT json_build_object(
            'content', dm.content,
            'media_url', dm.media_url,
            'sent_at', dm.sent_at,
            'is_from_admin', dm.is_from_admin,
            'is_read', dm.is_read
          )
          FROM direct_messages dm
          WHERE dm.user_id = u.id
          ORDER BY dm.sent_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*)
          FROM direct_messages dm
          WHERE dm.user_id = u.id AND dm.is_read = false AND dm.is_from_admin = false
        ) as unread_count
      FROM users u
      ORDER BY 
        CASE WHEN $1 = 'unread' THEN 
          (SELECT COUNT(*) FROM direct_messages dm WHERE dm.user_id = u.id AND dm.is_read = false AND dm.is_from_admin = false)
        END DESC,
        (SELECT sent_at FROM direct_messages dm WHERE dm.user_id = u.id ORDER BY sent_at DESC LIMIT 1) DESC NULLS LAST
    `, [filter === 'unread' ? 'unread' : 'all']);
    
    res.json(users.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get direct messages between admin and user
app.get('/api/messages/direct/:userId', authenticateAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    const messages = await pool.query(`
      SELECT * FROM direct_messages 
      WHERE user_id = $1 
      ORDER BY sent_at ASC
    `, [userId]);
    
    res.json(messages.rows);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get channel messages for user
app.get('/api/channel/messages', authenticateUser, async (req, res) => {
  try {
    const messages = await pool.query(`
      SELECT cm.*, 
        EXISTS(
          SELECT 1 FROM channel_read_status crs 
          WHERE crs.message_id = cm.id AND crs.user_id = $1
        ) as is_read
      FROM channel_messages cm
      WHERE cm.is_deleted = false
      ORDER BY cm.sent_at ASC
    `, [req.user.id]);
    
    res.json(messages.rows);
  } catch (error) {
    console.error('Get channel messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get channel members count
app.get('/api/channel/members', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users WHERE is_online = true');
    res.json({ online: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send channel message (admin only)
app.post('/api/channel/send', authenticateAdmin, upload.single('media'), async (req, res) => {
  const { content } = req.body;
  const mediaFile = req.file;
  
  try {
    const messageId = 'CH-' + Date.now() + '-' + uuidv4();
    let mediaUrl = null;
    let mediaType = 'text';
    
    if (mediaFile) {
      mediaType = mediaFile.mimetype.startsWith('image/') ? 'image' : 'video';
      mediaUrl = `/uploads/${mediaType}s/${mediaFile.filename}`;
    }
    
    const message = await pool.query(
      'INSERT INTO channel_messages (message_id, content, media_url, media_type, sent_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [messageId, content || null, mediaUrl, mediaType, req.admin.id]
    );
    
    // Get all online users for notification
    const onlineUsers = await pool.query('SELECT id FROM users WHERE is_online = true');
    
    // Emit to all users
    io.emit('channel-message', {
      ...message.rows[0],
      is_read: false
    });
    
    // Send notifications to online users
    onlineUsers.rows.forEach(user => {
      io.to(`user-${user.id}`).emit('notification', {
        title: 'Channel',
        body: content || 'New media message',
        sound: true,
        vibrate: true
      });
    });
    
    res.json(message.rows[0]);
  } catch (error) {
    console.error('Send channel message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete channel message (admin only)
app.delete('/api/channel/message/:messageId', authenticateAdmin, async (req, res) => {
  const { messageId } = req.params;
  
  try {
    await pool.query(
      'UPDATE channel_messages SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [messageId]
    );
    
    io.emit('channel-message-deleted', { messageId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark channel message as read
app.post('/api/channel/mark-read/:messageId', authenticateUser, async (req, res) => {
  const { messageId } = req.params;
  
  try {
    await pool.query(
      'INSERT INTO channel_read_status (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, messageId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send direct message (admin to user or user to admin)
app.post('/api/messages/send', authenticateUser, async (req, res) => {
  const { content, adminId } = req.body;
  
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  
  try {
    // Check if user is blocked
    const blocked = await pool.query('SELECT * FROM blocked_users WHERE user_id = $1', [req.user.id]);
    if (blocked.rows.length > 0 && !blocked.rows[0].is_permanently_blocked) {
      return res.status(403).json({ error: 'You are blocked from sending messages' });
    }
    
    const messageId = 'DM-' + Date.now() + '-' + uuidv4();
    
    const message = await pool.query(
      'INSERT INTO direct_messages (message_id, user_id, admin_id, content, is_from_admin) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [messageId, req.user.id, adminId, content, false]
    );
    
    // Emit to admin
    io.to('admin-room').emit('direct-message', {
      ...message.rows[0],
      user: {
        id: req.user.id,
        first_name: req.user.first_name,
        last_name: req.user.last_name
      }
    });
    
    // Send notification to admin
    io.to('admin-room').emit('notification', {
      title: 'New Message',
      body: `${req.user.first_name} ${req.user.last_name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      sound: true,
      vibrate: true
    });
    
    res.json(message.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin send direct message to user
app.post('/api/admin/messages/send', authenticateAdmin, async (req, res) => {
  const { content, userId } = req.body;
  
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  
  try {
    const messageId = 'DM-' + Date.now() + '-' + uuidv4();
    
    const message = await pool.query(
      'INSERT INTO direct_messages (message_id, user_id, admin_id, content, is_from_admin) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [messageId, userId, req.admin.id, content, true]
    );
    
    // Emit to specific user
    io.to(`user-${userId}`).emit('direct-message', {
      ...message.rows[0],
      admin: {
        id: req.admin.id,
        username: req.admin.username
      }
    });
    
    // Send notification to user
    io.to(`user-${userId}`).emit('notification', {
      title: 'Admin',
      body: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      sound: true,
      vibrate: true
    });
    
    res.json(message.rows[0]);
  } catch (error) {
    console.error('Admin send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block user
app.post('/api/admin/user/block/:userId', authenticateAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Check if already blocked
    const existing = await pool.query('SELECT * FROM blocked_users WHERE user_id = $1', [userId]);
    
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE blocked_users SET blocked_at = CURRENT_TIMESTAMP, blocked_by = $1, is_permanently_blocked = false WHERE user_id = $2',
        [req.admin.id, userId]
      );
    } else {
      await pool.query(
        'INSERT INTO blocked_users (user_id, blocked_by) VALUES ($1, $2)',
        [userId, req.admin.id]
      );
    }
    
    // Update user block status
    await pool.query('UPDATE users SET is_blocked = true WHERE id = $1', [userId]);
    
    // Notify user
    io.to(`user-${userId}`).emit('user-blocked', {
      message: 'You have been blocked by admin'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock user
app.post('/api/admin/user/unblock/:userId', authenticateAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    await pool.query('DELETE FROM blocked_users WHERE user_id = $1', [userId]);
    await pool.query('UPDATE users SET is_blocked = false WHERE id = $1', [userId]);
    
    io.to(`user-${userId}`).emit('user-unblocked', {
      message: 'You have been unblocked by admin'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Request review
app.post('/api/user/request-review', authenticateUser, async (req, res) => {
  try {
    // Check current attempts
    const blocked = await pool.query('SELECT * FROM blocked_users WHERE user_id = $1', [req.user.id]);
    
    if (blocked.rows.length === 0) {
      return res.status(400).json({ error: 'You are not blocked' });
    }
    
    if (blocked.rows[0].is_permanently_blocked) {
      return res.status(403).json({ error: 'You are permanently blocked' });
    }
    
    const attempts = blocked.rows[0].review_attempts;
    
    if (attempts >= 3) {
      return res.status(403).json({ error: 'Maximum review attempts reached' });
    }
    
    // Check cooldown (6 hours)
    if (blocked.rows[0].last_review_request) {
      const lastRequest = new Date(blocked.rows[0].last_review_request);
      const hoursSinceLast = (Date.now() - lastRequest) / (1000 * 60 * 60);
      
      if (hoursSinceLast < 6) {
        const hoursLeft = 6 - hoursSinceLast;
        return res.status(429).json({ 
          error: `Please wait ${Math.ceil(hoursLeft)} hours before requesting again`,
          hoursLeft: Math.ceil(hoursLeft)
        });
      }
    }
    
    // Create review request
    await pool.query(
      'INSERT INTO review_requests (user_id, attempt_number) VALUES ($1, $2)',
      [req.user.id, attempts + 1]
    );
    
    // Update blocked users
    await pool.query(
      'UPDATE blocked_users SET review_attempts = review_attempts + 1, last_review_request = CURRENT_TIMESTAMP WHERE user_id = $1',
      [req.user.id]
    );
    
    // Notify admin
    io.to('admin-room').emit('review-request', {
      userId: req.user.id,
      userName: `${req.user.first_name} ${req.user.last_name}`,
      attempt: attempts + 1
    });
    
    res.json({ 
      success: true, 
      message: 'Review request sent',
      attemptsLeft: 2 - attempts
    });
  } catch (error) {
    console.error('Review request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Handle review request (admin)
app.post('/api/admin/handle-review/:requestId', authenticateAdmin, async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'
  
  try {
    const request = await pool.query('SELECT * FROM review_requests WHERE id = $1', [requestId]);
    
    if (request.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const userId = request.rows[0].user_id;
    
    if (action === 'approve') {
      // Unblock user
      await pool.query('DELETE FROM blocked_users WHERE user_id = $1', [userId]);
      await pool.query('UPDATE users SET is_blocked = false WHERE id = $1', [userId]);
      
      io.to(`user-${userId}`).emit('review-approved', {
        message: 'Your review request was approved. You can now send messages.'
      });
    } else {
      // Check if this was the 3rd attempt
      const blocked = await pool.query('SELECT review_attempts FROM blocked_users WHERE user_id = $1', [userId]);
      
      if (blocked.rows[0].review_attempts >= 3) {
        await pool.query('UPDATE blocked_users SET is_permanently_blocked = true WHERE user_id = $1', [userId]);
      }
      
      io.to(`user-${userId}`).emit('review-rejected', {
        message: 'Your review request was rejected',
        attemptsLeft: 3 - blocked.rows[0].review_attempts,
        cooldown: 6 // hours
      });
    }
    
    await pool.query(
      'UPDATE review_requests SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3',
      [action === 'approve' ? 'approved' : 'rejected', req.admin.id, requestId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Handle review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user block status
app.get('/api/user/block-status', authenticateUser, async (req, res) => {
  try {
    const blocked = await pool.query(`
      SELECT bu.*, 
        (SELECT COUNT(*) FROM review_requests WHERE user_id = $1 AND status = 'rejected') as rejected_count
      FROM blocked_users bu
      WHERE bu.user_id = $1
    `, [req.user.id]);
    
    if (blocked.rows.length === 0) {
      return res.json({ isBlocked: false });
    }
    
    res.json({
      isBlocked: true,
      attempts: blocked.rows[0].review_attempts,
      isPermanentlyBlocked: blocked.rows[0].is_permanently_blocked,
      lastRequest: blocked.rows[0].last_review_request
    });
  } catch (error) {
    console.error('Get block status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SOCKET.IO ====================

// Track online users
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // User joins with their ID
  socket.on('user-online', async (data) => {
    const { userId, userType } = data;
    
    if (userType === 'user') {
      socket.join(`user-${userId}`);
      onlineUsers.set(userId, { socketId: socket.id, type: 'user' });
      
      // Update in database
      await pool.query('UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
      
      // Notify admin
      io.to('admin-room').emit('user-status-change', {
        userId,
        isOnline: true
      });
    } else if (userType === 'admin') {
      socket.join('admin-room');
      onlineUsers.set(`admin-${userId}`, { socketId: socket.id, type: 'admin' });
      
      // Update in database
      await pool.query('UPDATE admins SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
    }
    
    // Broadcast online count
    const onlineCount = Array.from(onlineUsers.values()).filter(u => u.type === 'user').length;
    io.emit('online-count', onlineCount);
  });
  
  // Typing indicator
  socket.on('typing', (data) => {
    const { userId, isTyping, recipientId, isAdmin } = data;
    
    if (isAdmin) {
      socket.to(`user-${recipientId}`).emit('admin-typing', { isTyping });
    } else {
      socket.to('admin-room').emit('user-typing', { userId, isTyping });
    }
  });
  
  // Mark messages as read
  socket.on('mark-read', async (data) => {
    const { messageIds, userId, isAdmin } = data;
    
    if (messageIds && messageIds.length > 0) {
      await pool.query(
        'UPDATE direct_messages SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = ANY($1::uuid[])',
        [messageIds]
      );
      
      if (isAdmin) {
        socket.to(`user-${userId}`).emit('messages-read', { messageIds });
      } else {
        socket.to('admin-room').emit('messages-read', { userId, messageIds });
      }
    }
  });
  
  // Disconnect
  socket.on('disconnect', async () => {
    console.log('Disconnected:', socket.id);
    
    // Find and update user
    for (let [userId, data] of onlineUsers.entries()) {
      if (data.socketId === socket.id) {
        if (data.type === 'user') {
          await pool.query('UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
          io.to('admin-room').emit('user-status-change', {
            userId,
            isOnline: false
          });
        } else if (data.type === 'admin') {
          const adminId = userId.replace('admin-', '');
          await pool.query('UPDATE admins SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1', [adminId]);
        }
        onlineUsers.delete(userId);
        break;
      }
    }
    
    // Broadcast updated online count
    const onlineCount = Array.from(onlineUsers.values()).filter(u => u.type === 'user').length;
    io.emit('online-count', onlineCount);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
