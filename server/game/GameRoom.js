const { GAME_EVENTS, GAME_PHASES, TOWER_TYPES, EFFECT_TYPES } = require('../constants/events');
const WaveManager = require('./WaveManager');
const CardDeck = require('./CardDeck');
const Tower = require('./Tower');

class GameRoom {
  constructor(id, io) {
    this.id = id;
    this.io = io;
    this.players = new Map();
    this.phase = GAME_PHASES.LOBBY;
    this.currentWave = 0;
    this.baseHealth = 100;
    this.towers = new Map();
    this.enemies = new Map();
    this.projectiles = []; // Add projectiles array
    this.waveManager = new WaveManager();
    this.cardDeck = new CardDeck();
    this.maxPlayers = 4;
    
    // Game timing
    this.preparationTime = 30000; // 30 seconds
    this.preparationTimer = null;
    this.gameLoopInterval = null;
  }

  addPlayer(socketId, name) {
    if (this.players.size >= this.maxPlayers || this.phase !== GAME_PHASES.LOBBY) {
      return false;
    }

    const player = {
      id: socketId,
      name: name,
      inventory: [],
      isReady: false,
      currentCards: []
    };

    this.players.set(socketId, player);
    
    // Give all players their initial cards (including the new player)
    this.dealInitialCards();
    
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.broadcastGameState();
  }

  hasPlayer(socketId) {
    return this.players.has(socketId);
  }

  getPlayerCount() {
    return this.players.size;
  }

