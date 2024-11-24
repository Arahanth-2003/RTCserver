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
  console.log('User connected');

  // Join a room based on the room ID (URL ID)
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);

    // Send all canvas data for this room to the new user
    const roomData = canvasHistory[roomId] || {};
    const canvases = Object.keys(roomData).map((canvasId) => ({
      id: canvasId,
      drawings: roomData[canvasId]?.drawings || [],
      textAreas: roomData[canvasId]?.textAreas || [],
    }));

    console.log(`Sending canvas data to user for room: ${roomId}`, canvases);
    socket.emit('load-room-canvases', canvases);
  });

  // Listen for draw events (both drawing lines and adding text)
  socket.on('draw', (data) => {
    const { canvasId, drawing, roomId } = data;

    // Ensure history exists for this room and canvas
    if (!canvasHistory[roomId]) {
      canvasHistory[roomId] = {};
    }
    if (!canvasHistory[roomId][canvasId]) {
      canvasHistory[roomId][canvasId] = { drawings: [], textAreas: [] };
    }

    // Store the new drawing in the canvas history
    canvasHistory[roomId][canvasId].drawings.push(drawing);

    // Broadcast the drawing to other clients in the same room
    socket.to(roomId).emit('draw', data);
  });

  // Listen for text updates (adding, moving, or editing text areas)
  socket.on('text-update', ({ canvasId, textAreas, roomId }) => {
    // Ensure history exists for this room and canvas
    if (!canvasHistory[roomId]) {
      canvasHistory[roomId] = {};
    }
    if (!canvasHistory[roomId][canvasId]) {
      canvasHistory[roomId][canvasId] = { drawings: [], textAreas: [] };
    }

    // Update the text areas in the canvas history
    canvasHistory[roomId][canvasId].textAreas = textAreas;

    // Broadcast the updated text areas to other clients in the same room
    socket.to(roomId).emit('text-update', { canvasId, textAreas });
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
      canvasHistory[roomId][newCanvasId] = { drawings: [], textAreas: [] };
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
      canvasHistory[roomId][canvasId] = { drawings: [], textAreas: [] };
    }

    // Notify all clients in the same room to clear the canvas
    socket.to(roomId).emit('clear-canvas', { canvasId });
  });

  // Listen for canvas deletion in a specific room
  socket.on('delete-canvas', (data) => {
    const { canvasId, roomId } = data;

    // Delete the canvas history for the specified canvas in this room
    if (canvasHistory[roomId] && canvasHistory[roomId][canvasId]) {
      delete canvasHistory[roomId][canvasId];
    }

    console.log(`Canvas deleted: ${canvasId} in room: ${roomId}`);

    // Notify all clients in the same room to delete the canvas
    io.to(roomId).emit('delete-canvas', canvasId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
