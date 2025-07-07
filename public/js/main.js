// Main entry point
let gameClient;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏰 Card Tower Defense - Client Starting...');
  
  // Initialize game client
  gameClient = new GameClient();
  
  // Initial render of empty game
  gameClient.renderer.render(null);
  
  console.log('✅ Game client initialized');
});
