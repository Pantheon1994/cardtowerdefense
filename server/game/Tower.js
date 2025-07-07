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
    
    // Statistics tracking
    this.stats = {
      totalKills: 0,
      totalDamageDealt: 0,
      totalAttacks: 0,
      createdAt: Date.now()
    };
    
    // Attack timing
    this.lastAttackTime = 0;
    this.target = null;
    this.projectiles = [];
    
    // Targeting mode
    this.targetingMode = 'CLOSEST'; // Default targeting mode
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

    // Sort targets based on targeting mode
    const sortedTargets = this.sortTargetsByMode(targetsInRange);
    
    // Select targets based on maxTargets
    const targets = sortedTargets.slice(0, this.maxTargets);
    
    targets.forEach(enemy => {
      this.attackEnemy(enemy);
    });

    this.lastAttackTime = Date.now();
    console.log(`Tower ${this.id} attacked ${targets.length} enemies using ${this.targetingMode} targeting`);
  }

  sortTargetsByMode(targets) {
    switch (this.targetingMode) {
      case 'CLOSEST':
        return targets.sort((a, b) => this.getDistance(a) - this.getDistance(b));
        
      case 'FARTHEST':
        return targets.sort((a, b) => this.getDistance(b) - this.getDistance(a));
        
      case 'WEAKEST':
        return targets.sort((a, b) => a.health - b.health);
        
      case 'STRONGEST':
        return targets.sort((a, b) => b.health - a.health);
        
      case 'FIRST':
        return targets.sort((a, b) => b.currentPathIndex - a.currentPathIndex);
        
      case 'LAST':
        return targets.sort((a, b) => a.currentPathIndex - b.currentPathIndex);
        
      case 'RANDOM':
        return this.shuffleArray([...targets]);
        
      default:
        console.warn(`Unknown targeting mode: ${this.targetingMode}, using CLOSEST`);
        return targets.sort((a, b) => this.getDistance(a) - this.getDistance(b));
    }
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  getEnemiesInRange(enemies) {
    const enemiesInRange = Array.from(enemies.values())
      .filter(enemy => {
        if (!enemy.isSpawned || enemy.health <= 0) return false;
        
        // Check invisibility detection
        if (enemy.types && enemy.types.includes('invisible') && !this.canDetectInvisible) {
          return false;
        }
        
        // Check for vortex cooldown (only for vortex towers)
        if (this.effect === 'vortex' && enemy.effects && enemy.effects.vortexCooldown) {
          const cooldownRemaining = Date.now() - enemy.effects.vortexCooldown.appliedAt;
          if (cooldownRemaining < enemy.effects.vortexCooldown.duration) {
            return false; // Skip this enemy, still in cooldown
          }
        }
        
        const distance = this.getDistance(enemy);
        return distance <= this.range;
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
    
    // Track the attack
    this.recordAttack();
    
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
    
    // Track damage dealt (kills are tracked in applyDamage)
    this.recordDamage(damageDealt);
    
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
    
    const wasAlive = enemy.health > 0;
    enemy.health -= finalDamage;
    
    // Track kill if this damage killed the enemy
    if (wasAlive && enemy.health <= 0) {
      this.recordKill();
    }
    
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
      case 'anti_heal':
        this.applyAntiHealEffect(enemy);
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
    
    // Appliquer l'effet vortex
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
    
    // Ajouter un cooldown pour éviter les effets répétés
    enemy.effects.vortexCooldown = {
      duration: 3000, // 3 secondes de cooldown
      appliedAt: Date.now()
    };
    
    console.log(`Enemy ${enemy.id} caught in vortex with 3s cooldown`);
  }

  applyAntiHealEffect(enemy) {
    // Anti-heal: empêche tous les soins pendant 5 secondes
    if (!enemy.effects) enemy.effects = {};
    
    enemy.effects.antiHeal = {
      duration: 5000, // 5 secondes
      appliedAt: Date.now(),
      visualEffect: {
        type: 'anti_heal',
        color: '#FF0000',
        particleColor: '#FF4500',
        intensity: 0.9,
        animation: 'pulse'
      }
    };
    
    console.log(`Enemy ${enemy.id} affected by anti-heal for 5 seconds`);
  }

  applyEffect(effectType) {
    const effect = EFFECT_TYPES[effectType];
    
    if (!effect) {
      console.warn(`Unknown effect type: ${effectType}`);
      return;
    }

    // Store effect with complete information
    const effectData = {
      type: effectType,
      name: effect.name,
      description: effect.description,
      appliedBy: 'player', // Could be enhanced to track which player applied it
      appliedAt: Date.now()
    };
    
    this.effects.push(effectData);
    
    if (effect.modifier) {
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
      const tempEffects = ['armorReduced', 'earthStun', 'vortexCooldown', 'antiHeal', 'healed'];
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
  
  // Get comprehensive tower information including statistics and DPS
  getTowerInfo() {
    const currentTime = Date.now();
    const timeSinceCreated = (currentTime - this.stats.createdAt) / 1000; // in seconds
    
    // Calculate DPS (Damage Per Second)
    const attacksPerSecond = this.attackSpeed / 1000;
    const theoreticalDPS = this.damage * attacksPerSecond * this.maxTargets;
    
    // Calculate actual DPS based on damage dealt
    const actualDPS = timeSinceCreated > 0 ? this.stats.totalDamageDealt / timeSinceCreated : 0;
    
    // Get quality name
    const qualityNames = ['Normal', 'Bleu', 'Épique', 'Légendaire'];
    const qualityColors = ['#ffffff', '#3498db', '#9b59b6', '#f1c40f'];
    
    return {
      id: this.id,
      type: this.type,
      position: { x: this.x, y: this.y },
      playerId: this.playerId,
      
      // Base stats
      baseStats: {
        damage: this.baseDamage,
        attackSpeed: this.baseAttackSpeed,
        range: this.baseRange
      },
      
      // Current stats (with effects applied)
      currentStats: {
        damage: this.damage,
        attackSpeed: this.attackSpeed,
        range: this.range,
        maxTargets: this.maxTargets,
        canDetectInvisible: this.canDetectInvisible
      },
      
      // Quality
      quality: {
        level: this.qualityLevel,
        name: qualityNames[this.qualityLevel],
        color: qualityColors[this.qualityLevel],
        multiplier: this.quality
      },
      
      // Effects applied
      effects: this.effects.map(effect => ({
        type: effect.type,
        name: effect.name,
        description: effect.description,
        appliedBy: effect.appliedBy,
        appliedAt: effect.appliedAt
      })),
      
      // Statistics
      statistics: {
        totalKills: this.stats.totalKills,
        totalDamageDealt: this.stats.totalDamageDealt,
        totalAttacks: this.stats.totalAttacks,
        timeSinceCreated: Math.floor(timeSinceCreated)
      },
      
      // DPS calculations
      dps: {
        theoretical: Math.round(theoreticalDPS * 100) / 100,
        actual: Math.round(actualDPS * 100) / 100,
        attacksPerSecond: Math.round(attacksPerSecond * 100) / 100
      },
      
      // Tower type info
      towerEffect: this.effect,
      specialAbility: this.getSpecialAbilityDescription()
    };
  }
  
  // Get effect name for display
  getEffectName(effectType) {
    const effectNames = {
      [EFFECT_TYPES.DAMAGE_UP]: 'Dégâts ↑',
      [EFFECT_TYPES.ATTACK_SPEED_UP]: "Vitesse d'attaque ↑",
      [EFFECT_TYPES.RANGE_UP]: 'Portée ↑',
      [EFFECT_TYPES.MULTI_TARGET]: 'Nombre de cibles ↑',
      [EFFECT_TYPES.QUALITY_UP]: 'Qualité ↑',
      [EFFECT_TYPES.DETECT_INVISIBLE]: "Détection d'invisibles"
    };
    return effectNames[effectType] || effectType;
  }
  
  // Get effect description
  getEffectDescription(effectType) {
    const descriptions = {
      [EFFECT_TYPES.DAMAGE_UP]: '+50% de dégâts',
      [EFFECT_TYPES.ATTACK_SPEED_UP]: '+50% de vitesse d\'attaque',
      [EFFECT_TYPES.RANGE_UP]: '+50% de portée',
      [EFFECT_TYPES.MULTI_TARGET]: '+1 cible supplémentaire',
      [EFFECT_TYPES.QUALITY_UP]: 'Améliore la qualité de la tour',
      [EFFECT_TYPES.DETECT_INVISIBLE]: 'Peut détecter les ennemis invisibles'
    };
    return descriptions[effectType] || 'Effet spécial';
  }
  
  // Get special ability description based on tower type
  getSpecialAbilityDescription() {
    const abilities = {
      [TOWER_TYPES.ICE.name]: 'Ralentit les ennemis touchés',
      [TOWER_TYPES.FIRE.name]: 'Inflige des dégâts de feu continus',
      [TOWER_TYPES.WIND.name]: 'Repousse les ennemis en arrière',
      [TOWER_TYPES.EARTH.name]: 'Réduit l\'armure et peut étourdir',
      [TOWER_TYPES.ACID.name]: 'Empoisonne les ennemis'
    };
    return abilities[this.type] || 'Aucune capacité spéciale';
  }
  
  // Track when tower deals damage (for statistics)
  recordDamage(damage) {
    this.stats.totalDamageDealt += damage;
  }
  
  // Track when tower kills an enemy
  recordKill() {
    this.stats.totalKills++;
  }
  
  // Track when tower attacks
  recordAttack() {
    this.stats.totalAttacks++;
  }

  // Inspection and statistics methods
  getDetailedInfo() {
    const dps = this.calculateDPS();
    const uptime = this.getUptime();
    
    return {
      id: this.id,
      type: this.type,
      position: { x: this.x, y: this.y },
      owner: this.playerId,
      
      // Current stats
      stats: {
        damage: Math.round(this.damage * 100) / 100,
        attackSpeed: Math.round(this.attackSpeed * 100) / 100,
        range: Math.round(this.range),
        dps: Math.round(dps * 100) / 100,
        maxTargets: this.maxTargets,
        canDetectInvisible: this.canDetectInvisible
      },
      
      // Base stats for comparison
      baseStats: {
        damage: this.baseDamage,
        attackSpeed: this.baseAttackSpeed,
        range: this.baseRange
      },
      
      // Quality information
      quality: {
        level: this.qualityLevel,
        multiplier: Math.round(this.quality * 100) / 100,
        name: this.getQualityName()
      },
      
      // Combat statistics
      combatStats: {
        totalKills: this.stats.totalKills,
        totalDamageDealt: Math.round(this.stats.totalDamageDealt),
        totalAttacks: this.stats.totalAttacks,
        averageDamagePerAttack: this.stats.totalAttacks > 0 ? 
          Math.round((this.stats.totalDamageDealt / this.stats.totalAttacks) * 100) / 100 : 0,
        killsPerMinute: this.stats.totalKills / (uptime / 60000),
        uptime: Math.round(uptime / 1000) // in seconds
      },
      
      // Applied effects
      effects: this.effects.map(effect => ({
        name: effect.name,
        description: effect.description,
        appliedBy: effect.appliedBy
      })),
      
      // Tower type info
      towerType: {
        name: TOWER_TYPES[this.type].name,
        emoji: TOWER_TYPES[this.type].emoji,
        specialEffect: TOWER_TYPES[this.type].effect
      },
      
      // Targeting mode
      targetingMode: this.targetingMode
    };
  }

  calculateDPS() {
    // DPS = damage per attack * attacks per second
    return this.damage * this.attackSpeed;
  }

  getUptime() {
    return Date.now() - this.stats.createdAt;
  }

  getQualityName() {
    const qualityNames = ['Normal', 'Rare', 'Épique', 'Légendaire'];
    return qualityNames[this.qualityLevel] || 'Normal';
  }
}

module.exports = Tower;
