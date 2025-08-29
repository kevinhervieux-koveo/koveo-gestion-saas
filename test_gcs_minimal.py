#!/usr/bin/env python3
"""
Minimal test to check if we can authenticate to Google Cloud Storage
using just the environment variables available in Replit.
"""

import os

def test_authentication():
    """Test various authentication methods."""
    
    print("Environment variables:")
    print(f"GOOGLE_CLOUD_PROJECT: {os.getenv('GOOGLE_CLOUD_PROJECT')}")
    print(f"GOOGLE_SERVICE_ACCOUNT_EMAIL: {os.getenv('GOOGLE_SERVICE_ACCOUNT_EMAIL')}")
    print(f"GCS_BUCKET_NAME: {os.getenv('GCS_BUCKET_NAME')}")
    print(f"GOOGLE_APPLICATION_CREDENTIALS: {'SET' if os.getenv('GOOGLE_APPLICATION_CREDENTIALS') else 'NOT SET'}")
    
    # Try different authentication methods
    try:
        print("\n1. Testing default credentials...")
        from google.auth import default
        credentials, project = default()
        print(f"✅ Default credentials work! Project: {project}")
        return True
    except Exception as e:
        print(f"❌ Default credentials failed: {e}")
    
    try:
        print("\n2. Testing with explicit project...")
        from google.auth import default
        credentials, _ = default(quota_project_id=os.getenv('GOOGLE_CLOUD_PROJECT'))
        print("✅ Explicit project credentials work!")
        return True
    except Exception as e:
        print(f"❌ Explicit project failed: {e}")
        
    try:
        print("\n3. Testing compute engine credentials...")
        from google.auth.compute_engine import Credentials
        credentials = Credentials()
        print("✅ Compute engine credentials work!")
        return True
    except Exception as e:
        print(f"❌ Compute engine failed: {e}")
    
    print("\n❌ All authentication methods failed")
    return False

if __name__ == "__main__":
    test_authentication()