import express from 'express';
import { Server } from 'socket.io';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now, adjust this in production
    methods: ["GET", "POST"],
  },
});

// Store canvas drawing history per canvas
let canvasHistory = {}; // { canvasId: [{x0, y0, x1, y1, color, lineWidth}] }

io.on('connection', (socket) => {
  console.log('User connected');

  // Send all canvas history to new user
  const canvasData = Object.keys(canvasHistory).map((id) => ({
    id,
    drawings: canvasHistory[id] || [],
  }));
  console.log('Sending canvas history to the new user:', canvasData);
  socket.emit('load-canvas-history', canvasData);

  // Listen for draw events
  socket.on('draw', (data) => {
    const { canvasId, drawing } = data;

    // Ensure history exists for this canvas
    if (!canvasHistory[canvasId]) {
      canvasHistory[canvasId] = [];
    }

    // Store the new drawing in the canvas history
    canvasHistory[canvasId].push(drawing);

    // Broadcast the drawing to other clients
    socket.broadcast.emit('draw', data);
  });

  // Listen for new canvas creation
  socket.on('new-canvas', (newCanvas) => {
    const { id } = newCanvas;

    // Initialize empty history for the new canvas
    if (!canvasHistory[id]) {
      canvasHistory[id] = [];
    }

    // Log the new canvas creation
    console.log(`New canvas created: ${id}`);

    // Emit the new canvas event to all clients
    io.emit('new-canvas', newCanvas);

    // Send the empty history to the new canvas
    // socket.emit("load-canvas-history", [{ id, drawings: [] }]);
  });

  // Clear a canvas
  socket.on('clear-canvas', (data) => {
    const { canvasId } = data;

    // Clear the canvas history for the specified canvas
    if (canvasHistory[canvasId]) {
      canvasHistory[canvasId] = [];
    }

    // Notify all clients to clear the canvas
    io.emit('clear-canvas', { canvasId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
