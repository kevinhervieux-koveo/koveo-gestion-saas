#!/usr/bin/env python3
"""
Simple Google Cloud Storage upload script for Replit workload identity.
This version bypasses metadata server detection completely.
"""

import os
import sys
from datetime import timedelta


def upload_secure_document(organization_id: str, file_path: str) -> None:
    """
    Uploads a document securely to Google Cloud Storage with organization-based structure.
    """
    
    # Get required environment variables
    bucket_name = os.getenv('GCS_BUCKET_NAME')
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME environment variable is not set")
    
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is not set")
    
    # Verify file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Disable metadata server detection completely
    os.environ['GCE_METADATA_HOST'] = '169.254.169.255'  # Set to unreachable IP
    os.environ['GOOGLE_CLOUD_DISABLE_GRPC'] = 'true'
    os.environ.pop('GOOGLE_APPLICATION_CREDENTIALS', None)
    
    try:
        from google.cloud import storage
        from google.auth import default
        from google.auth.exceptions import DefaultCredentialsError
        
        # Try to get default credentials but with short timeout
        try:
            credentials, _ = default(quota_project_id=project_id)
            client = storage.Client(project=project_id, credentials=credentials)
        except (DefaultCredentialsError, Exception):
            # If credentials fail, try with project ID only
            client = storage.Client(project=project_id)
            
    except Exception as e:
        raise PermissionError(f"Failed to initialize Google Cloud Storage: {str(e)}")
    
    try:
        # Get bucket and upload file
        bucket = client.bucket(bucket_name)
        file_name = os.path.basename(file_path)
        destination_blob_name = f"prod_org_{organization_id}/{file_name}"
        blob = bucket.blob(destination_blob_name)
        
        # Upload the file
        with open(file_path, 'rb') as file_data:
            blob.upload_from_file(file_data)
        
        print(f"File uploaded successfully to blob: {destination_blob_name}")
        
    except Exception as e:
        raise Exception(f"Failed to upload file: {str(e)}")


def get_secure_document_url(organization_id: str, file_name: str) -> str:
    """
    Generates a signed URL for secure access to a document.
    """
    
    bucket_name = os.getenv('GCS_BUCKET_NAME')
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME environment variable is not set")
    
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is not set")
    
    # Disable metadata server detection
    os.environ['GCE_METADATA_HOST'] = '169.254.169.255'
    os.environ['GOOGLE_CLOUD_DISABLE_GRPC'] = 'true'
    os.environ.pop('GOOGLE_APPLICATION_CREDENTIALS', None)
    
    try:
        from google.cloud import storage
        from google.auth import default
        from google.auth.exceptions import DefaultCredentialsError
        
        try:
            credentials, _ = default(quota_project_id=project_id)
            client = storage.Client(project=project_id, credentials=credentials)
        except (DefaultCredentialsError, Exception):
            client = storage.Client(project=project_id)
            
    except Exception as e:
        raise PermissionError(f"Failed to initialize Google Cloud Storage: {str(e)}")
    
    try:
        bucket = client.bucket(bucket_name)
        blob_name = f"prod_org_{organization_id}/{file_name}"
        blob = bucket.blob(blob_name)
        
        # Check if blob exists
        if not blob.exists():
            raise FileNotFoundError(f"File not found: {blob_name}")
        
        # Generate signed URL (15 minutes)
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="GET"
        )
        
        return url
        
    except Exception as e:
        raise Exception(f"Failed to generate signed URL: {str(e)}")


if __name__ == "__main__":
    # Test the functions
    if len(sys.argv) > 2:
        org_id = sys.argv[1]
        file_path = sys.argv[2]
        upload_secure_document(org_id, file_path)
    else:
        print("Usage: python upload_secure_document_simple.py <org_id> <file_path>")