  setPlayerReady(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      player.isReady = true;
      this.checkAllPlayersReady();
    }
  }

  checkAllPlayersReady() {
    const allReady = Array.from(this.players.values()).every(player => player.isReady);
    console.log(`All players ready check: ${allReady}, players: ${this.players.size}, wave: ${this.currentWave}, phase: ${this.phase}`);
    
    if (allReady && this.players.size > 0) {
      if (this.currentWave === 0 && this.phase === GAME_PHASES.LOBBY) {
        // First wave - start the game
        console.log('Starting first wave...');
        this.startNextWave();
      } else if (this.phase === GAME_PHASES.PREPARATION) {
        // Skip preparation timer and launch wave immediately
        console.log('All players ready, launching wave immediately...');
        if (this.preparationTimer) {
          clearTimeout(this.preparationTimer);
          this.preparationTimer = null;
        }
        this.launchWave();
      } else if (this.phase === GAME_PHASES.LOBBY && this.currentWave > 0) {
        // After wave completion, start next wave
        console.log('All players ready after wave completion, starting next wave...');
        this.startNextWave();
      }
    }
  }

  startNextWave() {
    this.currentWave++;
    this.phase = GAME_PHASES.PREPARATION;
    
    console.log(`Starting wave ${this.currentWave}...`);
    
    // Deal NEW cards to all players at the start of each wave
    this.dealCardsToPlayers();
    
    // Start preparation timer
    this.preparationTimer = setTimeout(() => {
      this.launchWave();
    }, this.preparationTime);

    this.broadcastGameState();
    this.io.to(this.id).emit(GAME_EVENTS.WAVE_START, {
      waveNumber: this.currentWave,
      preparationTime: this.preparationTime,
      enemies: this.waveManager.getWaveEnemies(this.currentWave)
    });
  }

  dealCardsToPlayers() {
    console.log(`Dealing new cards to ${this.players.size} players for wave ${this.currentWave}`);
    for (const player of this.players.values()) {
      // Always give 3 new cards at the start of each wave
      const newCards = this.cardDeck.dealCards(3);
      player.currentCards = newCards;
      player.isReady = false;
      console.log(`Player ${player.name} received new cards:`, newCards.map(c => c.name));
    }
  }

  dealInitialCards() {
    // Deal initial cards to all players when they join (before any wave)
    console.log(`Dealing initial cards to ${this.players.size} players in room ${this.id}`);
    for (const player of this.players.values()) {
      if (!player.currentCards || player.currentCards.length === 0) {
        player.currentCards = this.cardDeck.dealCards(3);
        console.log(`Player ${player.name} received initial cards:`, player.currentCards.map(c => c.name));
      }
    }
  }

  launchWave() {
    this.phase = GAME_PHASES.WAVE_ACTIVE;
    this.waveStartTime = Date.now();
    
    // Get enemies for this wave and set their spawn times
    const enemies = this.waveManager.getWaveEnemies(this.currentWave);
    enemies.forEach((enemy, index) => {
      // Set spawn time based on delay
      enemy.spawnTime = this.waveStartTime + enemy.spawnDelay;
      this.enemies.set(enemy.id, enemy);
      console.log(`Enemy ${index}: ${enemy.id} - spawnDelay: ${enemy.spawnDelay}ms, spawnTime: ${enemy.spawnTime}`);
    });

    console.log(`Wave ${this.currentWave} launched with ${enemies.length} enemies (spawning with delays)`);
    console.log(`Wave start time: ${this.waveStartTime}`);
    
    // Start game loop
    this.startGameLoop();
    this.broadcastGameState();
  }

  startGameLoop() {
    this.gameLoopInterval = setInterval(() => {
      this.updateGame();
    }, 1000 / 60); // 60 FPS
  }

  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  updateGame() {
    // Handle enemy spawning
    this.handleEnemySpawning();
    
    // Update enemies
    this.updateEnemies();
    
    // Update towers
    this.updateTowers();
    
    // Check win/lose conditions
    this.checkGameConditions();
    
    // Broadcast updates to clients
    this.broadcastGameUpdate();
  }

  updateEnemies() {
    // Process DoT effects first
    Tower.processDotEffects(this.enemies);
    
    for (const [enemyId, enemy] of this.enemies) {
      // Move enemy along path
      enemy.move();
      
      // Apply vortex effects
      this.applyVortexEffects(enemy);
      
      // Check if enemy reached base
      if (enemy.hasReachedBase()) {
        this.baseHealth -= enemy.damage || 1;
        this.enemies.delete(enemyId);
        this.io.to(this.id).emit(GAME_EVENTS.BASE_DAMAGED, {
          damage: enemy.damage || 1,
          newHealth: this.baseHealth
        });
      }
      
      // Remove dead enemies
      if (enemy.health <= 0) {
        this.enemies.delete(enemyId);
        this.io.to(this.id).emit(GAME_EVENTS.ENEMY_KILLED, { enemyId, reward: enemy.reward });
        console.log(`Enemy ${enemyId} killed!`);
      }
    }
  }

  updateTowers() {
    const gameTime = Date.now();
    for (const [towerId, tower] of this.towers) {
      tower.update(this.enemies, gameTime);
    }
  }

  applyVortexEffects(targetEnemy) {
    if (!targetEnemy.effects || !targetEnemy.effects.vortex) return;
    
    const vortex = targetEnemy.effects.vortex;
    const currentTime = Date.now();
    
    // Check if vortex effect is still active
    if (currentTime - vortex.appliedAt > vortex.duration) {
      delete targetEnemy.effects.vortex;
      return;
    }
    
    // Pull nearby enemies towards the vortex center
    for (const [enemyId, enemy] of this.enemies) {
      if (enemy.id === targetEnemy.id) continue; // Skip the vortex center
      
      const dx = vortex.centerX - enemy.x;
      const dy = vortex.centerY - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only affect enemies within range
      if (distance < 80 && distance > 5) {
        const pullStrength = 30; // Pull strength
        enemy.x += (dx / distance) * pullStrength / 60; // Smooth pull per frame
        enemy.y += (dy / distance) * pullStrength / 60;
      }
    }
  }

  checkGameConditions() {
    // Check if base is destroyed
    if (this.baseHealth <= 0) {
      this.endGame(false);
      return;
    }
    
    // Check if wave is completed
    if (this.phase === GAME_PHASES.WAVE_ACTIVE) {
      // Count spawned and alive enemies
      const aliveEnemies = Array.from(this.enemies.values()).filter(enemy => 
        enemy.isSpawned && enemy.health > 0 && !enemy.hasReachedBase()
      );
      
      // Count enemies yet to spawn
      const unspawnedEnemies = Array.from(this.enemies.values()).filter(enemy => 
        !enemy.isSpawned
      );
      
      // Wave is complete when all enemies are spawned and no alive enemies remain
      if (unspawnedEnemies.length === 0 && aliveEnemies.length === 0) {
        console.log(`Wave ${this.currentWave} completed! No more enemies.`);
        this.endWave();
      }
    }
  }

  endWave() {
    this.stopGameLoop();
    this.phase = GAME_PHASES.LOBBY; // Return to lobby for card selection
    
    // Clear enemies from completed wave
    this.enemies.clear();
    
    this.io.to(this.id).emit(GAME_EVENTS.WAVE_END, { waveNumber: this.currentWave });
    
    console.log(`Wave ${this.currentWave} completed! Preparing next wave...`);
    
    // Deal new cards to all players for next wave
    this.dealCardsToPlayers();
    this.broadcastGameState();
    
    // Auto-start next wave after a short delay if all players are ready
    setTimeout(() => {
      this.checkAllPlayersReady();
    }, 2000);
  }

  endGame(victory) {
    this.stopGameLoop();
    this.phase = GAME_PHASES.GAME_OVER;
    this.io.to(this.id).emit(GAME_EVENTS.GAME_OVER, { victory, finalWave: this.currentWave });
  }

  handleCardSelection(playerId, cardIndex) {
    const player = this.players.get(playerId);
    if (!player || !player.currentCards[cardIndex]) return;

    const selectedCard = player.currentCards[cardIndex];
    player.inventory.push(selectedCard);
    player.currentCards = [];
    
    // Set player as ready after card selection
    player.isReady = true;
    console.log(`Player ${player.name} selected card ${selectedCard.name} and is now ready`);
    console.log(`Current game phase: ${this.phase}, Wave: ${this.currentWave}`);

    this.checkAllPlayersReady();
    this.broadcastGameState();
  }

  handleTowerPlacement(playerId, data) {
    const { cardId, x, y } = data;
    const player = this.players.get(playerId);
    if (!player) return;

    // Find card in inventory
    const cardIndex = player.inventory.findIndex(card => card.id === cardId);
    if (cardIndex === -1 || player.inventory[cardIndex].type !== 'tower') return;

    const card = player.inventory[cardIndex];
    
    // Validate placement position (implement zone checking)
    if (!this.isValidTowerPlacement(x, y)) {
      this.io.to(playerId).emit(GAME_EVENTS.ERROR, { message: 'Invalid tower placement' });
      return;
    }

    // Create tower using the Tower class
    const towerId = `tower_${Date.now()}_${Math.random()}`;
    const tower = new Tower(towerId, card.towerType, x, y, playerId);

    this.towers.set(tower.id, tower);
    player.inventory.splice(cardIndex, 1);

    console.log(`Tower ${card.towerType} placed at (${x}, ${y}) by ${player.name}`);
    this.broadcastGameState();
  }

  handleEffectApplication(playerId, data) {
    const { cardId, towerId } = data;
    const player = this.players.get(playerId);
    if (!player) return;

    // Find card in inventory
    const cardIndex = player.inventory.findIndex(card => card.id === cardId);
    if (cardIndex === -1 || player.inventory[cardIndex].type !== 'effect') return;

    const card = player.inventory[cardIndex];
    const tower = this.towers.get(towerId);
    if (!tower) return;

    // Apply effect to tower using Tower class method
    tower.applyEffect(card.effectType);
    
    player.inventory.splice(cardIndex, 1);
    console.log(`Effect ${card.effectType} applied to tower ${towerId} by ${player.name}`);
    this.broadcastGameState();
  }

  applyEffectToTower(tower, effectType) {
    const effect = EFFECT_TYPES[effectType];
    if (!effect) return;

    // Apply modifiers
    for (const [key, value] of Object.entries(effect.modifier)) {
      if (typeof value === 'number' && tower[key]) {
        tower[key] *= value;
      } else {
        tower[key] = value;
      }
    }
  }

  isValidTowerPlacement(x, y) {
    // Récupération du chemin depuis WaveManager
    const path = this.waveManager.getPath();
    
    // Vérifier que la position n'est pas trop proche du chemin
    let minDistanceToPath = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const point1 = path[i];
      const point2 = path[i + 1];
      
      // Distance du point à la ligne de chemin
      const distance = this.distanceToLineSegment(x, y, point1.x, point1.y, point2.x, point2.y);
      minDistanceToPath = Math.min(minDistanceToPath, distance);
    }
    
    // La tour doit être à au moins 30px du chemin mais pas trop loin (max 80px)
    if (minDistanceToPath < 30) {
      console.log(`Tower placement rejected: too close to path (distance: ${minDistanceToPath})`);
      return false;
    }
    
    if (minDistanceToPath > 80) {
      console.log(`Tower placement rejected: too far from path (distance: ${minDistanceToPath})`);
      return false;
    }
    
    // Vérifier les limites du canvas avec plus de marge
    if (x < 40 || x > 760 || y < 40 || y > 560) {
      console.log(`Tower placement rejected: out of bounds`);
      return false;
    }
    
    // Vérifier les conflits avec les tours existantes
    for (const tower of this.towers.values()) {
      const distance = Math.sqrt((tower.x - x) ** 2 + (tower.y - y) ** 2);
      if (distance < 35) { // Distance minimale entre tours réduite
        console.log(`Tower placement rejected: too close to existing tower`);
        return false;
      }
    }
    
    console.log(`Tower placement approved at (${x}, ${y})`);
    return true;
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getGameState() {
    return {
      roomId: this.id,
      phase: this.phase,
      currentWave: this.currentWave,
      baseHealth: this.baseHealth,
      players: Array.from(this.players.values()),
      towers: Array.from(this.towers.values()),
      enemies: Array.from(this.enemies.values())
    };
  }

  broadcastGameState() {
    this.io.to(this.id).emit(GAME_EVENTS.GAME_STATE_UPDATE, this.getGameState());
  }

  broadcastGameUpdate() {
    // Lighter update for real-time positions
    const projectiles = [];
    for (const tower of this.towers.values()) {
      projectiles.push(...tower.getProjectiles());
    }
    
    this.io.to(this.id).emit(GAME_EVENTS.GAME_STATE_UPDATE, {
      enemies: Array.from(this.enemies.values()),
      baseHealth: this.baseHealth,
      projectiles: projectiles
    });
  }

  handleEnemySpawning() {
    if (this.phase !== GAME_PHASES.WAVE_ACTIVE) return;
    
    const currentTime = Date.now();
    let newSpawns = 0;
    
    for (const [enemyId, enemy] of this.enemies) {
      if (!enemy.isSpawned && enemy.spawnTime && currentTime >= enemy.spawnTime) {
        // Spawn the enemy at the start of the path
        enemy.isSpawned = true;
        enemy.x = this.waveManager.getPath()[0].x;
        enemy.y = this.waveManager.getPath()[0].y;
        enemy.currentPathIndex = 0;
        
        newSpawns++;
        console.log(`Enemy ${enemyId} spawned at (${enemy.x}, ${enemy.y}) - Time: ${currentTime}, Scheduled: ${enemy.spawnTime}`);
      }
    }
    
    if (newSpawns > 0) {
      console.log(`Total enemies spawned: ${Array.from(this.enemies.values()).filter(e => e.isSpawned).length}/${this.enemies.size}`);
      this.broadcastGameState(); // Update all clients when new enemies spawn
    }
  }
}

module.exports = GameRoom;
