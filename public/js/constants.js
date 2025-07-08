// Client-side constants - mirror of server constants
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
  
  // Tower inspection events
  INSPECT_TOWER: 'inspect_tower',
  TOWER_INFO: 'tower_info',
  CHANGE_TARGETING_MODE: 'change_targeting_mode',
  
  // Map expansion events
  MAP_EXPANDED: 'map_expanded',
  
  // Chat events
  CHAT_MESSAGE: 'chat_message',
  CHAT_MESSAGE_BROADCAST: 'chat_message_broadcast',
  
  // Debug events
  DEBUG_SKIP_TO_WAVE: 'debug_skip_to_wave',
  DEBUG_TRIGGER_EXPANSION: 'debug_trigger_expansion',
  
  // Error events
  ERROR: 'error'
};

const GAME_PHASES = {
  LOBBY: 'lobby',
  PREPARATION: 'preparation',
  WAVE_ACTIVE: 'wave_active',
  GAME_OVER: 'game_over'
};

const TOWER_TYPES = {
  FIRE: {
    name: 'Feu',
    emoji: '🔥',
    color: '#e74c3c'
  },
  ICE: {
    name: 'Glace',
    emoji: '❄️',
    color: '#3498db'
  },
  ACID: {
    name: 'Acide',
    emoji: '🧪',
    color: '#9b59b6'
  },
  EARTH: {
    name: 'Terre',
    emoji: '🪨',
    emoji: '🌪️',
    color: '#1abc9c'
  },
  DARKNESS: {
    name: 'Ténèbres',
    emoji: '🌑',
    color: '#2c3e50'
  },
  ANTI_HEAL: {
    name: 'Anti-Régénération',
    emoji: '🚫',
    color: '#e74c3c'
  }
};

// Grid system for tower placement
const GRID_CONFIG = {
  CELL_SIZE: 40,        // Taille d'une case de la grille en pixels
  GRID_ALPHA: 0.3,      // Transparence de la grille
  VALID_COLOR: '#00ff00',    // Vert pour les zones valides
  INVALID_COLOR: '#ff0000',  // Rouge pour les zones invalides
  PREVIEW_ALPHA: 0.7,   // Transparence de la hitbox de prévisualisation
  PATH_BUFFER: 30       // Distance minimale du chemin en pixels
};

// Enemy types for visual rendering
const ENEMY_TYPES = {
  NORMAL: 'normal',
  ARMORED: 'armored',
  FAST: 'fast',
  MAGICAL: 'magical',
  INVISIBLE: 'invisible',
  HEALER: 'healer'
};

// Modes de ciblage des tours
const TARGETING_MODES = {
  CLOSEST: { name: 'Plus proche', icon: '🎯', description: 'Attaque l\'ennemi le plus proche' },
  FARTHEST: { name: 'Plus loin', icon: '🏹', description: 'Attaque l\'ennemi le plus éloigné' },
  WEAKEST: { name: 'Plus faible', icon: '💔', description: 'Attaque l\'ennemi avec le moins de vie' },
  STRONGEST: { name: 'Plus fort', icon: '💪', description: 'Attaque l\'ennemi avec le plus de vie' },
  FIRST: { name: 'Premier', icon: '🥇', description: 'Attaque le premier ennemi sur le chemin' },
  LAST: { name: 'Dernier', icon: '🥉', description: 'Attaque le dernier ennemi sur le chemin' },
  RANDOM: { name: 'Aléatoire', icon: '🎲', description: 'Attaque un ennemi aléatoire' }
};
