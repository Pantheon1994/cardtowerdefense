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

    // Chat toggle button
    document.getElementById('chatToggleBtn').addEventListener('click', () => {
      this.toggleChat();
    });

    // Inventory toggle button
    document.getElementById('inventoryToggle')?.addEventListener('click', () => {
      this.toggleInventory();
    });
  }

  setupSocketEvents() {
    console.log('🔌 Setting up socket events...');
    
    this.socket.on(GAME_EVENTS.ROOM_JOINED, (data) => {
      console.log('🏠 ROOM_JOINED received:', data);
      this.playerId = data.playerId;
      this.gameState = data.gameState;
      this.showGameScreen(data.roomId);
      this.updateUI();
    });

    this.socket.on(GAME_EVENTS.GAME_STATE_UPDATE, (data) => {
      // Handle both full gameState and partial updates
      if (data.currentWave !== undefined) {
        // Full game state update
        console.log('🔄 GAME_STATE_UPDATE (full) received:', {
          wave: data.currentWave,
          phase: data.phase,
          playersCount: data.players ? data.players.length : 0,
          towersCount: data.towers ? data.towers.length : 0,
          enemiesCount: data.enemies ? data.enemies.length : 0
        });
        
        this.gameState = data;
        this.updateUI();
        this.renderer.render(data, this.selectedCard);
        
        // Update chat visibility based on player count
        if (data.players) {
          this.updateChatVisibility(data.players.length);
        }
      } else {
        // Partial update (enemies, baseHealth, projectiles)
        console.log('🔄 GAME_STATE_UPDATE (partial) received:', {
          enemiesCount: data.enemies ? data.enemies.length : 0,
          baseHealth: data.baseHealth,
          projectilesCount: data.projectiles ? data.projectiles.length : 0
        });
        
        if (this.gameState) {
          // Update only the changed parts
          if (data.enemies) this.gameState.enemies = data.enemies;
          if (data.baseHealth !== undefined) this.gameState.baseHealth = data.baseHealth;
          if (data.projectiles) this.gameState.projectiles = data.projectiles;
          
          // Update UI for base health changes
          const baseHealth = document.getElementById('baseHealth');
          if (baseHealth && data.baseHealth !== undefined) {
            baseHealth.textContent = `❤️ Base: ${data.baseHealth}`;
          }
          
          this.renderer.render(this.gameState, this.selectedCard);
        }
      }
    });

    this.socket.on(GAME_EVENTS.WAVE_START, (data) => {
      console.log('🌊 WAVE_START received:', data);
      this.showWavePreview(data.enemies);
      // Cards are dealt through updateUI() -> checkAndShowCards()
    });

    this.socket.on(GAME_EVENTS.WAVE_END, (data) => {
      console.log('✅ WAVE_END received:', data);
      console.log(`Vague ${data.waveNumber} terminée!`);
    });

    this.socket.on(GAME_EVENTS.GAME_OVER, (data) => {
      console.log('💀 GAME_OVER received:', data);
      const message = data.victory ? 'Victoire!' : 'Défaite...';
      alert(`${message} Vous avez survécu à ${data.finalWave} vagues.`);
    });

    this.socket.on(GAME_EVENTS.ERROR, (data) => {
      console.error('❌ ERROR received:', data);
      alert('Erreur: ' + data.message);
    });

    // Handle tower inspection response
    this.socket.on(GAME_EVENTS.TOWER_INFO, (data) => {
      console.log('🔍 TOWER_INFO received:', data);
      this.showTowerInfo(data.towerInfo);
    });

    // Socket connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔥 Socket connection error:', error);
    });

    // Handle chat messages
    this.socket.on(GAME_EVENTS.CHAT_MESSAGE_BROADCAST, (data) => {
      console.log('💬 Chat message received:', data);
      this.displayChatMessage(data);
    });

    // Handle map expansion
    this.socket.on(GAME_EVENTS.MAP_EXPANDED, (data) => {
      console.log('🗺️ Map expanded:', data);
      this.handleMapExpansion(data);
    });
  }

  joinGame() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomId = document.getElementById('roomId').value.trim();
    
    if (!playerName) {
      alert('Veuillez entrer votre nom');
      return;
    }

    console.log('🎮 Joining game with name:', playerName, 'roomId:', roomId || 'auto');
    
    this.socket.emit(GAME_EVENTS.JOIN_ROOM, {
      playerName: playerName,
      roomId: roomId || null
    });
    
    console.log('📤 JOIN_ROOM event sent');
  }

  handleMapExpansion(data) {
    console.log('🗺️ Handling map expansion:', data);
    
    const { mapDimensions, newPath, destroyedTowers, allPaths } = data;
    
    // Update renderer with new map dimensions
    if (this.renderer && mapDimensions) {
      this.renderer.updateMapDimensions(mapDimensions);
      if (newPath) {
        this.renderer.addNewPath(newPath);
      }
      if (allPaths) {
        this.renderer.updateAllPaths(allPaths);
      }
    }

    // Show notification about destroyed towers
    if (destroyedTowers && destroyedTowers.length > 0) {
      this.showDestroyedTowersNotification(destroyedTowers);
    }

    // Show map expansion notification
    if (newPath) {
      this.showMapExpansionNotification(newPath);
    }

    // Update game state to trigger UI refresh
    this.updateUI();
  }

  showGameScreen(roomId) {
    document.getElementById('mainMenu').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    document.getElementById('roomInfo').textContent = `Room: ${roomId}`;
  }

  updateUI() {
    if (!this.gameState) return;

    console.log('🔄 Updating UI with game state:', {
      wave: this.gameState.currentWave,
      phase: this.gameState.phase,
      playersCount: this.gameState.players.length
    });

    // Update game info
    const roomInfo = document.getElementById('roomInfo');
    if (roomInfo) {
      roomInfo.textContent = `Room: ${this.gameState.roomId || 'N/A'}`;
    }
    
    const waveInfo = document.getElementById('waveInfo');
    if (waveInfo) {
      waveInfo.textContent = `Vague: ${this.gameState.currentWave}`;
    }
    
    const baseHealth = document.getElementById('baseHealth');
    if (baseHealth) {
      baseHealth.textContent = `❤️ Base: ${this.gameState.baseHealth}`;
    }
    
    const gamePhase = document.getElementById('gamePhase');
    if (gamePhase) {
      gamePhase.textContent = `Phase: ${this.getPhaseText(this.gameState.phase)}`;
    }

    // Update players list
    this.updatePlayersList();

    // Update inventory
    this.updateInventory();

    // Check if player has cards to choose from
    this.checkAndShowCards();

    // Show/hide UI elements based on phase
    this.updatePhaseUI();
  }

  getPhaseText(phase) {
    const phaseNames = {
      [GAME_PHASES.LOBBY]: 'Lobby',
      [GAME_PHASES.PREPARATION]: 'Préparation',
      [GAME_PHASES.WAVE_ACTIVE]: 'Vague Active'
    };
    return phaseNames[phase] || 'Inconnue';
  }

  updatePlayersList() {
    const playersList = document.getElementById('playersList');
    if (!playersList || !this.gameState || !this.gameState.players) return;
    
    playersList.innerHTML = '';
    this.gameState.players.forEach(player => {
      const playerElement = document.createElement('div');
      playerElement.className = 'player-item';
      playerElement.innerHTML = `
        <span class="player-name">${player.name}</span>
        <span class="player-status">${player.isReady ? '✅' : '⏳'}</span>
      `;
      playersList.appendChild(playerElement);
    });
  }

  updateInventory() {
    if (!this.gameState || !this.gameState.players) {
      console.log('⚠️ Cannot update inventory - no game state or players');
      return;
    }
    
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    if (!currentPlayer) {
      console.log('⚠️ Cannot update inventory - current player not found');
      return;
    }

    const inventoryCards = document.getElementById('inventoryCards');
    if (!inventoryCards) {
      console.log('⚠️ Cannot update inventory - inventoryCards element not found');
      return;
    }
    
    console.log('📦 Updating inventory with', currentPlayer.inventory.length, 'cards:', currentPlayer.inventory);
    
    inventoryCards.innerHTML = '';

    if (currentPlayer.inventory && currentPlayer.inventory.length > 0) {
      currentPlayer.inventory.forEach((card, index) => {
        console.log(`  - Card ${index}:`, card.name, `(${card.type})`);
        const cardElement = this.createCardElement(card, true);
        cardElement.addEventListener('click', () => {
          this.selectInventoryCard(card);
        });
        inventoryCards.appendChild(cardElement);
      });
      
      // Auto-expand inventory if it was collapsed and now has cards
      const inventory = document.getElementById('playerInventory');
      if (inventory && inventory.classList.contains('collapsed') && currentPlayer.inventory.length <= 6) {
        this.toggleInventory();
      }
    } else {
      console.log('📦 No cards in inventory');
      inventoryCards.innerHTML = '<p style="text-align: center; color: #888; font-size: 12px; margin: 0;">Inventaire vide</p>';
      
      // Auto-collapse inventory when empty
      const inventory = document.getElementById('playerInventory');
      if (inventory && !inventory.classList.contains('collapsed')) {
        this.toggleInventory();
      }
    }
  }

  updatePhaseUI() {
    if (!this.gameState || !this.gameState.players) return;
    const cardSelection = document.getElementById('cardSelection');
    const wavePreview = document.getElementById('wavePreview');
    const startWaveBtn = document.getElementById('startWaveBtn');
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    switch (this.gameState.phase) {
      case 'CARD_SELECTION':
        this.showCardSelection();
        break;
      case GAME_PHASES.LOBBY:
        // Show cards in lobby only if player has cards to choose AND hasn't selected one yet
        if (currentPlayer && currentPlayer.currentCards && currentPlayer.currentCards.length > 0) {
          // Player has cards to choose from - show card selection
          cardSelection.classList.remove('hidden');
        } else {
          // No cards to choose or already selected - hide card selection
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

  showCardSelection() {
    const cardSelection = document.getElementById('cardSelection');
    const cardOptions = document.getElementById('cardOptions');
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    
    cardOptions.innerHTML = '';
    cardSelection.classList.remove('hidden');
    cardSelection.scrollIntoView({behavior: 'smooth', block: 'center'});

    currentPlayer.currentCards.forEach((card, index) => {
      const cardElement = this.createCardElement(card);
      cardElement.addEventListener('click', () => {
        // Highlight selection
        cardOptions.querySelectorAll('.card').forEach(el => el.classList.remove('selected'));
        cardElement.classList.add('selected');
        setTimeout(() => {
          this.selectCard(index);
        }, 220); // Delay for animation
      });
      cardOptions.appendChild(cardElement);
    });
  }

  checkAndShowCards() {
    if (!this.gameState || !this.gameState.players) return;
    
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    if (currentPlayer) {
      console.log('Current player cards:', currentPlayer.currentCards);
      if (currentPlayer.currentCards && currentPlayer.currentCards.length > 0) {
        console.log('Showing cards to player');
        this.dealCards();
      } else {
        console.log('Player has no cards to show');
        // Hide card selection if no cards to show
        const cardSelection = document.getElementById('cardSelection');
        if (cardSelection) {
          cardSelection.classList.add('hidden');
        }
      }
    } else {
      console.log('Current player not found');
    }
  }

  dealCards() {
    // Safety check: ensure gameState is initialized
    if (!this.gameState || !this.gameState.players) {
      console.warn('Game state not initialized, cannot deal cards');
      return;
    }

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
    console.log('🎯 Selecting card at index:', cardIndex);
    
    if (!this.gameState || !this.gameState.players) {
      console.error('❌ Cannot select card - no game state');
      return;
    }
    
    const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
    if (!currentPlayer || !currentPlayer.currentCards || !currentPlayer.currentCards[cardIndex]) {
      console.error('❌ Cannot select card - card not found at index', cardIndex);
      return;
    }
    
    const selectedCard = currentPlayer.currentCards[cardIndex];
    console.log('📤 Sending SELECT_CARD event for:', selectedCard.name);
    
    this.socket.emit(GAME_EVENTS.SELECT_CARD, { cardIndex });
    document.getElementById('cardSelection').classList.add('hidden');
    
    console.log('🔄 Card selection hidden, waiting for server response...');
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
    
    // Change cursor based on card type
    if (card.type === 'tower') {
      console.log('🏗️ Activating tower placement mode');
      this.renderer.startTowerPlacement();
      document.body.style.cursor = 'crosshair';
      document.body.title = 'Cliquez pour placer la tour';
    } else if (card.type === 'effect') {
      console.log('✨ Activating effect application mode');
      document.body.style.cursor = 'pointer';
      document.body.title = 'Cliquez sur une tour pour appliquer l\'effet';
      // Add a visual indicator class to the body
      document.body.classList.add('applying-effect');
      // Show instructions
      this.showEffectApplicationInstructions(card.name);
    }
  }

  setReady() {
    this.socket.emit(GAME_EVENTS.PLAYER_READY);
    document.getElementById('readyBtn').disabled = true;
  }

  handleCanvasClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldPos = this.renderer.screenToWorld(screenX, screenY);
    const x = worldPos.x;
    const y = worldPos.y;

    // If no card is selected, check for tower inspection
    if (!this.selectedCard) {
      this.checkTowerInspection(x, y);
      return;
    }

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
    if (!this.gameState || !this.gameState.towers) return null;

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
    document.body.title = '';
    document.body.classList.remove('applying-effect');
    this.hideEffectApplicationInstructions();
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

  handleCanvasMouseMove(event) {
    if (!this.selectedCard || this.selectedCard.type !== 'tower') return;
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldPos = this.renderer.screenToWorld(screenX, screenY);
    const x = worldPos.x;
    const y = worldPos.y;
    
    console.log('🖱️ Mouse move - selectedCard:', this.selectedCard?.name, 'world pos:', x, y);
    
    // Mettre à jour la position de prévisualisation avec les coordonnées monde
    this.renderer.updatePreviewPosition(x, y);
  }

  cancelPlacement() {
    if (this.selectedCard) {
      this.clearSelection();
    }
  }

  checkTowerInspection(x, y) {
    if (!this.gameState || !this.gameState.towers) return;

    // Check if click is on a tower
    for (const tower of this.gameState.towers) {
      const distance = Math.sqrt((x - tower.x) ** 2 + (y - tower.y) ** 2);
      if (distance <= 20) { // 20px radius for tower click detection
        this.inspectTower(tower.id);
        return;
      }
    }
  }

  inspectTower(towerId) {
    this.socket.emit(GAME_EVENTS.INSPECT_TOWER, { towerId });
  }

  showTowerInfo(towerInfo) {
    // Create and show tower info modal
    const modal = this.createTowerInfoModal(towerInfo);
    document.body.appendChild(modal);
    
    // Close modal when clicking outside or on close button
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('close-btn')) {
        document.body.removeChild(modal);
      }
    });
  }

  createTowerInfoModal(tower) {
    const modal = document.createElement('div');
    modal.className = 'tower-info-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    const content = document.createElement('div');
    content.className = 'tower-info-content';
    content.style.cssText = `
      background: #2a2a2a;
      color: white;
      padding: 20px;
      border-radius: 10px;
      max-width: 600px;
      max-height: 85vh;
      overflow-y: auto;
      border: 2px solid #4a9eff;
    `;

    // Quality color based on level
    const qualityColors = ['#ffffff', '#4a9eff', '#9d4edd', '#ffaa00'];
    const qualityColor = qualityColors[tower.quality.level] || '#ffffff';
    
    // Calculate special effects and bonuses
    const specialEffects = this.calculateSpecialEffects(tower);
    const statBonuses = this.calculateStatBonuses(tower);

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0; color: ${qualityColor};">
          ${tower.towerType.emoji} ${tower.towerType.name} ${tower.quality.name}
          ${tower.stats.canDetectInvisible ? '<span style="color: #9d4edd; font-size: 0.8em;">👁️</span>' : ''}
        </h2>
        <button class="close-btn" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">✕</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <strong>Propriétaire:</strong> ${tower.owner}<br>
        <strong>Position:</strong> (${tower.position.x}, ${tower.position.y})<br>
        <strong>Temps actif:</strong> ${tower.combatStats.uptime}s<br>
        <strong>Rang:</strong> <span style="color: ${qualityColor};">${tower.quality.name} (Niveau ${tower.quality.level})</span>
      </div>

      ${statBonuses.length > 0 ? `
        <div style="background: #1a4d1a; padding: 10px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #2d8f2d;">
          <h3 style="margin: 0 0 10px 0; color: #4CAF50;">📈 Améliorations</h3>
          ${statBonuses.map(bonus => `
            <div style="color: #4CAF50; margin-bottom: 3px;">
              <strong>${bonus.stat}:</strong> ${bonus.bonus} (+${bonus.percentage}%)
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div style="background: #333; padding: 10px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #4a9eff;">📊 Statistiques</h3>
          <div><strong>Dégâts:</strong> ${tower.stats.damage} <span style="color: #888;">(base: ${tower.baseStats.damage})</span></div>
          <div><strong>Vitesse:</strong> ${tower.stats.attackSpeed}/s <span style="color: #888;">(base: ${tower.baseStats.attackSpeed})</span></div>
          <div><strong>Portée:</strong> ${tower.stats.range} <span style="color: #888;">(base: ${tower.baseStats.range})</span></div>
          <div><strong>DPS:</strong> <span style="color: #ff6b6b; font-weight: bold;">${tower.stats.dps}</span></div>
          <div><strong>Cibles max:</strong> ${tower.stats.maxTargets}</div>
        </div>

        <div style="background: #333; padding: 10px; border-radius: 5px;">
          <h3 style="margin: 0 0 10px 0; color: #ff6b6b;">⚔️ Combat</h3>
          <div><strong>Kills:</strong> ${tower.combatStats.totalKills}</div>
          <div><strong>Dégâts totaux:</strong> ${tower.combatStats.totalDamageDealt}</div>
          <div><strong>Attaques:</strong> ${tower.combatStats.totalAttacks}</div>
          <div><strong>Dégâts/Attaque:</strong> ${tower.combatStats.averageDamagePerAttack}</div>
          <div><strong>Kills/min:</strong> ${tower.combatStats.killsPerMinute.toFixed(1)}</div>
        </div>
      </div>

      ${specialEffects.length > 0 ? `
        <div style="background: #333; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; color: #ffaa00;">🎯 Effets Spéciaux</h3>
          ${specialEffects.map(effect => `
            <div style="margin-bottom: 5px;">
              <span style="font-size: 1.2em;">${effect.icon}</span>
              <strong>${effect.name}:</strong> ${effect.value}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${tower.effects.length > 0 ? `
        <div style="background: #333; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; color: #9d4edd;">✨ Effets appliqués</h3>
          ${tower.effects.map(effect => `
            <div style="margin-bottom: 5px;">
              <strong>${effect.name}</strong> <span style="color: #888;">(par ${effect.appliedBy})</span><br>
              <small style="color: #bbb;">${effect.description}</small>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="background: #333; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
        <h3 style="margin: 0 0 10px 0; color: #4a9eff;">🎯 Mode de Ciblage</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
          ${[
            { mode: 'CLOSEST', name: 'Plus proche', icon: '🎯', description: 'Attaque l\'ennemi le plus proche' },
            { mode: 'FARTHEST', name: 'Plus loin', icon: '🏹', description: 'Attaque l\'ennemi le plus éloigné' },
            { mode: 'WEAKEST', name: 'Plus faible', icon: '💔', description: 'Attaque l\'ennemi avec le moins de vie' },
            { mode: 'STRONGEST', name: 'Plus fort', icon: '💪', description: 'Attaque l\'ennemi avec le plus de vie' },
            { mode: 'FIRST', name: 'Premier', icon: '🥇', description: 'Attaque le premier ennemi sur le chemin' },
            { mode: 'LAST', name: 'Dernier', icon: '🥉', description: 'Attaque le dernier ennemi sur le chemin' },
            { mode: 'RANDOM', name: 'Aléatoire', icon: '🎲', description: 'Attaque un ennemi aléatoire' }
          ].map(info => `
            <button 
              class="targeting-mode-btn" 
              data-mode="${info.mode}"
              style="
                background: ${(tower.targetingMode || 'CLOSEST') === info.mode ? '#4a9eff' : '#444'}; 
                color: white; 
                border: none; 
                padding: 8px; 
                border-radius: 5px; 
                cursor: pointer;
                font-size: 0.9em;
                transition: background 0.2s;
              "
              title="${info.description}"
            >
              ${info.icon} ${info.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // Add event listeners for targeting mode buttons
    content.querySelectorAll('.targeting-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const button = e.currentTarget; // Use currentTarget instead of target
        const mode = button.dataset.mode;
        
        console.log('🎯 Changing targeting mode to:', mode, 'for tower:', tower.id);
        
        this.changeTowerTargetingMode(tower.id, mode);
        
        // Update button states immediately
        content.querySelectorAll('.targeting-mode-btn').forEach(b => {
          b.style.background = '#444';
        });
        button.style.background = '#4a9eff';
        
        // Update the tower object locally for immediate UI feedback
        tower.targetingMode = mode;
      });
      
      // Hover effect
      btn.addEventListener('mouseenter', (e) => {
        const button = e.currentTarget;
        if ((tower.targetingMode || 'CLOSEST') !== button.dataset.mode) {
          button.style.background = '#555';
        }
      });
      
      btn.addEventListener('mouseleave', (e) => {
        const button = e.currentTarget;
        if ((tower.targetingMode || 'CLOSEST') !== button.dataset.mode) {
          button.style.background = '#444';
        }
      });
    });

    modal.appendChild(content);
    return modal;
  }

  changeTowerTargetingMode(towerId, mode) {
    console.log('🎯 Changing targeting mode for tower', towerId, 'to', mode);
    
    this.socket.emit(GAME_EVENTS.CHANGE_TARGETING_MODE, {
      towerId: towerId,
      mode: mode
    });
  }

  calculateSpecialEffects(tower) {
    const effects = [];
    
    if (!tower.towerType || !tower.quality) return effects;
    
    const qualityMultiplier = tower.quality.multiplier || 1;
    const level = tower.quality.level || 0;
    
    switch (tower.towerType.name) {
      case 'Feu':
        const fireDamage = Math.round(tower.stats.damage * 0.5 * qualityMultiplier);
        const fireDuration = 3 + level;
        effects.push({
          name: 'Dégâts de Flamme',
          value: `${fireDamage} dégâts/s pendant ${fireDuration}s`,
          icon: '🔥'
        });
        break;
        
      case 'Glace':
        const slowPercent = Math.round(30 + (level * 5));
        const slowDuration = 2 + level;
        effects.push({
          name: 'Ralentissement',
          value: `-${slowPercent}% vitesse pendant ${slowDuration}s`,
          icon: '❄️'
        });
        break;
        
      case 'Acide':
        const armorReduction = Math.round(25 + (level * 5));
        const acidDuration = 5 + level;
        effects.push({
          name: 'Réduction d\'armure',
          value: `-${armorReduction}% armure pendant ${acidDuration}s`,
          icon: '🧪'
        });
        break;
        
      case 'Terre':
        const aoeRadius = 50 + (level * 10);
        const stunDuration = 1 + (level * 0.5);
        effects.push({
          name: 'Zone d\'effet',
          value: `Rayon: ${aoeRadius}px, Étourdissement: ${stunDuration}s`,
          icon: '🪨'
        });
        break;
        
      case 'Vent':
        const pullForce = 20 + (level * 5);
        const vortexRadius = 80 + (level * 10);
        effects.push({
          name: 'Vortex',
          value: `Force: ${pullForce}, Rayon: ${vortexRadius}px`,
          icon: '🌪️'
        });
        break;
        
      case 'Ténèbres':
        const darkDamage = Math.round(tower.stats.damage * 1.5 * qualityMultiplier);
        effects.push({
          name: 'Dégâts des Ténèbres',
          value: `${darkDamage} dégâts purs`,
          icon: '🌑'
        });
        break;
    }
    
    return effects;
  }

  calculateStatBonuses(tower) {
    const bonuses = [];
    
    if (!tower.stats || !tower.baseStats) return bonuses;
    
    // Calcul des bonus de statistiques
    const damageBonus = tower.stats.damage - tower.baseStats.damage;
    const speedBonus = tower.stats.attackSpeed - tower.baseStats.attackSpeed;
    const rangeBonus = tower.stats.range - tower.baseStats.range;
    
    if (damageBonus > 0) {
      bonuses.push({
        stat: 'Dégâts',
        bonus: `+${damageBonus}`,
        percentage: Math.round((damageBonus / tower.baseStats.damage) * 100)
      });
    }
    
    if (speedBonus > 0) {
      bonuses.push({
        stat: 'Vitesse d\'attaque',
        bonus: `+${speedBonus.toFixed(1)}/s`,
        percentage: Math.round((speedBonus / tower.baseStats.attackSpeed) * 100)
      });
    }
    
    if (rangeBonus > 0) {
      bonuses.push({
        stat: 'Portée',
        bonus: `+${rangeBonus}`,
        percentage: Math.round((rangeBonus / tower.baseStats.range) * 100)
      });
    }
    
    // Bonus de qualité
    if (tower.quality && tower.quality.level > 0) {
      const qualityBonus = Math.round(((tower.quality.multiplier || 1) - 1) * 100);
      bonuses.push({
        stat: 'Qualité',
        bonus: `+${qualityBonus}%`,
        percentage: qualityBonus
      });
    }
    
    return bonuses;
  }

  sendChatMessage(message) {
    if (!message || typeof message !== 'string') {
      return;
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return;
    }

    // Sécurisation XSS : échapper les caractères spéciaux
    const sanitizedMessage = this.sanitizeMessage(trimmedMessage);
    
    console.log('💬 Sending chat message:', sanitizedMessage);
    this.socket.emit(GAME_EVENTS.CHAT_MESSAGE, { message: sanitizedMessage });
  }

  sanitizeMessage(message) {
    // Échapper les caractères HTML dangereux pour éviter l'injection XSS
    return message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  displayChatMessage(data) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    
    // Création sécurisée du contenu du message
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'chat-timestamp';
    timestampSpan.textContent = `[${timestamp}]`;
    
    const playerSpan = document.createElement('span');
    playerSpan.className = 'chat-player';
    playerSpan.textContent = `${data.playerName}:`;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = data.message; // Utilisation de textContent pour éviter l'injection HTML
    
    messageDiv.appendChild(timestampSpan);
    messageDiv.appendChild(document.createTextNode(' '));
    messageDiv.appendChild(playerSpan);
    messageDiv.appendChild(document.createTextNode(' '));
    messageDiv.appendChild(textSpan);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  toggleChat() {
    const chatContainer = document.getElementById('chatContainer');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    
    if (!chatContainer || !chatToggleBtn) return;
    
    const isMinimized = chatContainer.classList.contains('minimized');
    
    if (isMinimized) {
      // Ouvrir le chat
      chatContainer.classList.remove('minimized');
      chatToggleBtn.textContent = '−';
      chatToggleBtn.title = 'Fermer le chat';
    } else {
      // Fermer le chat
      chatContainer.classList.add('minimized');
      chatToggleBtn.textContent = '+';
      chatToggleBtn.title = 'Ouvrir le chat';
    }
  }

  toggleInventory() {
    const inventory = document.getElementById('playerInventory');
    const toggleBtn = document.getElementById('inventoryToggle');
    
    if (!inventory || !toggleBtn) return;
    
    const isCollapsed = inventory.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expand inventory
      inventory.classList.remove('collapsed');
      toggleBtn.textContent = '−';
      toggleBtn.title = 'Réduire l\'inventaire';
    } else {
      // Collapse inventory
      inventory.classList.add('collapsed');
      toggleBtn.textContent = '+';
      toggleBtn.title = 'Agrandir l\'inventaire';
    }
  }

  updateChatVisibility(playerCount) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    
    // Fermer automatiquement le chat si le joueur est seul
    if (playerCount <= 1) {
      chatContainer.classList.add('minimized');
      const chatToggleBtn = document.getElementById('chatToggleBtn');
      if (chatToggleBtn) {
        chatToggleBtn.textContent = '+';
        chatToggleBtn.title = 'Ouvrir le chat';
      }
    }
    // Optionnel : ouvrir automatiquement quand d'autres joueurs rejoignent
    else if (playerCount > 1 && chatContainer.classList.contains('minimized')) {
      // On peut choisir de l'ouvrir automatiquement ou laisser le joueur décider
      // Pour l'instant, on laisse fermé et le joueur peut l'ouvrir manuellement
    }
  }

  // Debug methods
  debugSkipToWave(waveNumber) {
    console.log(`🔧 Debug: Skipping to wave ${waveNumber}`);
    this.socket.emit(GAME_EVENTS.DEBUG_SKIP_TO_WAVE, { waveNumber });
    
    // Show debug notification
    this.showDebugNotification(`Saut vers la vague ${waveNumber}`);
  }

  showDebugNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'map-expansion-notification debug';
    notification.innerHTML = `
      <h3>🔧 Mode Debug</h3>
      <p>${message}</p>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  showDestroyedTowersNotification(destroyedTowers) {
    const notification = document.createElement('div');
    notification.className = 'map-expansion-notification destroyed-towers';
    notification.innerHTML = `
      <h3>💥 Tours détruites!</h3>
      <p>L'expansion de la map a détruit ${destroyedTowers.length} tour(s):</p>
      <ul>
        ${destroyedTowers.map(tower => `<li>${tower.type || 'Tour'} en (${Math.round(tower.x)}, ${Math.round(tower.y)})</li>`).join('')}
      </ul>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  showMapExpansionNotification(newPath) {
    const notification = document.createElement('div');
    notification.className = 'map-expansion-notification new-path';
    notification.innerHTML = `
      <h3>🗺️ Carte agrandie!</h3>
      <p>Un nouveau chemin "${newPath.id}" est apparu!</p>
      <p>La carte s'est agrandie et les ennemis peuvent maintenant emprunter plusieurs chemins.</p>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  // Show instruction overlay when applying effect
  showEffectApplicationInstructions(effectName) {
    // Remove any existing instructions
    this.hideEffectApplicationInstructions();
    
    const instruction = document.createElement('div');
    instruction.id = 'effect-application-instruction';
    instruction.className = 'effect-application-instruction';
    instruction.innerHTML = `
      <div class="instruction-content">
        <h3>✨ Application d'effet</h3>
        <p>Cliquez sur une tour pour lui appliquer l'effet : <strong>${effectName}</strong></p>
        <p><small>Clic droit pour annuler</small></p>
      </div>
    `;
    
    document.body.appendChild(instruction);
  }

  hideEffectApplicationInstructions() {
    const existing = document.getElementById('effect-application-instruction');
    if (existing) {
      existing.remove();
    }
  }
}

window.GameClient = GameClient;
