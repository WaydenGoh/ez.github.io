const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const BLOCK_SIZE = 30;

class Tetris {
  constructor(p, isMultiplayer = false, socket = null, roomId = null) {
    this.p = p;
    this.grid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
    this.currentPiece = null;
    this.nextPiece = this.randomPiece();
    this.score = 0;
    this.linesCleared = 0;
    this.gameOver = false;
    this.isMultiplayer = isMultiplayer;
    this.socket = socket;
    this.roomId = roomId;
    this.dropCounter = 0;
    this.dropInterval = 60; // Frames per drop
    this.startTime = p.millis();
    this.garbagePending = 0;
    this.players = {};
    this.spawnPiece();
  }

  randomPiece() {
    const shapes = [
      [[1, 1, 1, 1]], // I
      [[1, 1], [1, 1]], // O
      [[1, 1, 1], [0, 1, 0]], // T
      [[1, 1, 1], [1, 0, 0]], // L
      [[1, 1, 1], [0, 0, 1]], // J
      [[1, 1, 0], [0, 1, 1]], // S
      [[0, 1, 1], [1, 1, 0]] // Z
    ];
    const colors = ['cyan', 'yellow', 'purple', 'orange', 'blue', 'green', 'red'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const color = colors[shapes.indexOf(shape)];
    return { shape, color, x: Math.floor((GRID_WIDTH - shape[0].length) / 2), y: 0 };
  }

  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.randomPiece();
    if (this.collides(this.currentPiece)) {
      this.gameOver = true;
      if (this.isMultiplayer && this.socket) {
        this.socket.emit('gameOver', { roomId: this.roomId });
      }
    }
  }

  collides(piece) {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const gridX = piece.x + x;
          const gridY = piece.y + y;
          if (gridX < 0 || gridX >= GRID_WIDTH || gridY >= GRID_HEIGHT || (gridY >= 0 && this.grid[gridY][gridX])) {
            return true;
          }
        }
      }
    }
    return false;
  }

  merge() {
    for (let y = 0; y < this.currentPiece.shape.length; y++) {
      for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
        if (this.currentPiece.shape[y][x]) {
          const gridY = this.currentPiece.y + y;
          if (gridY >= 0) {
            this.grid[gridY][this.currentPiece.x + x] = this.currentPiece.color;
          }
        }
      }
    }
  }

  clearLines() {
    let lines = 0;
    for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
      if (this.grid[y].every(cell => cell !== 0)) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array(GRID_WIDTH).fill(0));
        lines++;
        y++;
      }
    }
    this.linesCleared += lines;
    this.score += lines * 100;
    if (lines > 1 && this.isMultiplayer && this.socket) {
      const garbage = lines - 1;
      this.socket.emit('sendGarbage', { roomId: this.roomId, garbage });
    }
    return lines;
  }

  addGarbage(amount) {
    this.garbagePending += amount;
    while (this.garbagePending >= 1) {
      const hole = Math.floor(Math.random() * GRID_WIDTH);
      this.grid.shift();
      const newRow = Array(GRID_WIDTH).fill('gray');
      newRow[hole] = 0;
      this.grid.push(newRow);
      this.garbagePending--;
      if (this.collides(this.currentPiece)) {
        this.gameOver = true;
        if (this.isMultiplayer && this.socket) {
          this.socket.emit('gameOver', { roomId: this.roomId });
        }
      }
    }
  }

  moveDown() {
    this.currentPiece.y++;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.y--;
      this.merge();
      this.clearLines();
      this.spawnPiece();
      return false;
    }
    return true;
  }

  moveLeft() {
    this.currentPiece.x--;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.x++;
    }
  }

  moveRight() {
    this.currentPiece.x++;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.x--;
    }
  }

  rotate() {
    const originalShape = this.currentPiece.shape;
    const newShape = Array(originalShape[0].length).fill().map((_, i) =>
      Array(originalShape.length).fill().map((_, j) => originalShape[originalShape.length - 1 - j][i])
    );
    this.currentPiece.shape = newShape;
    if (this.collides(this.currentPiece)) {
      this.currentPiece.shape = originalShape;
    }
  }

  hardDrop() {
    while (this.moveDown()) {}
  }

  update() {
    if (this.gameOver) return;
    this.dropCounter++;
    if (this.dropCounter >= this.dropInterval) {
      this.moveDown();
      this.dropCounter = 0;
    }
  }

  draw() {
    this.p.background(0);
    // Draw grid
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (this.grid[y][x]) {
          this.p.fill(this.grid[y][x]);
          this.p.rect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }
    // Draw current piece
    if (this.currentPiece && !this.gameOver) {
      this.p.fill(this.currentPiece.color);
      for (let y = 0; y < this.currentPiece.shape.length; y++) {
        for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
          if (this.currentPiece.shape[y][x]) {
            this.p.rect((this.currentPiece.x + x) * BLOCK_SIZE, (this.currentPiece.y + y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          }
        }
      }
    }
    // Draw next piece
    this.p.fill(this.nextPiece.color);
    for (let y = 0; y < this.nextPiece.shape.length; y++) {
      for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
        if (this.nextPiece.shape[y][x]) {
          this.p.rect((x + GRID_WIDTH + 2) * BLOCK_SIZE, (y + 2) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }
    }
    // Draw score and lines
    this.p.fill(255);
    this.p.textSize(20);
    this.p.text(`Score: ${this.score}`, (GRID_WIDTH + 2) * BLOCK_SIZE, 150);
    this.p.text(`Lines: ${this.linesCleared}`, (GRID_WIDTH + 2) * BLOCK_SIZE, 180);
    if (!this.isMultiplayer && this.linesCleared >= 40) {
      this.gameOver = true;
      this.p.text(`Time: ${(this.p.millis() - this.startTime) / 1000} s`, (GRID_WIDTH + 2) * BLOCK_SIZE, 210);
    }
    if (this.gameOver) {
      this.p.textSize(40);
      this.p.textAlign(this.p.CENTER);
      this.p.text('Game Over', (GRID_WIDTH / 2) * BLOCK_SIZE, (GRID_HEIGHT / 2) * BLOCK_SIZE);
    }
    // Draw other players in multiplayer
    if (this.isMultiplayer) {
      let offsetX = (GRID_WIDTH + 6) * BLOCK_SIZE;
      Object.values(this.players).forEach(player => {
        if (!player.grid) return;
        for (let y = 0; y < GRID_HEIGHT; y++) {
          for (let x = 0; x < GRID_WIDTH; x++) {
            if (player.grid[y][x]) {
              this.p.fill(player.grid[y][x]);
              this.p.rect((x + offsetX) * BLOCK_SIZE / 2, y * BLOCK_SIZE / 2, BLOCK_SIZE / 2, BLOCK_SIZE / 2);
            }
          }
        }
        offsetX += (GRID_WIDTH / 2 + 2);
      });
    }
  }
}