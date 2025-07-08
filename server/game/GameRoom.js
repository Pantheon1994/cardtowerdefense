const { GAME_EVENTS, GAME_PHASES, TOWER_TYPES, EFFECT_TYPES, ENEMY_TYPES } = require('../constants/events');
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
    this.maxPlayers = 8;
    
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
      inventory: this.getStartingTowers(), // Give starting towers
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

    // Expansion de la map et création d'un nouveau chemin tous les 5 niveaux
    let destroyedTowers = [];
    let newPath = null;
    if (this.waveManager.shouldExpandMap(this.currentWave)) {
      newPath = this.waveManager.expandMapAndAddPath(this.currentWave);
      if (newPath) {
        destroyedTowers = this.waveManager.checkAndDestroyTowers(newPath, this.towers);
        // Notifier les clients des tours détruites et du nouveau chemin
        this.io.to(this.id).emit(GAME_EVENTS.MAP_EXPANDED, {
          newPath: newPath,
          destroyedTowers: destroyedTowers,
          mapDimensions: this.waveManager.getMapDimensions()
          // Ne pas envoyer allPaths pour éviter de remplacer les chemins existants
        });
      }
    }

    // Utiliser spawnWave pour créer les ennemis avec leurs chemins assignés
    const enemies = this.waveManager.spawnWave(this.currentWave);
    enemies.forEach((enemy, index) => {
      // Set spawn time based on delay
      enemy.spawnTime = this.waveStartTime + enemy.spawnDelay;
      this.enemies.set(enemy.id, enemy);
      console.log(`Enemy ${index}: ${enemy.id} - spawnDelay: ${enemy.spawnDelay}ms, spawnTime: ${enemy.spawnTime}, pathId: ${enemy.assignedPathId}`);
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
    
    // Process healer effects
    this.processHealerEffects();
    
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

  processHealerEffects() {
    const currentTime = Date.now();
    
    for (const [enemyId, enemy] of this.enemies) {
      // Process only healer enemies
      if (!enemy.types || !enemy.types.includes(ENEMY_TYPES.HEALER)) continue;
      if (enemy.health <= 0 || !enemy.isSpawned) continue;
      
      // Check if it's time to heal
      if (currentTime - enemy.lastHealTime < enemy.healInterval) continue;
      
      // Calculate heal amount based on wave number (stronger over time)
      const waveMultiplier = 1 + (this.currentWave - 1) * 0.2; // +20% per wave
      const actualHealAmount = Math.floor(enemy.healAmount * waveMultiplier);
      
      // Find allies within heal radius
      let healedCount = 0;
      for (const [allyId, ally] of this.enemies) {
        if (ally.id === enemy.id) continue; // Don't heal self
        if (ally.health <= 0 || !ally.isSpawned) continue;
        
        // Check if ally has anti-heal effect
        if (ally.effects && ally.effects.antiHeal) {
          const antiHealRemaining = currentTime - ally.effects.antiHeal.appliedAt;
          if (antiHealRemaining < ally.effects.antiHeal.duration) {
            continue; // Skip healing this ally
          }
        }
        
        // Check distance
        const dx = enemy.x - ally.x;
        const dy = enemy.y - ally.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= enemy.healRadius) {
          // Heal the ally
          const healedAmount = Math.min(actualHealAmount, ally.maxHealth - ally.health);
          if (healedAmount > 0) {
            ally.health += healedAmount;
            healedCount++;
            
            // Add visual effect
            if (!ally.effects) ally.effects = {};
            ally.effects.healed = {
              duration: 1000,
              appliedAt: currentTime,
              healAmount: healedAmount,
              visualEffect: {
                type: 'heal',
                color: '#00FF00',
                particleColor: '#90EE90',
                intensity: 0.8,
                animation: 'sparkle'
              }
            };
            
            console.log(`Healer ${enemy.id} healed ally ${ally.id} for ${healedAmount} HP (wave ${this.currentWave})`);
          }
        }
      }
      
      // Update last heal time
      enemy.lastHealTime = currentTime;
      
      if (healedCount > 0) {
        console.log(`Healer ${enemy.id} healed ${healedCount} allies for ${actualHealAmount} HP each`);
      }
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
    
    // Snap to grid côté serveur pour être sûr
    const GRID_CELL_SIZE = 40;
    const snappedX = Math.round(x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    const snappedY = Math.round(y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    
    // Validate placement position
    if (!this.isValidTowerPlacement(snappedX, snappedY)) {
      this.io.to(playerId).emit(GAME_EVENTS.ERROR, { message: 'Position de tour invalide' });
      return;
    }

    // Create tower using the Tower class
    const towerId = `tower_${Date.now()}_${Math.random()}`;
    const tower = new Tower(towerId, card.towerType, snappedX, snappedY, playerId);

    this.towers.set(tower.id, tower);
    player.inventory.splice(cardIndex, 1);

    console.log(`Tower ${card.towerType} placed at (${snappedX}, ${snappedY}) by ${player.name}`);
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
    const GRID_CELL_SIZE = 40; // Même valeur que côté client
    const PATH_BUFFER = 30;
    
    // Récupération du chemin depuis WaveManager
    const path = this.waveManager.getPath();
    
    // Snap à la grille côté serveur aussi
    const gridX = Math.round(x / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    const gridY = Math.round(y / GRID_CELL_SIZE) * GRID_CELL_SIZE;
    
    // Vérifier que la position n'est pas trop proche du chemin
    let minDistanceToPath = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const point1 = path[i];
      const point2 = path[i + 1];
      
      // Distance du point à la ligne de chemin
      const distance = this.distanceToLineSegment(gridX, gridY, point1.x, point1.y, point2.x, point2.y);
      minDistanceToPath = Math.min(minDistanceToPath, distance);
    }
    
    // La tour doit être à au moins 30px du chemin mais pas trop loin (max 120px)
    if (minDistanceToPath < PATH_BUFFER) {
      console.log(`Tower placement rejected: too close to path (distance: ${minDistanceToPath})`);
      return false;
    }
    
    if (minDistanceToPath > 120) {
      console.log(`Tower placement rejected: too far from path (distance: ${minDistanceToPath})`);
      return false;
    }
    
    // Vérifier les limites du canvas avec plus de marge
    const halfSize = GRID_CELL_SIZE / 2;
    if (gridX - halfSize < 0 || gridX + halfSize > 800 || 
        gridY - halfSize < 0 || gridY + halfSize > 600) {
      console.log(`Tower placement rejected: out of bounds`);
      return false;
    }
    
    // Vérifier les conflits avec les tours existantes
    for (const tower of this.towers.values()) {
      const distance = Math.sqrt((tower.x - gridX) ** 2 + (tower.y - gridY) ** 2);
      if (distance < GRID_CELL_SIZE) { // Une case de distance minimum
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
    const gameState = {
      roomId: this.id,
      phase: this.phase,
      currentWave: this.currentWave,
      baseHealth: this.baseHealth,
      players: Array.from(this.players.values()),
      towers: Array.from(this.towers.values()),
      enemies: Array.from(this.enemies.values())
    };
    
    // Debug log for game state
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🎯 Game state generated:`, {
        wave: gameState.currentWave,
        phase: gameState.phase,
        playersCount: gameState.players.length,
        towersCount: gameState.towers.length,
        enemiesCount: gameState.enemies.length
      });
    }
    
    return gameState;
  }

  broadcastGameState() {
    const gameState = this.getGameState();
    console.log(`📡 Broadcasting game state - Wave: ${gameState.currentWave}, Phase: ${gameState.phase}, Players: ${gameState.players.length}`);
    
    // Add debug info for each player
    gameState.players.forEach(player => {
      console.log(`  Player ${player.name}: inventory=${player.inventory.length}, currentCards=${player.currentCards.length}, ready=${player.isReady}`);
    });
    
    this.io.to(this.id).emit(GAME_EVENTS.GAME_STATE_UPDATE, gameState);
  }
  
  // Handle tower inspection
  handleTowerInspection(playerId, data) {
    const { towerId } = data;
    
    // Find tower by ID
    const targetTower = this.towers.get(towerId);
    
    if (targetTower) {
      // Get comprehensive tower information
      const towerInfo = targetTower.getDetailedInfo();
      
      // Add owner name
      const owner = this.players.get(targetTower.playerId);
      towerInfo.owner = owner ? owner.name : 'Joueur inconnu';
      
      // Send tower info to the requesting player
      const player = this.players.get(playerId);
      if (player) {
        this.io.to(playerId).emit(GAME_EVENTS.TOWER_INFO, { towerInfo });
        console.log(`📋 Tower inspection sent to ${player.name} for tower ${targetTower.type}`);
      }
    } else {
      console.log(`❌ Tower not found for inspection: ${towerId}`);
    }
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
        // Spawn the enemy at the start of its assigned path
        enemy.isSpawned = true;
        // Use the enemy's own path points (already assigned during wave creation)
        if (enemy.pathPoints && enemy.pathPoints.length > 0) {
          enemy.x = enemy.pathPoints[0].x;
          enemy.y = enemy.pathPoints[0].y;
        } else {
          // Fallback to default path if no path assigned
          const defaultPath = this.waveManager.getPath();
          enemy.x = defaultPath[0].x;
          enemy.y = defaultPath[0].y;
        }
        enemy.currentPathIndex = 0;
        
        newSpawns++;
        console.log(`Enemy ${enemyId} spawned at (${enemy.x}, ${enemy.y}) on path ${enemy.assignedPathId || 'default'} - Time: ${currentTime}, Scheduled: ${enemy.spawnTime}`);
      }
    }
    
    if (newSpawns > 0) {
      console.log(`Total enemies spawned: ${Array.from(this.enemies.values()).filter(e => e.isSpawned).length}/${this.enemies.size}`);
      this.broadcastGameState(); // Update all clients when new enemies spawn
    }
  }

  // Tower inspection method
  handleTowerInspection(playerId, data) {
    const { towerId } = data;
    
    if (!this.towers.has(towerId)) {
      return { success: false, error: 'Tower not found' };
    }
    
    const tower = this.towers.get(towerId);
    const towerInfo = tower.getDetailedInfo();
    
    // Send tower info to the requesting player
    this.io.to(playerId).emit(GAME_EVENTS.TOWER_INFO, {
      towerInfo: towerInfo
    });
    
    console.log(`Player ${playerId} inspected tower ${towerId}`);
    return { success: true };
  }

  // Handle tower targeting mode change
  changeTowerTargetingMode(playerId, data) {
    const { towerId, mode } = data;
    const tower = this.towers.get(towerId);
    
    if (!tower) {
      console.log(`Tower ${towerId} not found`);
      return;
    }
    
    // Validate targeting mode
    const validModes = ['closest', 'furthest', 'strongest', 'weakest'];
    if (!validModes.includes(mode)) {
      console.log(`Invalid targeting mode: ${mode}`);
      return;
    }
    
    // Update tower targeting mode
    tower.targetingMode = mode;
    console.log(`Tower ${towerId} targeting mode changed to ${mode} by player ${playerId}`);
    
    // Broadcast updated game state
    this.broadcastGameState();
  }

  handleChatMessage(playerId, data) {
    const player = this.players.get(playerId);
    if (!player) {
      console.log(`Player ${playerId} not found in room ${this.id}`);
      return;
    }

    const { message } = data;
    if (!message || typeof message !== 'string') {
      console.log(`Invalid chat message from player ${playerId}`);
      return;
    }

    // Sanitize message (sécurisation XSS côté serveur)
    const sanitizedMessage = this.sanitizeMessage(message.trim()).slice(0, 200); // Limit to 200 characters
    if (sanitizedMessage.length === 0) {
      return;
    }

    // Create chat message object
    const chatMessage = {
      playerId: player.id,
      playerName: player.name,
      message: sanitizedMessage,
      timestamp: Date.now()
    };

    console.log(`Chat message from ${player.name}: ${sanitizedMessage}`);

    // Broadcast to all players in the room
    this.io.to(this.id).emit(GAME_EVENTS.CHAT_MESSAGE_BROADCAST, chatMessage);
  }

  sanitizeMessage(message) {
    // Double sécurisation côté serveur contre l'injection XSS
    return message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  }

  // Debug methods
  handleDebugSkipToWave(playerId, data) {
    const player = this.players.get(playerId);
    if (!player) {
      console.log(`Player ${playerId} not found in room ${this.id}`);
      return;
    }

    const { waveNumber } = data;
    if (!waveNumber || typeof waveNumber !== 'number' || waveNumber < 1) {
      console.log(`Invalid wave number from player ${playerId}: ${waveNumber}`);
      return;
    }

    console.log(`🔧 Debug: Player ${player.name} skipping to wave ${waveNumber}`);

    // Stop current wave if active
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    // Clear enemies and projectiles
    this.enemies.clear();
    this.projectiles = [];

    // Set wave number
    this.currentWave = waveNumber - 1; // -1 because startWave will increment it

    // Send debug notification to all players
    const debugMessage = {
      playerId: 'system',
      playerName: 'DEBUG',
      message: `${player.name} skipped to wave ${waveNumber}`,
      timestamp: Date.now()
    };
    this.io.to(this.id).emit(GAME_EVENTS.CHAT_MESSAGE_BROADCAST, debugMessage);

    // Start the wave
    this.startNextWave();
  }

  resetGame() {
    console.log(`🔄 Resetting game in room ${this.id}`);
    
    // Reset wave manager
    this.waveManager = new WaveManager();
    
    // Reset game state
    this.currentWave = 0;
    this.gamePhase = GAME_PHASES.LOBBY;
    this.enemies.clear();
    this.towers.clear();
    this.projectiles.clear();
    this.waveStartTime = null;
    this.isWaveActive = false;
    this.baseHealth = 100;
    
    // Reset player states
    this.players.forEach(player => {
      player.selectedCard = null;
      player.isReady = false;
      player.cards = [];
    });
    
    // Notify all players
    this.io.to(this.id).emit(GAME_EVENTS.GAME_STATE_UPDATE, this.getGameState());
    
    console.log(`✅ Game reset complete in room ${this.id}`);
  }

  getStartingTowers() {
    // Create one tower card of each type for starting inventory
    const startingTowers = [];
    
    // Create a tower card for each tower type
    Object.keys(TOWER_TYPES).forEach(towerType => {
      const towerData = TOWER_TYPES[towerType];
      startingTowers.push({
        id: `starter_${towerType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'tower',
        towerType: towerType,
        name: towerData.name,
        emoji: towerData.emoji,
        description: `Tour ${towerData.name} - ${this.getEffectDescription(towerData.effect)}`
      });
    });
    
    console.log(`🎁 Creating starting inventory with ${startingTowers.length} towers:`, startingTowers.map(t => t.name));
    return startingTowers;
  }

  getEffectDescription(effect) {
    switch (effect) {
      case 'dot': return 'Dégâts sur la durée';
      case 'slow': return 'Ralentit les ennemis';
      case 'armor_reduction': return 'Réduit l\'armure';
      case 'aoe': return 'Dégâts de zone';
      case 'vortex': return 'Attire les ennemis';
      case 'anti_heal': return 'Annule les soins';
      case 'none': return 'Dégâts purs élevés';
      default: return 'Effet spécial';
    }
  }
}

module.exports = GameRoom;
