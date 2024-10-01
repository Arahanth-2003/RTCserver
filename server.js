import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow all origins; adjust this in production
    methods: ["GET", "POST"],
  },
});

// Array to store the drawing history
let drawingHistory = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected');

  // Send the drawing history to the new user
  socket.emit('load-drawing-history', drawingHistory);

  // Listen for new draw events from the client
  socket.on('draw', (data) => {
    console.log('Drawing data received:', data);

    // Store the drawing data in history
    drawingHistory.push(data);

    // Broadcast the new drawing to other connected clients
    socket.broadcast.emit('draw', data);
  });

  // Clear the drawing history if needed (optional)
  socket.on('clear', () => {
    drawingHistory = [];
    io.emit('clear-canvas'); // Notify all clients to clear their canvases
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Example route to check server status
app.get('/', (req, res) => {
  res.send('Socket.IO server is running!');
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('server is running on %d',PORT)
});