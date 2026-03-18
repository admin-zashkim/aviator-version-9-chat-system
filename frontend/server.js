const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Make backend URL available to frontend
app.get('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`window.BACKEND_URL = '${process.env.BACKEND_URL || 'https://backendchatv9admin.onrender.com'}';`);
});

// Serve static files with CORRECT paths matching your structure
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/icons', express.static(path.join(__dirname, 'public', 'icons')));
app.use('/sounds', express.static(path.join(__dirname, 'public', 'sounds')));

// Serve index.html from public folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// For all other routes, still serve index.html (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Frontend server running on port ${PORT}`);
  console.log(`📁 Current directory: ${__dirname}`);
  console.log(`🔗 Backend URL: ${process.env.BACKEND_URL || 'https://backendchatv9admin.onrender.com'}`);
  
  // Verify critical files exist
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log(`✅ index.html found at: ${indexPath}`);
  } else {
    console.error(`❌ index.html NOT found at: ${indexPath}`);
  }
});