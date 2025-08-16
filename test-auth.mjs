// Test authentication and user management access

async function testAuth() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('1. Testing login with kevin.hervieux@koveo-gestion.com...');
  
  // Login
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'kevin.hervieux@koveo-gestion.com',
      password: 'demo12345'
    }),
  });
  
  const loginData = await loginResponse.json();
  console.log('Login response:', loginData);
  
  if (!loginResponse.ok) {
    console.error('Login failed:', loginData);
    return;
  }
  
  // Extract cookies
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('Session cookies:', cookies);
  
  // Get current user
  console.log('\n2. Getting current user info...');
  const userResponse = await fetch(`${baseUrl}/api/auth/user`, {
    headers: {
      'Cookie': cookies
    }
  });
  
  const userData = await userResponse.json();
  console.log('Current user:', userData);
  
  // Try to access user management
  console.log('\n3. Accessing user management endpoint...');
  const mgmtResponse = await fetch(`${baseUrl}/api/user-management`, {
    headers: {
      'Cookie': cookies
    }
  });
  
  console.log('User management response status:', mgmtResponse.status);
  
  if (mgmtResponse.ok) {
    const mgmtData = await mgmtResponse.json();
    console.log('User management data received:', {
      totalUsers: mgmtData.totalUsers,
      activeUsers: mgmtData.activeUsers,
      userCount: mgmtData.users?.length
    });
  } else {
    const errorData = await mgmtResponse.json();
    console.error('User management access failed:', errorData);
  }
}

// Run the test
testAuth().catch(console.error);