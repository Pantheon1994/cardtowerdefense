const { TOWER_TYPES, EFFECT_TYPES } = require('../constants/events');

class Tower {
  constructor(id, type, x, y, playerId) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.playerId = playerId;
    this.effects = [];
    
    // Base stats from tower type
    const towerStats = TOWER_TYPES[type];
    this.baseDamage = towerStats.baseDamage;
    this.baseAttackSpeed = towerStats.attackSpeed;
    this.baseRange = towerStats.range;
    this.effect = towerStats.effect;
    
    // Current stats (modified by effects)
    this.damage = this.baseDamage;
    this.attackSpeed = this.baseAttackSpeed;
    this.range = this.baseRange;
    this.maxTargets = 1;
    this.canDetectInvisible = false;
    
    // Quality system (normal = 1, blue = 1.33, epic = 1.77, legendary = 2.36)
    this.quality = 1.0;
    this.qualityLevel = 0; // 0=normal, 1=blue, 2=epic, 3=legendary (max)
    
    // Attack timing
    this.lastAttackTime = 0;
    this.target = null;
    this.projectiles = [];
  }

  update(enemies, gameTime) {
    // Update projectiles
    this.updateProjectiles(enemies, gameTime);
    
    // Check if we can attack
    if (this.canAttack(gameTime)) {
      this.findAndAttackTargets(enemies);
    }
  }

  canAttack(gameTime) {
    const attackInterval = 1000 / this.attackSpeed; // Convert to milliseconds
    const timeSinceLastAttack = gameTime - this.lastAttackTime;
    return timeSinceLastAttack >= attackInterval;
  }

  findAndAttackTargets(enemies) {
    const targetsInRange = this.getEnemiesInRange(enemies);
    
    if (targetsInRange.length === 0) {
      this.target = null;
      return;
    }

    // Select targets based on maxTargets
    const targets = targetsInRange.slice(0, this.maxTargets);
    
    targets.forEach(enemy => {
      this.attackEnemy(enemy);
    });

    this.lastAttackTime = Date.now();
    console.log(`Tower ${this.id} attacked ${targets.length} enemies`);
  }

  getEnemiesInRange(enemies) {
    const enemiesInRange = Array.from(enemies.values())
      .filter(enemy => {
        if (!enemy.isSpawned || enemy.health <= 0) return false;
        
        // Check invisibility detection
        if (enemy.types && enemy.types.includes('invisible') && !this.canDetectInvisible) {
          return false;
        }
        
        const distance = this.getDistance(enemy);
        return distance <= this.range;
      })
      .sort((a, b) => {
        // Prioritize enemies closer to the base (higher path index)
        return b.currentPathIndex - a.currentPathIndex;
      });
    
    if (enemiesInRange.length > 0) {
      console.log(`Tower ${this.id} found ${enemiesInRange.length} enemies in range`);
    }
    
    return enemiesInRange;
  }

  getDistance(enemy) {
    return Math.sqrt((this.x - enemy.x) ** 2 + (this.y - enemy.y) ** 2);
  }

  attackEnemy(enemy) {
    // Create projectile based on tower type
    const projectile = this.createProjectile(enemy);
    this.projectiles.push(projectile);
    console.log(`Tower ${this.id} (${this.type}) created projectile targeting enemy ${enemy.id}`);
  }

  createProjectile(target) {
    return {
      id: `proj_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      x: this.x,
      y: this.y,
      targetId: target.id,
      damage: this.damage,
      speed: 200, // Reduced speed for better visibility
      effect: this.effect,
      towerId: this.id,
      createdAt: Date.now()
    };
  }

  updateProjectiles(enemies, gameTime) {
    this.projectiles = this.projectiles.filter(projectile => {
      const target = enemies.get(projectile.targetId);
      
      // Remove projectile if target is dead or doesn't exist
      if (!target || target.health <= 0 || !target.isSpawned) {
        return false;
      }

      // Move projectile towards target
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if projectile hit target
      if (distance < 15) { // Augmenter la zone de hit
        this.hitEnemy(target, projectile);
        return false; // Remove projectile
      }

      // Move projectile (movement per frame at 60 FPS)
      const moveDistance = projectile.speed / 60; // pixels per frame
      
      if (distance > 0) {
        projectile.x += (dx / distance) * moveDistance;
        projectile.y += (dy / distance) * moveDistance;
      }

      // Remove projectile if it's too old (avoid infinite projectiles)
      if (gameTime - projectile.createdAt > 5000) {
        return false;
      }

      return true; // Keep projectile
    });
  }

  hitEnemy(enemy, projectile) {
    console.log(`Projectile ${projectile.id} hit enemy ${enemy.id} for ${projectile.damage} damage`);
    
    // Apply damage
    const damageDealt = this.applyDamage(enemy, projectile.damage);
    
    // Apply tower-specific effects
    this.applyTowerEffect(enemy, projectile.effect);
    
    console.log(`Enemy ${enemy.id} took ${damageDealt} damage, health now: ${enemy.health}`);
  }

  applyDamage(enemy, damage) {
    let finalDamage = damage;
    
    // Apply armor reduction
    if (enemy.armor > 0) {
      finalDamage = Math.max(1, damage - enemy.armor);
    }
    
    // Apply magic resistance for magical damage
    if (this.type === 'ACID' && enemy.magicResist > 0) {
      finalDamage = Math.max(1, finalDamage * (1 - enemy.magicResist / 100));
    }
    
    enemy.health -= finalDamage;
    return finalDamage;
  }

  applyTowerEffect(enemy, effect) {
    switch (effect) {
      case 'dot':
        this.applyDotEffect(enemy);
        break;
      case 'slow':
        this.applySlowEffect(enemy);
        break;
      case 'armor_reduction':
        this.applyArmorReduction(enemy);
        break;
      case 'aoe':
        this.applyAoeEffect(enemy);
        break;
      case 'vortex':
        this.applyVortexEffect(enemy);
        break;
      case 'none':
        // Pas d'effet spécial (tour Ténèbres)
        break;
    }
  }

  applyDotEffect(enemy) {
    if (!enemy.effects) enemy.effects = {};
    enemy.effects.burning = {
      damage: this.damage * 0.3,
      duration: 3000,
      interval: 500,
      lastTick: Date.now(),
      appliedAt: Date.now(),
      visualEffect: {
        type: 'fire',
        color: '#FF4500',
        particleColor: '#FF6B35',
        intensity: 1.0,
        animation: 'flicker'
      }
    };
    console.log(`Enemy ${enemy.id} is now burning`);
  }

  applySlowEffect(enemy) {
    if (!enemy.effects) enemy.effects = {};
    
    // Ne pas ralentir si déjà ralenti
    if (!enemy.effects.slowed) {
      enemy.originalSpeed = enemy.speed; // Sauvegarder la vitesse originale
      enemy.speed *= 0.5;
    }
    
    enemy.effects.slowed = {
      slowAmount: 0.5,
      duration: 2000,
      appliedAt: Date.now(),
      visualEffect: {
        type: 'ice',
        color: '#87CEEB',
        particleColor: '#B0E0E6',
        intensity: 0.8,
        animation: 'shimmer'
      }
    };
    console.log(`Enemy ${enemy.id} is now slowed`);
  }

  applyArmorReduction(enemy) {
    // Réduit l'armure de 25%
    const reduction = Math.max(1, enemy.armor * 0.25);
    enemy.armor = Math.max(0, enemy.armor - reduction);
    
    // Effet visuel temporaire
    if (!enemy.effects) enemy.effects = {};
    enemy.effects.armorReduced = {
      duration: 1500,
      appliedAt: Date.now(),
      visualEffect: {
        type: 'acid',
        color: '#9400D3',
        particleColor: '#8A2BE2',
        intensity: 0.9,
        animation: 'corrode'
      }
    };
    console.log(`Enemy ${enemy.id} armor reduced by ${reduction}`);
  }

  applyAoeEffect(enemy) {
    // Effet de zone - devrait affecter les ennemis proches
    // Pour l'instant, juste un bonus de dégâts
    enemy.health -= this.damage * 0.5;
    
    // Effet visuel temporaire
    if (!enemy.effects) enemy.effects = {};
    enemy.effects.earthStun = {
      duration: 800,
      appliedAt: Date.now(),
      visualEffect: {
        type: 'earth',
        color: '#8B4513',
        particleColor: '#CD853F',
        intensity: 1.2,
        animation: 'rumble'
      }
    };
    console.log(`Enemy ${enemy.id} hit by earth AoE`);
  }

  applyVortexEffect(enemy) {
    // Vortex: attire tous les ennemis proches vers l'ennemi touché
    // Cet effet nécessite accès à tous les ennemis, géré dans GameRoom
    if (!enemy.effects) enemy.effects = {};
    enemy.effects.vortex = {
      centerX: enemy.x,
      centerY: enemy.y,
      duration: 2000,
      appliedAt: Date.now(),
      towerId: this.id,
      visualEffect: {
        type: 'wind',
        color: '#32CD32',
        particleColor: '#90EE90',
        intensity: 1.1,
        animation: 'swirl'
      }
    };
    console.log(`Enemy ${enemy.id} caught in vortex`);
  }

  applyEffect(effectType) {
    this.effects.push(effectType);
    const effect = EFFECT_TYPES[effectType];
    
    if (effect && effect.modifier) {
      for (const [key, value] of Object.entries(effect.modifier)) {
        if (key === 'qualityMultiplier') {
          // Special handling for quality upgrades
          if (this.qualityLevel < 3) { // Max 3 quality upgrades
            this.quality *= value;
            this.qualityLevel++;
            console.log(`Tower ${this.id} quality upgraded to level ${this.qualityLevel} (${this.quality.toFixed(2)}x)`);
          }
        } else if (key === 'maxTargets') {
          // Additive for max targets
          this.maxTargets += value;
        } else if (typeof value === 'number' && this[key]) {
          // Multiplicative for other numeric values
          this[key] *= value;
        } else {
          // Direct assignment for boolean values
          this[key] = value;
        }
      }
      
      // Apply quality multiplier to damage and attack speed
      this.damage = this.baseDamage * this.quality;
      this.attackSpeed = this.baseAttackSpeed * this.quality;
      
      console.log(`Effect ${effectType} applied to tower ${this.id}. Stats: damage=${this.damage.toFixed(1)}, attackSpeed=${this.attackSpeed.toFixed(2)}, range=${this.range.toFixed(1)}, targets=${this.maxTargets}`);
    }
  }

  getProjectiles() {
    return this.projectiles;
  }

  // Static method to process DoT effects on enemies
  static processDotEffects(enemies) {
    const currentTime = Date.now();
    
    for (const enemy of enemies.values()) {
      if (!enemy.effects) continue;
      
      // Process burning effect
      if (enemy.effects.burning) {
        const burning = enemy.effects.burning;
        if (currentTime - burning.lastTick >= burning.interval) {
          enemy.health -= burning.damage;
          burning.lastTick = currentTime;
          console.log(`Enemy ${enemy.id} takes ${burning.damage} burning damage`);
        }
        
        // Remove effect if duration expired
        if (currentTime - burning.appliedAt >= burning.duration) {
          delete enemy.effects.burning;
          console.log(`Enemy ${enemy.id} burning effect expired`);
        }
      }
      
      // Process slow effect expiration
      if (enemy.effects.slowed) {
        const slowed = enemy.effects.slowed;
        if (currentTime - slowed.appliedAt >= slowed.duration) {
          // Restore original speed
          if (enemy.originalSpeed) {
            enemy.speed = enemy.originalSpeed;
            delete enemy.originalSpeed;
          }
          delete enemy.effects.slowed;
          console.log(`Enemy ${enemy.id} slow effect expired`);
        }
      }
      
      // Process other temporary effects
      const tempEffects = ['armorReduced', 'earthStun'];
      tempEffects.forEach(effectName => {
        if (enemy.effects[effectName]) {
          const effect = enemy.effects[effectName];
          if (currentTime - effect.appliedAt >= effect.duration) {
            delete enemy.effects[effectName];
            console.log(`Enemy ${enemy.id} ${effectName} effect expired`);
          }
        }
      });
      
      // Clean up empty effects object
      if (Object.keys(enemy.effects).length === 0) {
        delete enemy.effects;
      }
    }
  }
}

module.exports = Tower;
