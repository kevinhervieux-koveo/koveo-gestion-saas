// Quick API debugging script
async function debugDocumentsAPI() {
  console.log('=== Documents API Debug ===');
  
  try {
    // Test auth first
    const authResponse = await fetch('/api/auth/user', {
      credentials: 'include',
    });
    
    console.log('Auth status:', authResponse.status);
    
    if (authResponse.ok) {
      const userData = await authResponse.json();
      console.log('User:', userData.email, userData.role);
      
      // Test documents API
      const docsResponse = await fetch('/api/documents?type=building', {
        credentials: 'include',
      });
      
      console.log('Documents API status:', docsResponse.status);
      
      if (docsResponse.ok) {
        const docsData = await docsResponse.json();
        console.log('Documents response structure:', Object.keys(docsData));
        console.log('Documents count:', docsData.documents?.length || 0);
        
        if (docsData.documents && docsData.documents.length > 0) {
          console.log('First document:', docsData.documents[0]);
        }
      } else {
        const errorData = await docsResponse.json();
        console.log('Documents API error:', errorData);
      }
    }
  } catch (error) {
    console.error('Debug error:', error);
  }
}

// Run it
debugDocumentsAPI();