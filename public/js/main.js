// Main entry point
let gameClient;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏰 Card Tower Defense - Client Starting...');
  
  // Initialize game client
  gameClient = new GameClient();
  
  // Setup chat functionality
  setupChatInterface();
  
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

function setupChatInterface() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  
  if (!chatInput || !chatSendBtn) {
    console.warn('Chat elements not found');
    return;
  }
  
  // Send message on button click
  chatSendBtn.addEventListener('click', () => {
    sendChatMessage();
  });
  
  // Send message on Enter key press
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
  
  // Focus chat input with Tab key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      chatInput.focus();
    }
  });

  // Add debug key handlers
  document.addEventListener('keydown', (e) => {
    // Don't trigger debug keys if chat is focused
    if (document.activeElement === chatInput) {
      return;
    }

    if (e.key === '5') {
      // Skip to wave 5
      e.preventDefault();
      if (gameClient) {
        gameClient.debugSkipToWave(5);
      }
    }
  });
}

function sendChatMessage() {
  const chatInput = document.getElementById('chatInput');
  if (!chatInput || !gameClient) {
    return;
  }
  
  const message = chatInput.value.trim();
  if (message.length === 0) {
    return;
  }
  
  // Send message through game client
  gameClient.sendChatMessage(message);
  
  // Clear input
  chatInput.value = '';
}
