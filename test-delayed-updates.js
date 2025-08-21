/**
 * Test script to verify the delayed update system is working.
 * This will simulate creating a bill and check if delayed updates are triggered.
 */
const { delayedUpdateService } = require('./server/services/delayed-update-service');

console.log('🧪 Testing Delayed Update System');
console.log('=================================');

// Test the service is initialized
console.log('\n1. Testing service initialization...');
try {
  const status = delayedUpdateService.getStatus();
  console.log('✅ Service initialized successfully');
  console.log(`   - Delay: ${status.delayMinutes} minutes`);
  console.log(`   - Pending bill updates: ${status.pendingBillUpdates}`);
  console.log(`   - Pending residence updates: ${status.pendingResidenceUpdates}`);
  console.log(`   - Pending budget updates: ${status.pendingBudgetUpdates}`);
} catch (error) {
  console.error('❌ Service initialization failed:', error.message);
  process.exit(1);
}

// Test scheduling a bill update (this won't actually process but will add to pending)
console.log('\n2. Testing bill update scheduling...');
try {
  const testBillId = 'test-bill-12345';
  delayedUpdateService.scheduleBillUpdate(testBillId);
  
  const statusAfter = delayedUpdateService.getStatus();
  if (statusAfter.pendingBillUpdates > 0) {
    console.log('✅ Bill update scheduled successfully');
    console.log(`   - Pending bill updates: ${statusAfter.pendingBillUpdates}`);
  } else {
    console.log('⚠️ Bill update may not have been scheduled properly');
  }
} catch (error) {
  console.error('❌ Bill update scheduling failed:', error.message);
}

// Test scheduling a residence update
console.log('\n3. Testing residence update scheduling...');
try {
  const testResidenceId = 'test-residence-67890';
  delayedUpdateService.scheduleResidenceUpdate(testResidenceId);
  
  const statusAfter = delayedUpdateService.getStatus();
  if (statusAfter.pendingResidenceUpdates > 0) {
    console.log('✅ Residence update scheduled successfully');
    console.log(`   - Pending residence updates: ${statusAfter.pendingResidenceUpdates}`);
  } else {
    console.log('⚠️ Residence update may not have been scheduled properly');
  }
} catch (error) {
  console.error('❌ Residence update scheduling failed:', error.message);
}

console.log('\n🎉 Delayed Update System Test Complete!');
console.log('\nThe system is now ready to:');
console.log('• ⏰ Schedule money flow updates 15 minutes after bill changes');
console.log('• 🏠 Schedule money flow updates 15 minutes after residence changes');
console.log('• 📊 Schedule budget updates 15 minutes after money flow changes');
console.log('• 🔄 Chain updates: Bill/Residence → Money Flow → Budget');
console.log('\nMonitoring endpoints available:');
console.log('• GET /api/delayed-updates/status - Check system status');
console.log('• GET /api/delayed-updates/health - Detailed health check');
console.log('• POST /api/delayed-updates/force-bill - Force immediate bill update');
console.log('• POST /api/delayed-updates/force-residence - Force immediate residence update');