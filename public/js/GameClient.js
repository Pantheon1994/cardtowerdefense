class GameClient {
  constructor() {
    this.socket = io();
    this.gameState = null;
    this.playerId = null;
    this.selectedCard = null;
    this.renderer = new GameRenderer();
    
    this.setupEventListeners();
    this.setupSocketEvents();
  }

  setupEventListeners() {
    // Main menu
    document.getElementById('joinGameBtn').addEventListener('click', () => {
      this.joinGame();
    });

    // Ready button
    document.getElementById('readyBtn').addEventListener('click', () => {
      this.setReady();
    });

    // Start wave button
    document.getElementById('startWaveBtn').addEventListener('click', () => {
      this.setReady();
    });

    // Canvas click for tower placement
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('click', (e) => {
      this.handleCanvasClick(e);
    });
    
    // Mouse move for preview hitbox
    canvas.addEventListener('mousemove', (e) => {
      this.handleCanvasMouseMove(e);
    });
    
    // Right click to cancel placement
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancelPlacement();
    });
  }

  setupSocketEvents() {
    this.socket.on(GAME_EVENTS.ROOM_JOINED, (data) => {
      this.playerId = data.playerId;
      this.gameState = data.gameState;
      this.showGameScreen(data.roomId);
      this.updateUI();
    });

    this.socket.on(GAME_EVENTS.GAME_STATE_UPDATE, (gameState) => {
      // Handle partial updates for performance
      if (gameState.enemies) {
        this.gameState.enemies = gameState.enemies;
      }
      if (gameState.baseHealth !== undefined) {
        this.gameState.baseHealth = gameState.baseHealth;
      }
      if (gameState.projectiles) {
        this.gameState.projectiles = gameState.projectiles;
      }
      // Full state update
      if (gameState.roomId) {
        this.gameState = gameState;
      }
      
      this.updateUI();
      this.renderer.render(this.gameState);
    });

    this.socket.on(GAME_EVENTS.WAVE_START, (data) => {
      this.showWavePreview(data.enemies);
      this.dealCards();
    });

    this.socket.on(GAME_EVENTS.WAVE_END, (data) => {
      console.log(`Vague ${data.waveNumber} terminée!`);
    });

    this.socket.on(GAME_EVENTS.GAME_OVER, (data) => {
      const message = data.victory ? 'Victoire!' : 'Défaite...';
      alert(`${message} Vous avez survécu à ${data.finalWave} vagues.`);
    });

    this.socket.on(GAME_EVENTS.ERROR, (data) => {
      alert('Erreur: ' + data.message);
    });
  }

  joinGame() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomId = document.getElementById('roomId').value.trim();
    
    if (!playerName) {
      alert('Veuillez entrer votre nom');
      return;
    }

    this.socket.emit(GAME_EVENTS.JOIN_ROOM, {
      playerName: playerName,
      roomId: roomId || null
    });
  }

  showGameScreen(roomId) {
    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    document.getElementById('roomInfo').textContent = `Room: ${roomId}`;
  }

  updateUI() {
    if (!this.gameState) return;

    // Update game info
    document.getElementById('waveInfo').textContent = `Vague: ${this.gameState.currentWave}`;
    document.getElementById('baseHealth').textContent = `❤️ Base: ${this.gameState.baseHealth}`;
    document.getElementById('gamePhase').textContent = `Phase: ${this.getPhaseText(this.gameState.phase)}`;

    // Update players list
    this.updatePlayersList();

    // Update inventory
    this.updateInventory();

    // Check if player has cards to choose from
    this.checkAndShowCards();

    // Show/hide UI elements based on phase
    this.updatePhaseUI();
  }

  updatePlayersList() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';

    this.gameState.players.forEach(player => {
      const badge = document.createElement('div');
      badge.className = `player-badge ${player.isReady ? 'ready' : ''}`;
      badge.textContent = player.name;
      playersList.appendChild(badge);
    });
  }

  updateInventory() {
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    if (!currentPlayer) return;

    const inventoryCards = document.getElementById('inventoryCards');
    inventoryCards.innerHTML = '';

    currentPlayer.inventory.forEach(card => {
      const cardElement = this.createCardElement(card, true);
      cardElement.addEventListener('click', () => {
        this.selectInventoryCard(card);
      });
      inventoryCards.appendChild(cardElement);
    });
  }

  updatePhaseUI() {
    const cardSelection = document.getElementById('cardSelection');
    const wavePreview = document.getElementById('wavePreview');
    const startWaveBtn = document.getElementById('startWaveBtn');
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);

    switch (this.gameState.phase) {
      case GAME_PHASES.LOBBY:
        // Show cards in lobby if player has cards to choose
        if (currentPlayer && currentPlayer.currentCards && currentPlayer.currentCards.length > 0) {
          // Player has cards to choose from - don't hide card selection
        } else {
          cardSelection.classList.add('hidden');
        }
        
        // Show start wave button if it's wave 0 and all players are ready
        if (this.gameState.currentWave === 0) {
          const allReady = this.gameState.players.every(p => p.isReady);
          if (allReady && this.gameState.players.length > 0) {
            startWaveBtn.classList.remove('hidden');
          } else {
            startWaveBtn.classList.add('hidden');
          }
        } else {
          startWaveBtn.classList.add('hidden');
        }
        
        wavePreview.classList.add('hidden');
        break;
      case GAME_PHASES.PREPARATION:
        cardSelection.classList.add('hidden');
        startWaveBtn.classList.add('hidden');
        wavePreview.classList.remove('hidden');
        break;
      case GAME_PHASES.WAVE_ACTIVE:
        cardSelection.classList.add('hidden');
        startWaveBtn.classList.add('hidden');
        wavePreview.classList.add('hidden');
        break;
    }
  }

  checkAndShowCards() {
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    if (currentPlayer) {
      console.log('Current player cards:', currentPlayer.currentCards);
      if (currentPlayer.currentCards && currentPlayer.currentCards.length > 0) {
        console.log('Showing cards to player');
        this.dealCards();
      } else {
        console.log('Player has no cards to show');
      }
    } else {
      console.log('Current player not found');
    }
  }

  dealCards() {
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    if (!currentPlayer || !currentPlayer.currentCards || currentPlayer.currentCards.length === 0) {
      console.log('No cards to deal for player');
      return;
    }

    const cardSelection = document.getElementById('cardSelection');
    const cardOptions = document.getElementById('cardOptions');
    
    console.log('Dealing cards:', currentPlayer.currentCards);
    cardOptions.innerHTML = '';
    
    currentPlayer.currentCards.forEach((card, index) => {
      const cardElement = this.createCardElement(card);
      cardElement.addEventListener('click', () => {
        this.selectCard(index);
      });
      cardOptions.appendChild(cardElement);
    });

    cardSelection.classList.remove('hidden');
    console.log('Card selection shown');
  }

  createCardElement(card, isInventory = false) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.type} ${isInventory ? 'inventory-card' : ''}`;
    
    const emoji = card.emoji || (card.type === 'tower' ? TOWER_TYPES[card.towerType]?.emoji : '✨');
    
    cardElement.innerHTML = `
      <div class="card-emoji">${emoji}</div>
      <div class="card-name">${card.name}</div>
      <div class="card-description">${card.description}</div>
    `;

    return cardElement;
  }

  selectCard(cardIndex) {
    this.socket.emit(GAME_EVENTS.SELECT_CARD, { cardIndex });
    document.getElementById('cardSelection').classList.add('hidden');
  }

  selectInventoryCard(card) {
    console.log('🎯 Selecting card:', card.name, 'type:', card.type);
    
    // Remove previous selection
    document.querySelectorAll('.inventory-card').forEach(el => {
      el.classList.remove('selected');
    });

    // Select new card
    event.target.closest('.inventory-card').classList.add('selected');
    this.selectedCard = card;
    
    // Activer le mode placement si c'est une tour
    if (card.type === 'tower') {
      console.log('🏗️ Activating tower placement mode');
      this.renderer.startTowerPlacement();
      document.body.style.cursor = 'crosshair';
    }
  }

  setReady() {
    this.socket.emit(GAME_EVENTS.PLAYER_READY);
    document.getElementById('readyBtn').disabled = true;
  }

  handleCanvasClick(event) {
    if (!this.selectedCard) return;

    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.selectedCard.type === 'tower') {
      this.placeTower(x, y);
    } else if (this.selectedCard.type === 'effect') {
      this.applyEffect(x, y);
    }
  }

  placeTower(x, y) {
    if (!this.selectedCard || this.selectedCard.type !== 'tower') return;

    // Utiliser le système de grille pour obtenir la position valide
    const snappedPosition = this.renderer.getSnappedPosition(x, y);
    
    if (!snappedPosition) {
      alert('Position invalide ! Placez la tour sur une case verte.');
      return;
    }

    this.socket.emit(GAME_EVENTS.PLACE_TOWER, {
      cardId: this.selectedCard.id,
      x: snappedPosition.x,
      y: snappedPosition.y
    });

    this.clearSelection();
  }

  applyEffect(x, y) {
    if (!this.selectedCard || this.selectedCard.type !== 'effect') return;

    // Find tower at click position
    const tower = this.findTowerAtPosition(x, y);
    if (!tower) {
      alert('Cliquez sur une tour pour appliquer l\'effet');
      return;
    }

    this.socket.emit(GAME_EVENTS.APPLY_EFFECT, {
      cardId: this.selectedCard.id,
      towerId: tower.id
    });

    this.clearSelection();
  }

  findTowerAtPosition(x, y) {
    if (!this.gameState.towers) return null;

    for (const tower of this.gameState.towers) {
      const distance = Math.sqrt((tower.x - x) ** 2 + (tower.y - y) ** 2);
      if (distance < 30) { // 30px radius for clicking
        return tower;
      }
    }
    return null;
  }

  clearSelection() {
    this.selectedCard = null;
    this.renderer.stopTowerPlacement();
    document.body.style.cursor = 'default';
    document.querySelectorAll('.inventory-card').forEach(el => {
      el.classList.remove('selected');
    });
  }

  showWavePreview(enemies) {
    const enemyPreview = document.getElementById('enemyPreview');
    enemyPreview.innerHTML = '';

    // Group enemies by type for display
    const enemyGroups = {};
    enemies.forEach(enemy => {
      const key = enemy.name;
      if (!enemyGroups[key]) {
        enemyGroups[key] = { ...enemy, count: 0 };
      }
      enemyGroups[key].count++;
    });

    Object.values(enemyGroups).forEach(group => {
      const enemyInfo = document.createElement('div');
      enemyInfo.className = 'enemy-info';
      enemyInfo.innerHTML = `
        <div class="enemy-name">${group.name} (${group.count})</div>
        <div class="enemy-stats">
          ❤️ ${group.health} | 🛡️ ${group.armor} | 🔮 ${group.magicResist}%<br>
          ⚡ ${group.speed} | 💰 ${group.reward}
        </div>
      `;
      enemyPreview.appendChild(enemyInfo);
    });

    document.getElementById('readyBtn').disabled = false;
  }

  getPhaseText(phase) {
    switch (phase) {
      case GAME_PHASES.LOBBY: return 'Lobby';
      case GAME_PHASES.PREPARATION: return 'Préparation';
      case GAME_PHASES.WAVE_ACTIVE: return 'Vague en cours';
      case GAME_PHASES.GAME_OVER: return 'Fin de partie';
      default: return phase;
    }
  }

  handleCanvasMouseMove(event) {
    if (!this.selectedCard || this.selectedCard.type !== 'tower') return;
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('🖱️ Mouse move - selectedCard:', this.selectedCard?.name, 'pos:', x, y);
    
    // Mettre à jour la position de prévisualisation
    this.renderer.updatePreviewPosition(x, y);
  }

  cancelPlacement() {
    if (this.selectedCard) {
      this.clearSelection();
    }
  }
}
