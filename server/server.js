const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const GameRoom = require('./game/GameRoom');
const { GAME_EVENTS } = require('./constants/events');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Game rooms storage
const gameRooms = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join or create room
  socket.on(GAME_EVENTS.JOIN_ROOM, (data) => {
    const { roomId, playerName } = data;
    let room;

    if (roomId && gameRooms.has(roomId)) {
      room = gameRooms.get(roomId);
    } else {
      // Create new room
      const newRoomId = roomId || uuidv4();
      room = new GameRoom(newRoomId, io);
      gameRooms.set(newRoomId, room);
    }

    // Add player to room
    const success = room.addPlayer(socket.id, playerName || `Player ${socket.id.substring(0, 6)}`);
    
    if (success) {
      socket.join(room.id);
      socket.emit(GAME_EVENTS.ROOM_JOINED, {
        roomId: room.id,
        playerId: socket.id,
        gameState: room.getGameState()
      });
      
      // Notify all players in room about new player
      room.broadcastGameState();
    } else {
      socket.emit(GAME_EVENTS.ERROR, { message: 'Room is full or game in progress' });
    }
  });

  // Handle card selection
  socket.on(GAME_EVENTS.SELECT_CARD, (data) => {
    const room = findRoomByPlayerId(socket.id);
    if (room) {
      room.handleCardSelection(socket.id, data.cardIndex);
    }
  });

  // Handle tower placement
  socket.on(GAME_EVENTS.PLACE_TOWER, (data) => {
    const room = findRoomByPlayerId(socket.id);
    if (room) {
      room.handleTowerPlacement(socket.id, data);
    }
  });

  // Handle effect application
  socket.on(GAME_EVENTS.APPLY_EFFECT, (data) => {
    const room = findRoomByPlayerId(socket.id);
    if (room) {
      room.handleEffectApplication(socket.id, data);
    }
  });

  // Handle ready status
  socket.on(GAME_EVENTS.PLAYER_READY, () => {
    const room = findRoomByPlayerId(socket.id);
    if (room) {
      room.setPlayerReady(socket.id);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const room = findRoomByPlayerId(socket.id);
    if (room) {
      room.removePlayer(socket.id);
      if (room.getPlayerCount() === 0) {
        gameRooms.delete(room.id);
      }
    }
  });
});

// Helper function to find room by player ID
function findRoomByPlayerId(playerId) {
  for (const room of gameRooms.values()) {
    if (room.hasPlayer(playerId)) {
      return room;
    }
  }
  return null;
}

// Route for root path - serve index.html
app.get('/', (req, res) => {
  console.log('Serving index.html for root path');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Card Tower Defense server running on port ${PORT}`);
});
