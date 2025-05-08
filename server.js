const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

const rooms = {};

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = '';

  socket.on('setUsername', (name) => {
    username = name;
  });

  socket.on('createRoom', () => {
    const roomId = uuidv4();
    rooms[roomId] = { players: {}, alive: 0 };
    socket.join(roomId);
    currentRoom = roomId;
    rooms[roomId].players[socket.id] = { username, grid: null };
    rooms[roomId].alive = 1;
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      currentRoom = roomId;
      rooms[roomId].players[socket.id] = { username, grid: null };
      rooms[roomId].alive += 1;
      socket.emit('roomJoined', { roomId });
      io.to(roomId).emit('gameState', { players: rooms[roomId].players });
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  socket.on('updateState', (data) => {
    if (rooms[data.roomId] && rooms[data.roomId].players[socket.id]) {
      rooms[data.roomId].players[socket.id].grid = data.grid;
      io.to(data.roomId).emit('gameState', { players: rooms[data.roomId].players });
    }
  });

  socket.on('sendGarbage', (data) => {
    if (rooms[data.roomId]) {
      const playerIds = Object.keys(rooms[data.roomId].players).filter(id => id !== socket.id && rooms[data.roomId].players[id].grid);
      if (playerIds.length > 0) {
        const targetId = playerIds[Math.floor(Math.random() * playerIds.length)];
        io.to(targetId).emit('receiveGarbage', { garbage: data.garbage });
      }
    }
  });

  socket.on('gameOver', (data) => {
    if (rooms[data.roomId]) {
      rooms[data.roomId].alive -= 1;
      rooms[data.roomId].players[socket.id].grid = null;
      io.to(data.roomId).emit('gameOver', { playerId: socket.id });
      if (rooms[data.roomId].alive === 1) {
        const winnerId = Object.keys(rooms[data.roomId].players).find(id => rooms[data.roomId].players[id].grid);
         io.to(data.roomId).emit('winner', { winner: rooms[data.roomId].players[winnerId].username });
      }
    }
  });

  socket.on('leaveRoom', (data) => {
    if (rooms[data.roomId] && rooms[data.roomId].players[socket.id]) {
      rooms[data.roomId].alive -= 1;
      delete rooms[data.roomId].players[socket.id];
      socket.leave(data.roomId);
      if (Object.keys(rooms[data.roomId].players).length === 0) {
        delete rooms[data.roomId];
      } else {
        io.to(data.roomId).emit('gameState', { players: rooms[data.roomId].players });
      }
      currentRoom = null;
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
      rooms[currentRoom].alive -= 1;
      delete rooms[currentRoom].players[socket.id];
      if (Object.keys(rooms[currentRoom].players).length === 0) {
        delete rooms[currentRoom];
      } else {
        io.to(currentRoom).emit('gameState', { players: rooms[currentRoom].players });
        if (rooms[currentRoom].alive === 1) {
          const winnerId = Object.keys(rooms[currentRoom].players).find(id => rooms[currentRoom].players[id].grid);
          io.to(currentRoom).emit('winner', { winner: rooms[currentRoom].players[winnerId].username });
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});