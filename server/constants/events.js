// Game events constants
const GAME_EVENTS = {
  // Connection events
  JOIN_ROOM: 'join_room',
  ROOM_JOINED: 'room_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  
  // Game state events
  GAME_STATE_UPDATE: 'game_state_update',
  WAVE_START: 'wave_start',
  WAVE_END: 'wave_end',
  GAME_OVER: 'game_over',
  
  // Player actions
  SELECT_CARD: 'select_card',
  PLACE_TOWER: 'place_tower',
  APPLY_EFFECT: 'apply_effect',
  PLAYER_READY: 'player_ready',
  
  // Card events
  CARDS_DEALT: 'cards_dealt',
  CARD_SELECTED: 'card_selected',
  
  // Combat events
  ENEMY_SPAWNED: 'enemy_spawned',
  ENEMY_DAMAGED: 'enemy_damaged',
  ENEMY_KILLED: 'enemy_killed',
  BASE_DAMAGED: 'base_damaged',
  
  // Error events
  ERROR: 'error'
};

// Game phases
const GAME_PHASES = {
  LOBBY: 'lobby',
  PREPARATION: 'preparation',
  WAVE_ACTIVE: 'wave_active',
  GAME_OVER: 'game_over'
};

// Tower types
const TOWER_TYPES = {
  FIRE: {
    name: 'Feu',
    emoji: '🔥',
    baseDamage: 15, // Dégâts faibles à l'impact
    attackSpeed: 1.0, // 1 attaque par seconde
    range: 100,
    effect: 'dot' // Dégâts sur la durée
  },
  ICE: {
    name: 'Glace',
    emoji: '❄️',
    baseDamage: 15, // Dégâts faibles à l'impact
    attackSpeed: 1.0, // 1 attaque par seconde
    range: 100,
    effect: 'slow' // Ralentit les ennemis
  },
  ACID: {
    name: 'Acide',
    emoji: '🧪',
    baseDamage: 15, // Dégâts faibles à l'impact
    attackSpeed: 1.0, // 1 attaque par seconde
    range: 100,
    effect: 'armor_reduction' // Réduit l'armure de 25%
  },
  EARTH: {
    name: 'Terre',
    emoji: '🪨',
    baseDamage: 10, // Peu de dégâts
    attackSpeed: 1.0, // 1 attaque par seconde
    range: 100,
    effect: 'aoe' // Dégâts de zone
  },
  WIND: {
    name: 'Vent',
    emoji: '🌪️',
    baseDamage: 0, // N'inflige pas de dégâts
    attackSpeed: 1.0, // 1 attaque par seconde
    range: 100,
    effect: 'vortex' // Vortex qui attire les ennemis
  },
  DARKNESS: {
    name: 'Ténèbres',
    emoji: '🌑',
    baseDamage: 60, // Gros dégâts à l'impact
    attackSpeed: 0.5, // Attaque lentement (0.5/sec)
    range: 100,
    effect: 'none' // Pas d'effet spécial
  }
};

// Effect types
const EFFECT_TYPES = {
  ATTACK_SPEED: {
    name: 'Vitesse d\'attaque ↑',
    description: 'Fréquence de tir augmentée (+10%)',
    modifier: { attackSpeed: 1.1 } // +10%
  },
  MULTI_TARGET: {
    name: 'Nombre de cibles ↑',
    description: 'Peut toucher plusieurs ennemis à la fois (+1)',
    modifier: { maxTargets: 1 } // +1 cible (additive)
  },
  DAMAGE_BOOST: {
    name: 'Dégâts ↑',
    description: 'Augmente les dégâts de base (+15%)',
    modifier: { damage: 1.15 } // +15%
  },
  INVISIBILITY_DETECTION: {
    name: 'Détection d\'invisibles',
    description: 'Détecte les ennemis invisibles dans sa portée d\'attaque',
    modifier: { canDetectInvisible: true }
  },
  RANGE_BOOST: {
    name: 'Portée ↑',
    description: 'Étend le rayon d\'action de la tour et de tous les effets appliqués',
    modifier: { range: 1.2 } // +20%
  },
  QUALITY_UPGRADE: {
    name: 'Qualité ↑',
    description: 'Améliore la qualité de votre tour (+33% à tous les effets)',
    modifier: { qualityMultiplier: 1.33 } // +33% (peut être appliqué 3 fois max)
  }
};

// Enemy types
const ENEMY_TYPES = {
  NORMAL: 'normal',
  ARMORED: 'armored',
  FAST: 'fast',
  MAGICAL: 'magical',
  INVISIBLE: 'invisible'
};

module.exports = {
  GAME_EVENTS,
  GAME_PHASES,
  TOWER_TYPES,
  EFFECT_TYPES,
  ENEMY_TYPES
};
