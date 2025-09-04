/**
 * Jest Global Teardown - Clean up after test runs
 * Ensures proper resource cleanup to prevent hanging processes
 */

module.exports = async () => {
  // Force cleanup of any remaining processes
  if (global.mockDatabase) {
    global.mockDatabase = null;
  }
  
  // Clean up any timers or intervals
  if (global.clearAllTimers) {
    global.clearAllTimers();
  }
  
  console.log('🧹 Jest cleanup completed');
};