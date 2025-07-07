const { TOWER_TYPES, EFFECT_TYPES } = require('../constants/events');

class CardDeck {
  constructor() {
    this.towerCards = Object.keys(TOWER_TYPES).map(type => ({
      type: 'tower',
      towerType: type,
      name: TOWER_TYPES[type].name,
      emoji: TOWER_TYPES[type].emoji,
      description: `Tour ${TOWER_TYPES[type].name} - ${this.getEffectDescription(TOWER_TYPES[type].effect)}`
    }));

    this.effectCards = Object.keys(EFFECT_TYPES).map(type => ({
      type: 'effect',
      effectType: type,
      name: EFFECT_TYPES[type].name,
      description: EFFECT_TYPES[type].description
    }));

    this.allCards = [...this.towerCards, ...this.effectCards];
  }

  dealCards(count = 3) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const randomCard = this.getRandomCard();
      cards.push({
        ...randomCard,
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
    }
    return cards;
  }

  getRandomCard() {
    const randomIndex = Math.floor(Math.random() * this.allCards.length);
    return { ...this.allCards[randomIndex] };
  }

  getEffectDescription(effect) {
    switch (effect) {
      case 'dot': return 'Dégâts sur la durée';
      case 'slow': return 'Ralentit les ennemis';
      case 'armor_reduction': return 'Réduit l\'armure';
      case 'aoe': return 'Dégâts de zone';
      case 'pull': return 'Attire les ennemis';
      default: return 'Effet spécial';
    }
  }
}

module.exports = CardDeck;
