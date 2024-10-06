import { Server } from 'socket.io';
import http from 'http';
import express from "express"

const app = express()
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now; adjust this in production
    methods: ["GET", "POST"],
  },
});

// Store canvas drawing history per room and canvas
const canvasHistory = {}; // { roomId: { canvasId: [{x0, y0, x1, y1, color, lineWidth}] } }

io.on('connection', (socket) => {
  console.log('User connected');

  // Join a room based on the room ID (URL ID)
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);

    // Send all canvas history for this room to the new user
    const roomData = canvasHistory[roomId] || {};
    const canvases = Object.keys(roomData).map((canvasId) => ({
      id: canvasId,
      drawings: roomData[canvasId] || [],
    }));

    console.log(`Sending canvas history to user for room: ${roomId}`, canvases);
    socket.emit('load-room-canvases', canvases);
  });

  // Listen for draw events
  socket.on('draw', (data) => {
    const { canvasId, drawing, roomId } = data;

    // Ensure history exists for this room and canvas
    if (!canvasHistory[roomId]) {
      canvasHistory[roomId] = {};
    }
    if (!canvasHistory[roomId][canvasId]) {
      canvasHistory[roomId][canvasId] = [];
    }

    // Store the new drawing in the canvas history
    canvasHistory[roomId][canvasId].push(drawing);

    // Broadcast the drawing to other clients in the same room
    socket.to(roomId).emit('draw', data);
  });

  // Listen for new canvas creation in a specific room
  socket.on('new-canvas', (data) => {
    const { roomId, id: newCanvasId } = data;

    // Ensure history for the room exists
    if (!canvasHistory[roomId]) {
      canvasHistory[roomId] = {};
    }

    // Initialize empty history for the new canvas
    if (!canvasHistory[roomId][newCanvasId]) {
      canvasHistory[roomId][newCanvasId] = [];
    }

    console.log(`New canvas created in room ${roomId}: ${newCanvasId}`);
    // Emit the new canvas event to all clients in the same room
    io.to(roomId).emit('new-canvas', { id: newCanvasId });
  });

  // Listen for canvas clearing in a specific room
  socket.on('clear-canvas', (data) => {
    const { canvasId, roomId } = data;

    // Clear the canvas history for the specified canvas in this room
    if (canvasHistory[roomId] && canvasHistory[roomId][canvasId]) {
      canvasHistory[roomId][canvasId] = [];
    }

    // Notify all clients in the same room to clear the canvas
    socket.to(roomId).emit('clear-canvas', { canvasId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');

  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
