let tetris;
let socket;
let roomId = null;

function setup() {
  const canvas = createCanvas((GRID_WIDTH + 8) * BLOCK_SIZE, GRID_HEIGHT * BLOCK_SIZE);
  canvas.parent('canvasContainer');
  socket = io();
  setupSocketHandlers();
  setupUI();
}

function setupSocketHandlers() {
  socket.on('roomCreated', (data) => {
    roomId = data.roomId;
    startGame(true);
    select('#status').html(`Room ID: ${roomId}. Waiting for players...`);
  });

  socket.on('roomJoined', (data) => {
    roomId = data.roomId;
    startGame(true);
    select('#status').html(`Joined room ${roomId}`);
  });

  socket.on('gameState', (data) => {
    if (tetris) {
      tetris.players = data.players;
    }
  });

  socket.on('receiveGarbage', (data) => {
    if (tetris && !tetris.gameOver) {
      tetris.addGarbage(data.garbage);
    }
  });

  socket.on('gameOver', (data) => {
    select('#status').html(`Player ${data.playerId} is out!`);
  });

  socket.on('winner', (data) => {
    select('#status').html(`Winner: ${data.winner}!`);
    tetris.gameOver = true;
  });

  socket.on('error', (data) => {
    select('#status').html(data.message);
  });
}

function setupUI() {
  select('#soloBtn').mousePressed(() => {
    const username = select('#username').value();
    if (!username) {
      select('#status').html('Please enter a username');
      return;
    }
    socket.emit('setUsername', username);
    startGame(false);
  });

  select('#createRoomBtn').mousePressed(() => {
    const username = select('#username').value();
    if (!username) {
      select('#status').html('Please enter a username');
      return;
    }
    socket.emit('setUsername', username);
    socket.emit('createRoom');
  });

  select('#joinRoomBtn').mousePressed(() => {
    const username = select('#username').value();
    const room = select('#roomId').value();
    if (!username || !room) {
      select('#status').html('Please enter username and room ID');
      return;
    }
    socket.emit('setUsername', username);
    socket.emit('joinRoom', room);
  });

  select('#backBtn').mousePressed(() => {
    if (roomId) {
      socket.emit('leaveRoom', { roomId });
      roomId = null;
    }
    tetris = null;
    select('#menu').show();
    select('#game').hide();
    select('#status').html('');
  });
}

function startGame(isMultiplayer) {
  tetris = new Tetris(p5, isMultiplayer, socket, roomId);
  select('#menu').hide();
  select('#game').show();
}

function draw() {
  if (tetris) {
    tetris.update();
    tetris.draw();
    if (tetris.isMultiplayer && !tetris.gameOver) {
      socket.emit('updateState', { roomId, grid: tetris.grid });
    }
  }
}

function keyPressed() {
  if (!tetris || tetris.gameOver) return;
  if (keyCode === LEFT_ARROW) tetris.moveLeft();
  if (keyCode === RIGHT_ARROW) tetris.moveRight();
  if (keyCode === DOWN_ARROW) tetris.moveDown();
  if (keyCode === UP_ARROW) tetris.rotate();
  if (key === ' ') tetris.hardDrop();
}