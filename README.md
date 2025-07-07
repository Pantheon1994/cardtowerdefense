# 🏰 Card Tower Defense

Un jeu de Tower Defense coopératif multijoueur en temps réel utilisant un système de cartes unique.

## 🎮 Fonctionnalités

- **Multijoueur coopératif** : Jusqu'à 8 joueurs par partie
- **Système de cartes** : Chaque joueur reçoit 3 cartes aléatoires par vague
- **Tours spécialisées** : 5 types de tours avec effets uniques (Feu, Glace, Acide, Terre, Vent)
- **Effets permanents** : Améliorations cumulables pour les tours
- **Synchronisation temps réel** : Via WebSocket avec Socket.io
- **Rendu Canvas 2D** : Animations fluides et graphismes optimisés

## 🏗️ Architecture

### Backend
- **Node.js** avec Express
- **Socket.io** pour la communication temps réel
- **Gestion des rooms** avec identifiants uniques
- **Système de vagues** avec progression de difficulté

### Frontend
- **HTML5 Canvas** pour le rendu 2D
- **JavaScript vanilla** pour les interactions
- **Interface utilisateur responsive**
- **Gestion d'état en temps réel**

## 🚀 Installation et Lancement

### Prérequis
- Node.js (version 14 ou supérieure)
- npm

### Installation
```bash
npm install
```

### Développement
```bash
npm run dev
```

### Production
```bash
npm start
```

Le jeu sera accessible sur `http://localhost:3000`

## 🎯 Comment Jouer

1. **Rejoindre une partie** : Entrez votre nom et optionnellement un ID de room
2. **Phase de préparation** : Visualisez les ennemis de la prochaine vague
3. **Sélection de carte** : Choisissez parmi 3 cartes proposées
4. **Placement stratégique** : 
   - Tours : Placez dans les zones prédéfinies
   - Effets : Appliquez sur les tours existantes
5. **Combat automatique** : Les tours attaquent automatiquement
6. **Coopération** : Coordonnez-vous avec les autres joueurs

## 🗼 Types de Tours

| Tour | Emoji | Effet Principal |
|------|-------|----------------|
| Feu | 🔥 | Dégâts sur la durée (DoT) |
| Glace | ❄️ | Ralentit les ennemis |
| Acide | 🧪 | Réduction d'armure |
| Terre | 🪨 | Dégâts de zone (AoE) |
| Vent | 🌪️ | Vortex, attire les ennemis |

## ✨ Effets Disponibles

- **Vitesse d'attaque ↑** : Fréquence de tir augmentée
- **Nombre de cibles ↑** : Peut toucher plusieurs ennemis
- **Dégâts ↑** : Augmente les dégâts de base
- **Détection d'invisibles** : Détecte les ennemis invisibles
- **Portée ↑** : Étend le rayon d'action

## 🧟‍♂️ Types d'Ennemis

- **Normal** : Aucune résistance particulière
- **Armored** : Réduction des dégâts physiques
- **Fast** : Vitesse de déplacement augmentée
- **Magical** : Résistance aux dégâts magiques
- **Invisible** : Nécessite détection spéciale

Les ennemis peuvent cumuler jusqu'à 2 types pour plus de complexité.

## 📁 Structure du Projet

```
CardTowerTD/
├── server/
│   ├── server.js              # Serveur principal
│   ├── constants/
│   │   └── events.js          # Constantes partagées
│   └── game/
│       ├── GameRoom.js        # Gestion des salles
│       ├── WaveManager.js     # Gestion des vagues
│       └── CardDeck.js        # Système de cartes
├── public/
│   ├── index.html             # Interface principale
│   ├── styles.css             # Styles CSS
│   └── js/
│       ├── constants.js       # Constantes client
│       ├── GameClient.js      # Client principal
│       ├── GameRenderer.js    # Rendu Canvas
│       └── main.js           # Point d'entrée
└── package.json
```

## 🔧 Développement

### Scripts disponibles
- `npm start` : Lance le serveur en production
- `npm run dev` : Lance le serveur avec rechargement automatique (nodemon)

### Extensions VS Code recommandées
- JavaScript (ES6) code snippets
- Live Server (pour le développement frontend)
- Socket.io debugging

## 🎨 Fonctionnalités Futures

- [ ] Système de progression des joueurs
- [ ] Cartes multiples et deck building
- [ ] Nouveaux types de tours et effets
- [ ] Boss de fin de vague
- [ ] Mode spectateur
- [ ] Statistiques de partie
- [ ] Classements et achievements

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez consulter les instructions dans `.github/copilot-instructions.md` pour les guidelines de développement.

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails.
