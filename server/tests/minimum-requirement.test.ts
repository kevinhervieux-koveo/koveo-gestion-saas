import { calculateMinimumRequirement } from '../api/budgets';

// Simple test runner
interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true, expected: null, actual: null });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      expected: error.expected,
      actual: error.actual,
      error: error.message,
    });
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    const error: any = new Error(
      message || `Expected ${expected}, but got ${actual}`
    );
    error.expected = expected;
    error.actual = actual;
    throw error;
  }
}

// Test Suite: calculateMinimumRequirement
console.log('\n🧪 Running tests for calculateMinimumRequirement\n');
console.log('='.repeat(60));

// Test 1: All zeros should return 0 (zeros are valid values, not ignored)
test('should return 0 when all values are explicitly set to 0', () => {
  const result = calculateMinimumRequirement(0, 0, {});
  assertEquals(result, 0, 'All zeros should sum to 0');
});

// Test 2: emergencyFundMinimum=0 should be included in sum (not ignored)
test('should include emergencyFundMinimum=0 in calculation', () => {
  const result = calculateMinimumRequirement(0, 100, {});
  assertEquals(result, 100, 'Zero emergency fund should not prevent other values from summing');
});

// Test 3: operatingCashMinimum=0 should be included in sum (not ignored)
test('should include operatingCashMinimum=0 in calculation', () => {
  const result = calculateMinimumRequirement(100, 0, {});
  assertEquals(result, 100, 'Zero operating cash should not prevent other values from summing');
});

// Test 4: Mix of zero and positive values should sum correctly
test('should sum mix of zero and positive values correctly', () => {
  const result = calculateMinimumRequirement(0, 500, { field1: 0, field2: 200 });
  assertEquals(result, 700, 'Should sum to 500 + 200 = 700 (zeros do not contribute but are valid)');
});

// Test 5: Undefined values should be ignored
test('should ignore undefined emergencyFundMinimum', () => {
  const result = calculateMinimumRequirement(undefined, 100, {});
  assertEquals(result, 100, 'Undefined emergency fund should be ignored');
});

// Test 6: Undefined values should be ignored
test('should ignore undefined operatingCashMinimum', () => {
  const result = calculateMinimumRequirement(100, undefined, {});
  assertEquals(result, 100, 'Undefined operating cash should be ignored');
});

// Test 7: All undefined should return 0
test('should return 0 when all values are undefined', () => {
  const result = calculateMinimumRequirement(undefined, undefined, undefined);
  assertEquals(result, 0, 'All undefined should return 0');
});

// Test 8: Custom bank fields with zeros should be included
test('should include custom bank fields with zero values', () => {
  const result = calculateMinimumRequirement(undefined, undefined, {
    field1: 0,
    field2: 0,
    field3: 0,
  });
  assertEquals(result, 0, 'Custom fields with zeros should sum to 0');
});

// Test 9: Custom bank fields should sum correctly
test('should sum custom bank fields correctly', () => {
  const result = calculateMinimumRequirement(undefined, undefined, {
    reserve1: 1000,
    reserve2: 2000,
    reserve3: 3000,
  });
  assertEquals(result, 6000, 'Custom fields should sum to 6000');
});

// Test 10: Mix of all three parameters with zeros
test('should sum all three parameters including zeros', () => {
  const result = calculateMinimumRequirement(0, 1000, {
    field1: 0,
    field2: 500,
  });
  assertEquals(result, 1500, 'Should sum to 1000 + 500 = 1500 (zeros are valid)');
});

// Test 11: All positive values should sum correctly
test('should sum all positive values correctly', () => {
  const result = calculateMinimumRequirement(5000, 3000, {
    reserve1: 1000,
    reserve2: 2000,
  });
  assertEquals(result, 11000, 'Should sum to 5000 + 3000 + 1000 + 2000 = 11000');
});

// Test 12: Empty custom bank fields object should not affect sum
test('should handle empty custom bank fields object', () => {
  const result = calculateMinimumRequirement(1000, 2000, {});
  assertEquals(result, 3000, 'Empty object should not affect sum');
});

// Test 13: Negative values should be ignored (safety check)
test('should ignore negative emergencyFundMinimum', () => {
  const result = calculateMinimumRequirement(-1000, 2000, {});
  assertEquals(result, 2000, 'Negative values should be ignored');
});

// Test 14: Negative values in custom fields should be ignored
test('should ignore negative values in custom bank fields', () => {
  const result = calculateMinimumRequirement(undefined, undefined, {
    field1: 1000,
    field2: -500,
    field3: 2000,
  });
  assertEquals(result, 3000, 'Negative custom field values should be ignored');
});

// Test 15: NaN values should be ignored
test('should ignore NaN values', () => {
  const result = calculateMinimumRequirement(NaN, 1000, {});
  assertEquals(result, 1000, 'NaN values should be ignored');
});

// Test 16: Infinity values should be ignored
test('should ignore Infinity values', () => {
  const result = calculateMinimumRequirement(Infinity, 1000, {});
  assertEquals(result, 1000, 'Infinity values should be ignored');
});

// Test 17: Non-finite values in custom fields should be ignored
test('should ignore non-finite values in custom bank fields', () => {
  const result = calculateMinimumRequirement(undefined, undefined, {
    field1: 1000,
    field2: NaN,
    field3: Infinity,
    field4: 2000,
  });
  assertEquals(result, 3000, 'Non-finite custom field values should be ignored');
});

// Test 18: Null custom bank fields should not cause errors
test('should handle null custom bank fields', () => {
  const result = calculateMinimumRequirement(1000, 2000, null as any);
  assertEquals(result, 3000, 'Null custom fields should be treated as empty');
});

// Print results
console.log('\n📊 Test Results:\n');

let passedCount = 0;
let failedCount = 0;

results.forEach((result, index) => {
  if (result.passed) {
    console.log(`✅ Test ${index + 1}: ${result.name}`);
    passedCount++;
  } else {
    console.log(`❌ Test ${index + 1}: ${result.name}`);
    console.log(`   Expected: ${result.expected}`);
    console.log(`   Actual: ${result.actual}`);
    console.log(`   Error: ${result.error}`);
    failedCount++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📈 Summary: ${passedCount} passed, ${failedCount} failed, ${results.length} total\n`);

// Exit with error code if any tests failed
if (failedCount > 0) {
  console.error(`\n❌ ${failedCount} test(s) failed!\n`);
  process.exit(1);
} else {
  console.log('✅ All tests passed!\n');
  process.exit(0);
}
