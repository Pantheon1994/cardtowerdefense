const { ENEMY_TYPES } = require('../constants/events');

class WaveManager {
  constructor() {
    this.enemyTemplates = {
      goblin: {
        name: "Gobelin",
        health: 100,
        speed: 50,
        armor: 0,
        magicResist: 0,
        reward: 10,
        color: "#27ae60",
        types: [ENEMY_TYPES.NORMAL]
      },
      orc: {
        name: "Orc",
        health: 150,
        speed: 40,
        armor: 5,
        magicResist: 0,
        reward: 15,
        color: "#e74c3c",
        types: [ENEMY_TYPES.ARMORED]
      },
      scout: {
        name: "Éclaireur",
        health: 80,
        speed: 80,
        armor: 0,
        magicResist: 0,
        reward: 12,
        color: "#f39c12",
        types: [ENEMY_TYPES.FAST]
      },
      mage: {
        name: "Mage",
        health: 120,
        speed: 45,
        armor: 0,
        magicResist: 50,
        reward: 20,
        color: "#9b59b6",
        types: [ENEMY_TYPES.MAGICAL]
      },
      assassin: {
        name: "Assassin",
        health: 90,
        speed: 60,
        armor: 0,
        magicResist: 0,
        reward: 18,
        color: "#34495e",
        types: [ENEMY_TYPES.INVISIBLE]
      },
      armored_scout: {
        name: "Éclaireur Blindé",
        health: 110,
        speed: 65,
        armor: 3,
        magicResist: 0,
        reward: 25,
        color: "#e67e22",
        types: [ENEMY_TYPES.FAST, ENEMY_TYPES.ARMORED]
      }
    };
  }

  getWaveEnemies(waveNumber) {
    const enemies = [];
    const waveConfig = this.generateWaveConfig(waveNumber);
    const path = this.getPath();
    
    let totalEnemyCount = 0;
    waveConfig.enemies.forEach(enemyConfig => {
      totalEnemyCount += enemyConfig.count;
    });
    
    let currentEnemyIndex = 0;
    
    waveConfig.enemies.forEach((enemyConfig, groupIndex) => {
      const template = this.enemyTemplates[enemyConfig.type];
      if (template) {
        for (let i = 0; i < enemyConfig.count; i++) {
          const enemy = {
            ...template,
            id: `wave${waveNumber}_${enemyConfig.type}_${i}`,
            // Spawn delay for staggered spawning
            spawnDelay: currentEnemyIndex * 1200, // 1.2 secondes entre chaque
            health: Math.floor(template.health * waveConfig.healthMultiplier),
            armor: Math.floor(template.armor * waveConfig.armorMultiplier),
            magicResist: Math.floor(template.magicResist * waveConfig.resistMultiplier),
            // Initialize movement properties - will be set when spawned
            x: path[0].x,
            y: path[0].y,
            currentPathIndex: 0,
            isSpawned: false, // Will spawn with delay
            maxHealth: Math.floor(template.health * waveConfig.healthMultiplier),
            effects: {},
            spawnTime: null // Will be set when wave starts
          };
          
          // Add movement methods
          enemy.move = this.createMoveFunction(enemy);
          enemy.hasReachedBase = () => enemy.currentPathIndex >= path.length - 1;
          
          enemies.push(enemy);
          currentEnemyIndex++;
        }
      }
    });

    console.log(`Wave ${waveNumber}: ${enemies.length} enemies with spawn delays from 0 to ${(enemies.length-1) * 1200}ms`);
    return enemies;
  }

  spawnWave(waveNumber) {
    const enemies = this.getWaveEnemies(waveNumber);
    const path = this.getPath();
    
    // Add spawn timing and position
    enemies.forEach(enemy => {
      enemy.x = path[0].x; // Start position
      enemy.y = path[0].y; // Start position
      enemy.currentPathIndex = 0;
      enemy.spawnTime = Date.now() + enemy.spawnDelay;
      enemy.isSpawned = false;
      enemy.maxHealth = enemy.health; // Store original health
      enemy.effects = {}; // Initialize effects
      
      // Add movement methods
      enemy.move = this.createMoveFunction(enemy);
      enemy.hasReachedBase = () => enemy.currentPathIndex >= path.length - 1;
    });

    return enemies;
  }

  generateWaveConfig(waveNumber) {
    const baseConfig = {
      healthMultiplier: 1 + (waveNumber - 1) * 0.15,
      armorMultiplier: 1 + (waveNumber - 1) * 0.1,
      resistMultiplier: 1 + (waveNumber - 1) * 0.05,
      enemies: []
    };

    // Define enemy composition based on wave number
    if (waveNumber <= 3) {
      // Early waves: mostly normal enemies
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(5 + waveNumber * 2) }
      ];
    } else if (waveNumber <= 6) {
      // Mid waves: introduce armored and fast
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(3 + waveNumber) },
        { type: 'orc', count: Math.floor(waveNumber / 2) },
        { type: 'scout', count: Math.floor(waveNumber / 3) }
      ];
    } else if (waveNumber <= 10) {
      // Advanced waves: add magical and invisible
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(2 + waveNumber / 2) },
        { type: 'orc', count: Math.floor(waveNumber / 2) },
        { type: 'scout', count: Math.floor(waveNumber / 2) },
        { type: 'mage', count: Math.floor(waveNumber / 4) },
        { type: 'assassin', count: Math.floor(waveNumber / 5) }
      ];
    } else {
      // Boss waves: mixed types including combinations
      baseConfig.enemies = [
        { type: 'goblin', count: Math.floor(waveNumber / 2) },
        { type: 'orc', count: Math.floor(waveNumber / 2) },
        { type: 'scout', count: Math.floor(waveNumber / 3) },
        { type: 'mage', count: Math.floor(waveNumber / 3) },
        { type: 'assassin', count: Math.floor(waveNumber / 4) },
        { type: 'armored_scout', count: Math.floor(waveNumber / 6) }
      ];
    }

    return baseConfig;
  }

  createMoveFunction(enemy) {
    const path = this.getPath();
    return function() {
      // Only move if spawned
      if (!this.isSpawned) return;

      if (this.currentPathIndex >= path.length - 1) return;

      const currentTarget = path[this.currentPathIndex + 1];
      const dx = currentTarget.x - this.x;
      const dy = currentTarget.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        this.currentPathIndex++;
        return;
      }

      let effectiveSpeed = this.speed;
      
      // Apply slow effect if present
      if (this.effects && this.effects.slowed) {
        const slowEffect = this.effects.slowed;
        if (Date.now() - slowEffect.appliedAt < slowEffect.duration) {
          effectiveSpeed *= slowEffect.slowAmount;
        } else {
          delete this.effects.slowed;
        }
      }

      const moveDistance = effectiveSpeed / 60; // 60 FPS
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;
    }.bind(enemy);
  }

  getPath() {
    // Simple path for now - should be configurable per map
    return [
      { x: 0, y: 300 },
      { x: 200, y: 300 },
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 400 },
      { x: 600, y: 400 },
      { x: 600, y: 300 },
      { x: 800, y: 300 }
    ];
  }
}

module.exports = WaveManager;
