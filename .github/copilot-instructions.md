<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Card Tower Defense - Development Instructions

This is a cooperative multiplayer tower defense game built with:
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5 Canvas, vanilla JavaScript
- **Real-time communication**: WebSockets

## Key Game Mechanics

1. **Multiplayer Cooperative**: Up to 4 players per room
2. **Card-based System**: Players receive 3 random cards (towers or effects) each wave
3. **Tower Placement**: Only in predefined zones
4. **Effect System**: Permanent, cumulative effects applied to towers
5. **Wave Progression**: Increasing difficulty with new enemy types

## Code Organization

- `server/` - Backend game logic and WebSocket handling
- `public/` - Frontend client-side code and assets
- `server/game/` - Core game classes (GameRoom, WaveManager, CardDeck)
- `server/constants/` - Shared constants and configurations

## Development Guidelines

- Maintain real-time synchronization between all players
- Use the constants files for shared configurations
- Follow the existing event-driven architecture
- Ensure proper error handling for multiplayer scenarios
- Keep the game loop optimized for 60 FPS updates

## Game Features to Implement

- Tower attack logic and projectiles
- Enemy AI and pathfinding improvements
- Map loading system
- Player statistics and progression
- Enhanced visual effects and animations
