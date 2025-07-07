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
  
  // Initialize chat functionality
  initializeChatSystem();
  
  console.log('✅ Game client initialized with render loop');
});

function initializeChatSystem() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  
  if (!chatInput || !chatSendBtn) {
    console.warn('Chat elements not found, skipping chat initialization');
    return;
  }
  
  // Handle send button click
  chatSendBtn.addEventListener('click', () => {
    sendChatMessage();
  });
  
  // Handle Enter key press
  chatInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      sendChatMessage();
    }
  });
  
  // Prevent input from losing focus when clicking elsewhere
  chatInput.addEventListener('blur', () => {
    // Small delay to allow click events to process
    setTimeout(() => {
      if (document.activeElement !== chatInput) {
        // Focus was lost to something other than the input
      }
    }, 100);
  });
  
  console.log('💬 Chat system initialized');
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
  chatInput.focus();
}
