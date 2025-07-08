// Main entry point
let gameClient;
let isChatActive = false; // Track if chat is active/focused

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏰 Card Tower Defense - Client Starting...');
  
  // Initialize game client
  gameClient = new GameClient();
  
  // Setup chat functionality
  setupChatInterface();
  
  // Setup keyboard controls (camera movement)
  setupKeyboardControls();
  
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

function setupKeyboardControls() {
  // Camera movement with arrow keys only (not ZQSD/WASD)
  document.addEventListener('keydown', (e) => {
    // Block all keyboard shortcuts when chat is active
    if (isChatActive) {
      return;
    }

    // Handle camera movement with arrow keys
    if (gameClient && gameClient.renderer) {
      const moveSpeed = 20;
      
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          gameClient.renderer.moveCamera(0, -moveSpeed);
          break;
        case 'ArrowDown':
          e.preventDefault();
          gameClient.renderer.moveCamera(0, moveSpeed);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          gameClient.renderer.moveCamera(-moveSpeed, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          gameClient.renderer.moveCamera(moveSpeed, 0);
          break;
      }
    }

    // Focus chat input with Tab key (only if chat is not active)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const chatInput = document.getElementById('chatInput');
      if (chatInput) {
        chatInput.focus();
      }
    }
  });
}

function setupChatInterface() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  
  if (!chatInput || !chatSendBtn) {
    console.warn('Chat elements not found');
    return;
  }
  
  // Track chat focus state
  chatInput.addEventListener('focus', () => {
    isChatActive = true;
    chatInput.parentElement.classList.add('chat-active');
  });
  
  chatInput.addEventListener('blur', () => {
    isChatActive = false;
    chatInput.parentElement.classList.remove('chat-active');
  });
  
  // Send message on button click
  chatSendBtn.addEventListener('click', () => {
    sendChatMessage();
  });
  
  // Send message on Enter key press, close chat on Escape
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChatMessage();
      chatInput.blur(); // Unfocus chat after sending
    } else if (e.key === 'Escape') {
      e.preventDefault();
      chatInput.blur(); // Unfocus chat
    }
    // Block ZQSD keys when chat is active
    else if (['z', 'q', 's', 'd', 'Z', 'Q', 'S', 'D'].includes(e.key)) {
      // Let the keys work normally in chat input (for typing)
      // They won't trigger camera movement because isChatActive is true
    }
  });

  // Chat toggle functionality
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  if (chatToggleBtn) {
    chatToggleBtn.addEventListener('click', () => {
      if (gameClient) {
        gameClient.toggleChat();
      }
    });
  }
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
