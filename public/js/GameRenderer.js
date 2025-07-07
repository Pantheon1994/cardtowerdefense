class GameRenderer {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.path = [
      { x: 0, y: 300 },
      { x: 200, y: 300 },
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 400 },
      { x: 600, y: 400 },
      { x: 600, y: 300 },
      { x: 800, y: 300 }
    ];
    
    // Grid system
    this.gridCellSize = 40; // Même valeur que GRID_CONFIG.CELL_SIZE
    this.showGrid = false;
    this.previewPosition = null; // Position de la hitbox de prévisualisation
    this.gameState = null; // Pour accéder aux tours existantes
    
    // Generate tower placement zones automatically along the path
    this.towerZones = this.generateTowerZones();
  }

  generateTowerZones() {
    const zones = [];
    const pathBuffer = 50; // Distance from path where towers can be placed
    const zoneSize = 40; // Size of each tower zone
    const zoneSpacing = 60; // Spacing between zones
    
    // Generate zones along both sides of the path
    for (let i = 0; i < this.path.length - 1; i++) {
      const current = this.path[i];
      const next = this.path[i + 1];
      
      // Calculate direction vector
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) continue;
      
      // Normalize direction
      const unitX = dx / length;
      const unitY = dy / length;
      
      // Perpendicular vectors for left and right sides
      const perpX = -unitY;
      const perpY = unitX;
      
      // Generate zones along this segment
      const segmentZones = Math.floor(length / zoneSpacing);
      
      for (let j = 0; j <= segmentZones; j++) {
        const t = j / Math.max(segmentZones, 1);
        const segmentX = current.x + t * dx;
        const segmentY = current.y + t * dy;
        
        // Left side zones
        const leftX = segmentX + perpX * pathBuffer;
        const leftY = segmentY + perpY * pathBuffer;
        if (this.isInBounds(leftX, leftY, zoneSize)) {
          zones.push({
            x: leftX - zoneSize/2,
            y: leftY - zoneSize/2,
            width: zoneSize,
            height: zoneSize
          });
        }
        
        // Right side zones
        const rightX = segmentX - perpX * pathBuffer;
        const rightY = segmentY - perpY * pathBuffer;
        if (this.isInBounds(rightX, rightY, zoneSize)) {
          zones.push({
            x: rightX - zoneSize/2,
            y: rightY - zoneSize/2,
            width: zoneSize,
            height: zoneSize
          });
        }
      }
    }
    
    return zones;
  }

  isInBounds(x, y, size) {
    const margin = size/2 + 10;
    return x >= margin && 
           x <= this.canvas.width - margin && 
           y >= margin && 
           y <= this.canvas.height - margin;
  }

  render(gameState) {
    this.gameState = gameState; // Stocker pour la validation de grille
    this.clearCanvas();
    this.drawBackground();
    this.drawPath();
    
    // Dessiner la grille si nécessaire
    if (this.showGrid) {
      this.drawGrid();
    }
    
    // Dessiner la hitbox de prévisualisation si active
    if (this.previewPosition) {
      this.drawPreviewHitbox();
    }
    
    if (gameState) {
      this.drawTowers(gameState.towers || []);
      this.drawEnemies(gameState.enemies || []);
      this.drawProjectiles(gameState.projectiles || []);
      this.drawBase();
      this.drawWaveInfo(gameState);
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawBackground() {
    // Draw grass background
    this.ctx.fillStyle = '#4a7c59';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Add some texture with dots
    this.ctx.fillStyle = '#5d8a6b';
    for (let x = 0; x < this.canvas.width; x += 20) {
      for (let y = 0; y < this.canvas.height; y += 20) {
        if (Math.random() > 0.7) {
          this.ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  }

  drawPath() {
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 40;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.path[0].x, this.path[0].y);
    
    for (let i = 1; i < this.path.length; i++) {
      this.ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    
    this.ctx.stroke();
    
    // Draw path border
    this.ctx.strokeStyle = '#654321';
    this.ctx.lineWidth = 45;
    this.ctx.globalCompositeOperation = 'destination-over';
    this.ctx.stroke();
    this.ctx.globalCompositeOperation = 'source-over';
  }

  drawTowerZones() {
    this.towerZones.forEach((zone, index) => {
      // Base zone appearance
      this.ctx.fillStyle = 'rgba(102, 204, 102, 0.3)'; // Light green with transparency
      this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      
      // Border
      this.ctx.strokeStyle = '#66cc66';
      this.ctx.setLineDash([3, 3]);
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      this.ctx.setLineDash([]);
      
      // Small center dot to indicate exact placement point
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;
      this.ctx.fillStyle = '#44aa44';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, 2, 0, 2 * Math.PI);
      this.ctx.fill();
    });
  }

  drawBase() {
    const baseX = this.path[this.path.length - 1].x;
    const baseY = this.path[this.path.length - 1].y;
    
    // Draw base
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(baseX - 20, baseY - 30, 40, 60);
    
    this.ctx.fillStyle = '#DC143C';
    this.ctx.fillRect(baseX - 15, baseY - 25, 30, 20);
    
    // Draw flag
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(baseX + 15, baseY - 25, 15, 10);
    
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(baseX + 15, baseY - 25);
    this.ctx.lineTo(baseX + 15, baseY - 40);
    this.ctx.stroke();
  }

  drawTowers(towers) {
    towers.forEach(tower => {
      this.drawTower(tower);
    });
  }

  drawTower(tower) {
    const towerType = TOWER_TYPES[tower.type];
    if (!towerType) return;

    // Get quality color
    const qualityColors = {
      0: '#696969', // Normal (gris)
      1: '#4169E1', // Blue (bleu)
      2: '#9932CC', // Epic (violet)
      3: '#FFD700'  // Legendary (or)
    };
    const qualityColor = qualityColors[tower.qualityLevel] || '#696969';

    // Draw tower base with quality color
    this.ctx.fillStyle = qualityColor;
    this.ctx.fillRect(tower.x - 15, tower.y - 15, 30, 30);
    
    // Draw tower top with type color
    this.ctx.fillStyle = towerType.color;
    this.ctx.fillRect(tower.x - 12, tower.y - 12, 24, 24);
    
    // Draw tower emoji/symbol
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(towerType.emoji, tower.x, tower.y + 7);
    
    // Draw range circle (semi-transparent)
    if (tower.range) {
      this.ctx.strokeStyle = towerType.color;
      this.ctx.setLineDash([3, 3]);
      this.ctx.lineWidth = 1;
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.arc(tower.x, tower.y, tower.range, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      this.ctx.setLineDash([]);
    }
    
    // Draw effects indicators
    if (tower.effects && tower.effects.length > 0) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fillRect(tower.x + 10, tower.y - 20, 8, 8);
      this.ctx.fillStyle = '#000';
      this.ctx.font = '10px Arial';
      this.ctx.fillText(tower.effects.length, tower.x + 14, tower.y - 14);
    }

    // Draw quality level indicator
    if (tower.qualityLevel && tower.qualityLevel > 0) {
      this.ctx.fillStyle = qualityColor;
      for (let i = 0; i < tower.qualityLevel; i++) {
        this.ctx.fillRect(tower.x - 15 + (i * 4), tower.y - 25, 3, 3);
      }
    }
  }

  drawEnemies(enemies) {
    const currentTime = Date.now();
    
    enemies.forEach(enemy => {
      if (enemy.isSpawned) {
        this.drawEnemy(enemy);
      } else {
        // Dessiner un indicateur de spawn à venir
        this.drawSpawnIndicator(enemy, currentTime);
      }
    });
  }

  drawEnemy(enemy) {
    // Special visualization for healers
    if (enemy.types && enemy.types.includes('healer')) {
      this.drawHealerEnemy(enemy);
    } else {
      // Draw regular enemy body
      this.ctx.fillStyle = enemy.color || '#e74c3c';
      this.ctx.beginPath();
      this.ctx.arc(enemy.x, enemy.y, 10, 0, 2 * Math.PI);
      this.ctx.fill();
    }

    // Draw visual effects around enemy
    this.drawEnemyEffects(enemy);
    
    // Draw health bar
    const healthBarWidth = 20;
    const healthBarHeight = 4;
    const healthPercent = enemy.health / (enemy.maxHealth || enemy.health);
    
    // Background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(enemy.x - healthBarWidth / 2, enemy.y - 20, healthBarWidth, healthBarHeight);
    
    // Health
    this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FF9800' : '#f44336';
    this.ctx.fillRect(enemy.x - healthBarWidth / 2, enemy.y - 20, healthBarWidth * healthPercent, healthBarHeight);
    
    // Draw enemy type indicators
    let indicatorY = enemy.y + 18;
    
    if (enemy.types) {
      enemy.types.forEach(type => {
        this.ctx.fillStyle = this.getTypeColor(type);
        this.ctx.fillRect(enemy.x - 8, indicatorY, 16, 3);
        indicatorY += 4;
      });
    }
    
    // Draw armor/resist indicators
    if (enemy.armor > 0) {
      this.ctx.fillStyle = '#95a5a6';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🛡️', enemy.x - 15, enemy.y);
    }
    
    if (enemy.magicResist > 0) {
      this.ctx.fillStyle = '#9b59b6';
      this.ctx.font = '8px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('🔮', enemy.x + 15, enemy.y);
    }
  }

  drawHealerEnemy(enemy) {
    const currentTime = Date.now();
    const pulse = Math.sin(currentTime / 300) * 0.2 + 0.8;
    
    // Draw healer body with pulsing effect
    this.ctx.fillStyle = enemy.color || '#1abc9c';
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 12 * pulse, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw healing aura
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = '#00FF00';
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, enemy.healRadius || 80, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
    
    // Draw healing cross symbol
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(enemy.x - 6, enemy.y);
    this.ctx.lineTo(enemy.x + 6, enemy.y);
    this.ctx.moveTo(enemy.x, enemy.y - 6);
    this.ctx.lineTo(enemy.x, enemy.y + 6);
    this.ctx.stroke();
    
    // Draw healing particles
    const numParticles = 4;
    for (let i = 0; i < numParticles; i++) {
      const angle = (i * 2 * Math.PI / numParticles) + currentTime / 500;
      const radius = 20 + Math.sin(currentTime / 200 + i) * 5;
      const particleX = enemy.x + Math.cos(angle) * radius;
      const particleY = enemy.y + Math.sin(angle) * radius;
      
      this.ctx.globalAlpha = 0.6 + Math.sin(currentTime / 300 + i) * 0.3;
      this.ctx.fillStyle = '#90EE90';
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 2, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    this.ctx.globalAlpha = 1.0;
  }

  drawEnemyEffects(enemy) {
    if (!enemy.effects) return;
    
    const currentTime = Date.now();
    
    // Draw all active effects
    Object.keys(enemy.effects).forEach(effectName => {
      const effect = enemy.effects[effectName];
      if (effect.visualEffect) {
        this.drawVisualEffect(enemy, effect.visualEffect, currentTime);
      }
    });
  }

  drawVisualEffect(enemy, visualEffect, currentTime) {
    const { type, color, particleColor, intensity, animation } = visualEffect;
    
    switch (type) {
      case 'fire':
        this.drawFireEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'ice':
        this.drawIceEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'acid':
        this.drawAcidEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'earth':
        this.drawEarthEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'wind':
        this.drawWindEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'heal':
        this.drawHealEffect(enemy, color, particleColor, intensity, currentTime);
        break;
      case 'anti_heal':
        this.drawAntiHealEffect(enemy, color, particleColor, intensity, currentTime);
        break;
    }
  }

  drawFireEffect(enemy, color, particleColor, intensity, currentTime) {
    // Flame particles around the enemy
    const numParticles = Math.floor(3 * intensity);
    const radius = 18;
    
    for (let i = 0; i < numParticles; i++) {
      const angle = (currentTime / 100 + i * 2 * Math.PI / numParticles) % (2 * Math.PI);
      const flicker = Math.sin(currentTime / 50 + i) * 0.3 + 0.7;
      const particleX = enemy.x + Math.cos(angle) * radius * flicker;
      const particleY = enemy.y + Math.sin(angle) * radius * flicker - 5;
      
      this.ctx.globalAlpha = 0.8 * flicker;
      this.ctx.fillStyle = Math.random() > 0.5 ? color : particleColor;
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 2 + Math.random() * 2, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    // Orange glow around enemy
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 16, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawIceEffect(enemy, color, particleColor, intensity, currentTime) {
    // Ice crystals around the enemy
    const numCrystals = Math.floor(4 * intensity);
    const radius = 16;
    
    for (let i = 0; i < numCrystals; i++) {
      const angle = i * 2 * Math.PI / numCrystals;
      const shimmer = Math.sin(currentTime / 200 + i) * 0.2 + 0.8;
      const crystalX = enemy.x + Math.cos(angle) * radius;
      const crystalY = enemy.y + Math.sin(angle) * radius;
      
      this.ctx.globalAlpha = 0.7 * shimmer;
      this.ctx.fillStyle = particleColor;
      this.ctx.fillRect(crystalX - 1, crystalY - 1, 2, 2);
      
      // Draw ice shard lines
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(crystalX - 3, crystalY - 3);
      this.ctx.lineTo(crystalX + 3, crystalY + 3);
      this.ctx.stroke();
    }
    
    // Blue tint around enemy
    this.ctx.globalAlpha = 0.25;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 14, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawAcidEffect(enemy, color, particleColor, intensity, currentTime) {
    // Acid bubbles and corrosion
    const numBubbles = Math.floor(3 * intensity);
    
    for (let i = 0; i < numBubbles; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 15;
      const bubbleX = enemy.x + Math.cos(angle) * distance;
      const bubbleY = enemy.y + Math.sin(angle) * distance;
      const bubbleSize = Math.random() * 3 + 1;
      
      this.ctx.globalAlpha = 0.6;
      this.ctx.fillStyle = particleColor;
      this.ctx.beginPath();
      this.ctx.arc(bubbleX, bubbleY, bubbleSize, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    // Purple corrosion glow
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 15, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawEarthEffect(enemy, color, particleColor, intensity, currentTime) {
    // Rock particles and dust
    const numRocks = Math.floor(4 * intensity);
    const rumble = Math.sin(currentTime / 30) * 2;
    
    for (let i = 0; i < numRocks; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 12 + 8;
      const rockX = enemy.x + Math.cos(angle) * distance + rumble;
      const rockY = enemy.y + Math.sin(angle) * distance + rumble;
      
      this.ctx.globalAlpha = 0.8;
      this.ctx.fillStyle = i % 2 === 0 ? color : particleColor;
      this.ctx.fillRect(rockX - 1, rockY - 1, 3, 3);
    }
    
    // Brown dust cloud
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x + rumble, enemy.y + rumble, 18, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawWindEffect(enemy, color, particleColor, intensity, currentTime) {
    // Swirling wind particles
    const numParticles = Math.floor(5 * intensity);
    const swirl = currentTime / 100;
    
    for (let i = 0; i < numParticles; i++) {
      const baseAngle = i * 2 * Math.PI / numParticles;
      const angle = baseAngle + swirl + Math.sin(swirl + i) * 0.5;
      const distance = 12 + Math.sin(swirl * 2 + i) * 6;
      const particleX = enemy.x + Math.cos(angle) * distance;
      const particleY = enemy.y + Math.sin(angle) * distance;
      
      this.ctx.globalAlpha = 0.7;
      this.ctx.fillStyle = i % 2 === 0 ? color : particleColor;
      
      // Draw small wind streaks
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 1, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw motion trails
      const trailX = particleX - Math.cos(angle) * 5;
      const trailY = particleY - Math.sin(angle) * 5;
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(trailX, trailY);
      this.ctx.lineTo(particleX, particleY);
      this.ctx.stroke();
    }
    
    // Green wind aura
    this.ctx.globalAlpha = 0.2;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(enemy.x, enemy.y, 20, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  drawProjectiles(projectiles) {
    projectiles.forEach(projectile => {
      this.drawProjectile(projectile);
    });
  }

  drawProjectile(projectile) {
    const color = this.getProjectileColor(projectile.effect);
    
    // Draw projectile trail
    this.ctx.globalAlpha = 0.5;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 8, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // Draw projectile core
    this.ctx.globalAlpha = 1.0;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Add glow effect
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(projectile.x, projectile.y, 10, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.globalAlpha = 1.0;
  }

  getProjectileColor(effect) {
    switch (effect) {
      case 'dot': return '#FF4500'; // Fire/Feu
      case 'slow': return '#87CEEB'; // Ice/Glace
      case 'armor_reduction': return '#9400D3'; // Acid/Acide
      case 'aoe': return '#8B4513'; // Earth/Terre
      case 'vortex': return '#32CD32'; // Wind/Vent
      case 'none': return '#2C2C2C'; // Shadow/Ténèbres
      default: return '#FFD700'; // Default gold
    }
  }

  // Utility method to check if point is in tower zone
  isPointInTowerZone(x, y) {
    return this.towerZones.some(zone => 
      x >= zone.x && x <= zone.x + zone.width &&
      y >= zone.y && y <= zone.y + zone.height
    );
  }

  isClickInTowerZone(x, y) {
    return this.towerZones.some(zone => 
      x >= zone.x && 
      x <= zone.x + zone.width && 
      y >= zone.y && 
      y <= zone.y + zone.height
    );
  }

  getNearestTowerZone(x, y) {
    let nearestZone = null;
    let minDistance = Infinity;
    
    this.towerZones.forEach(zone => {
      const centerX = zone.x + zone.width / 2;
      const centerY = zone.y + zone.height / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = { x: centerX, y: centerY, zone };
      }
    });
    
    return nearestZone;
  }

  getTypeColor(type) {
    switch(type) {
      case 'normal': return '#27ae60';
      case 'armored': return '#95a5a6';
      case 'fast': return '#f39c12';
      case 'magical': return '#9b59b6';
      case 'invisible': return '#34495e';
      case 'healer': return '#1abc9c';
      default: return '#e74c3c';
    }
  }

  drawSpawnIndicator(enemy, currentTime) {
    if (!enemy.spawnTime) return;
    
    const timeLeft = enemy.spawnTime - currentTime;
    if (timeLeft <= 0) return;
    
    // Draw a small indicator at spawn point
    const spawnX = 0;
    const spawnY = 300;
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.beginPath();
    this.ctx.arc(spawnX, spawnY, 5, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Draw countdown
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(Math.ceil(timeLeft/1000), spawnX, spawnY - 10);
  }

  drawWaveInfo(gameState) {
    if (!gameState || !gameState.enemies) return;
    
    const spawnedCount = gameState.enemies.filter(e => e.isSpawned).length;
    const totalCount = gameState.enemies.length;
    const remainingCount = totalCount - spawnedCount;
    
    // Afficher les stats de la vague en haut à droite
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.canvas.width - 200, 10, 190, 60);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Vague ${gameState.currentWave || 1}`, this.canvas.width - 190, 30);
    this.ctx.fillText(`Spawned: ${spawnedCount}/${totalCount}`, this.canvas.width - 190, 45);
    this.ctx.fillText(`À venir: ${remainingCount}`, this.canvas.width - 190, 60);
  }

  // === GRID SYSTEM ===
  
  drawGrid() {
    const cellSize = this.gridCellSize;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    
    // Lignes verticales
    for (let x = 0; x <= this.canvas.width; x += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    // Lignes horizontales
    for (let y = 0; y <= this.canvas.height; y += cellSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawPreviewHitbox() {
    if (!this.previewPosition) return;
    
    const gridPos = this.snapToGrid(this.previewPosition.x, this.previewPosition.y);
    const isValid = this.isValidGridPosition(gridPos.x, gridPos.y);
    
    // Couleur selon la validité
    const color = isValid ? '#00ff00' : '#ff0000';
    this.ctx.fillStyle = color + 'B3'; // 70% opacity
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    
    // Dessiner la hitbox
    const halfSize = this.gridCellSize / 2;
    this.ctx.fillRect(
      gridPos.x - halfSize, 
      gridPos.y - halfSize, 
      this.gridCellSize, 
      this.gridCellSize
    );
    this.ctx.strokeRect(
      gridPos.x - halfSize, 
      gridPos.y - halfSize, 
      this.gridCellSize, 
      this.gridCellSize
    );
  }

  snapToGrid(x, y) {
    const cellSize = this.gridCellSize;
    const gridX = Math.round(x / cellSize) * cellSize;
    const gridY = Math.round(y / cellSize) * cellSize;
    return { x: gridX, y: gridY };
  }

  isValidGridPosition(x, y) {
    // Vérifier les limites
    const halfSize = this.gridCellSize / 2;
    if (x - halfSize < 0 || x + halfSize > this.canvas.width || 
        y - halfSize < 0 || y + halfSize > this.canvas.height) {
      return false;
    }
    
    // Vérifier la distance du chemin
    if (!this.isValidDistanceFromPath(x, y)) {
      return false;
    }
    
    // Vérifier les tours existantes
    if (this.gameState && this.gameState.towers) {
      for (const tower of this.gameState.towers) {
        const distance = Math.sqrt((tower.x - x) ** 2 + (tower.y - y) ** 2);
        if (distance < this.gridCellSize) {
          return false;
        }
      }
    }
    
    return true;
  }

  isValidDistanceFromPath(x, y) {
    let minDistance = Infinity;
    
    for (let i = 0; i < this.path.length - 1; i++) {
      const point1 = this.path[i];
      const point2 = this.path[i + 1];
      const distance = this.distanceToLineSegment(x, y, point1.x, point1.y, point2.x, point2.y);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance >= 30 && minDistance <= 120; // 30 = PATH_BUFFER
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

  // Méthodes publiques pour l'interface
  startTowerPlacement() {
    console.log('🎯 Starting tower placement mode');
    this.showGrid = true;
  }

  stopTowerPlacement() {
    console.log('🛑 Stopping tower placement mode');
    this.showGrid = false;
    this.previewPosition = null;
  }

  updatePreviewPosition(x, y) {
    this.previewPosition = { x, y };
    console.log('👆 Preview position updated:', x, y, 'showGrid:', this.showGrid, 'previewPos:', this.previewPosition);
  }

  getSnappedPosition(x, y) {
    const snapped = this.snapToGrid(x, y);
    const isValid = this.isValidGridPosition(snapped.x, snapped.y);
    console.log('📍 Snap check:', { x, y }, '→', snapped, 'valid:', isValid);
    return isValid ? snapped : null;
  }
}
