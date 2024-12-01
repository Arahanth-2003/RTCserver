import { Server } from 'socket.io';
import http from 'http';
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now; adjust this in production
    methods: ["GET", "POST"],
  },
});

// Store canvas data per room and canvas, including drawings and text areas
const canvasHistory = {}; // { roomId: { canvasId: { drawings: [], textAreas: [] } } }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Track which room the user has joined
  let currentRoom = null;

  // Join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    currentRoom = roomId; // Track the current room for this user
    console.log(`User ${socket.id} joined room: ${roomId}`);

    // Send all canvas data for this room to the new user
    const roomData = canvasHistory[roomId] || {};
    const canvases = Object.keys(roomData).map((canvasId) => ({
      id: canvasId,
      drawings: roomData[canvasId]?.drawings || [],
      textAreas: roomData[canvasId]?.textAreas || [],
    }));
    // for debugging to check whether data is being sent to new user or not
    console.log(`Sending canvas data to user ${socket.id} for room: ${roomId}`, canvases);
    socket.emit('load-room-canvases', canvases);
  });

  // Handle drawing events
  socket.on('draw', (data) => {
    const { canvasId, drawing, roomId } = data;
    if (!canvasHistory[roomId]) canvasHistory[roomId] = {};
    if (!canvasHistory[roomId][canvasId]) canvasHistory[roomId][canvasId] = { drawings: [], textAreas: [] };
    canvasHistory[roomId][canvasId].drawings.push(drawing);
    socket.to(roomId).emit('draw', data);
  });

  // Handle text updates
  socket.on('text-update', ({ canvasId, textAreas, roomId }) => {
    if (!canvasHistory[roomId]) canvasHistory[roomId] = {};
    if (!canvasHistory[roomId][canvasId]) canvasHistory[roomId][canvasId] = { drawings: [], textAreas: [] };
    canvasHistory[roomId][canvasId].textAreas = textAreas;
    socket.to(roomId).emit('text-update', { canvasId, textAreas });
  });

  // Handle new canvas creation
  socket.on('new-canvas', ({ roomId, id: newCanvasId }) => {
    if (!canvasHistory[roomId]) canvasHistory[roomId] = {};
    if (!canvasHistory[roomId][newCanvasId]) canvasHistory[roomId][newCanvasId] = { drawings: [], textAreas: [] };
    console.log(`New canvas created in room ${roomId}: ${newCanvasId}`);
    io.to(roomId).emit('new-canvas', { id: newCanvasId });
  });

  // Handle canvas clearing
  socket.on('clear-canvas', ({ canvasId, roomId }) => {
    if (canvasHistory[roomId] && canvasHistory[roomId][canvasId]) {
      canvasHistory[roomId][canvasId] = { drawings: [], textAreas: [] };
    }
    socket.to(roomId).emit('clear-canvas', { canvasId });
  });

  // Handle canvas deletion
  socket.on('delete-canvas', ({ canvasId, roomId }) => {
    if (canvasHistory[roomId] && canvasHistory[roomId][canvasId]) {
      delete canvasHistory[roomId][canvasId];
    }
    console.log(`Canvas deleted: ${canvasId} in room: ${roomId}`);
    io.to(roomId).emit('delete-canvas', canvasId);
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (currentRoom) {
      const roomSockets = io.sockets.adapter.rooms.get(currentRoom);

      // Check if the room is now empty
      if (!roomSockets || roomSockets.size === 0) {
        console.log(`Room ${currentRoom} is empty. Deleting room data.`);
        delete canvasHistory[currentRoom]; // Remove the room's canvas data
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
