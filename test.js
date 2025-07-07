// Simple test script to check if server starts correctly
console.log('Testing Card Tower Defense server startup...');

try {
  const server = require('./server/server.js');
  console.log('✅ Server started successfully!');
} catch (error) {
  console.error('❌ Server failed to start:', error.message);
  console.error(error.stack);
}
