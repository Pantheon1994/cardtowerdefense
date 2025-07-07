// Main entry point
let gameClient;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏰 Card Tower Defense - Client Starting...');
  
  // Initialize game client
  gameClient = new GameClient();
  
  // Start continuous render loop
  function gameLoop() {
    if (gameClient && gameClient.renderer) {
      gameClient.renderer.render(gameClient.gameState);
    }
    requestAnimationFrame(gameLoop);
  }
  
  // Start the game loop
  gameLoop();
  
  console.log('✅ Game client initialized with render loop');
});
