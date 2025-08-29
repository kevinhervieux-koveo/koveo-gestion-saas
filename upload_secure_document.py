#!/usr/bin/env python3
"""
Google Cloud Storage document utility.

This module provides secure document upload and URL generation functions that organize files
by organization structure in Google Cloud Storage.
"""

import os
from datetime import timedelta
from google.cloud import storage
from google.cloud.exceptions import NotFound, Forbidden


def upload_secure_document(organization_id: str, file_path: str) -> None:
    """
    Uploads a document securely to Google Cloud Storage with organization-based structure.
    
    Args:
        organization_id (str): The organization ID for organizing files
        file_path (str): Local path to the file to upload
        
    Raises:
        ValueError: If the GCS_BUCKET_NAME environment variable is not set
        FileNotFoundError: If the local file doesn't exist
        PermissionError: If there are permission issues with Google Cloud Storage
        Exception: If the upload fails for other reasons
    """
    
    # Get bucket name from environment variable
    bucket_name = os.getenv('GCS_BUCKET_NAME')
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME environment variable is not set or is empty")
    
    # Get project ID from environment variable for workload identity
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is not set")
    
    # Verify the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Initialize the Google Cloud Storage client with project ID for workload identity
    try:
        client = storage.Client(project=project_id)
    except Exception as e:
        raise PermissionError(f"Failed to initialize Google Cloud Storage client: {str(e)}")
    
    # Get the bucket from environment variable
    try:
        bucket = client.bucket(bucket_name)
    except NotFound:
        raise Exception(f"Bucket '{bucket_name}' not found")
    except Forbidden:
        raise PermissionError(f"Permission denied accessing bucket '{bucket_name}'")
    except Exception as e:
        raise Exception(f"Failed to access bucket: {str(e)}")
    
    # Construct destination blob name using the specified format
    file_name = os.path.basename(file_path)
    destination_blob_name = f"prod_org_{organization_id}/{file_name}"
    
    # Create the blob (file object in the bucket)
    blob = bucket.blob(destination_blob_name)
    
    try:
        # Upload the file
        with open(file_path, 'rb') as file_data:
            blob.upload_from_file(file_data)
        
        # Print success message including the final blob name
        print(f"File uploaded successfully to blob: {destination_blob_name}")
        
    except Forbidden:
        raise PermissionError(f"Permission denied uploading to bucket '{bucket_name}'")
    except Exception as e:
        raise Exception(f"Failed to upload file: {str(e)}")


def get_secure_document_url(organization_id: str, file_name: str) -> str:
    """
    Generates a v4 signed URL for secure access to a document in Google Cloud Storage.
    
    Args:
        organization_id (str): The organization ID for organizing files
        file_name (str): The name of the file to generate URL for
        
    Returns:
        str: The v4 signed URL that expires in 15 minutes
        
    Raises:
        ValueError: If the GCS_BUCKET_NAME environment variable is not set
        NotFound: If the specified file (blob) is not found
        PermissionError: If there are permission issues with Google Cloud Storage
        Exception: If URL generation fails for other reasons
    """
    
    # Get bucket name from environment variable
    bucket_name = os.getenv('GCS_BUCKET_NAME')
    if not bucket_name:
        raise ValueError("GCS_BUCKET_NAME environment variable is not set or is empty")
    
    # Get project ID from environment variable for workload identity
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    if not project_id:
        raise ValueError("GOOGLE_CLOUD_PROJECT environment variable is not set")
    
    # Initialize the Google Cloud Storage client with project ID for workload identity
    try:
        client = storage.Client(project=project_id)
    except Exception as e:
        raise PermissionError(f"Failed to initialize Google Cloud Storage client: {str(e)}")
    
    # Get the bucket from environment variable
    try:
        bucket = client.bucket(bucket_name)
    except NotFound:
        raise Exception(f"Bucket '{bucket_name}' not found")
    except Forbidden:
        raise PermissionError(f"Permission denied accessing bucket '{bucket_name}'")
    except Exception as e:
        raise Exception(f"Failed to access bucket: {str(e)}")
    
    # Construct the full blob name using the specified format
    blob_name = f"prod_org_{organization_id}/{file_name}"
    
    # Get the blob (file object in the bucket)
    blob = bucket.blob(blob_name)
    
    # Check if the blob exists
    if not blob.exists():
        raise NotFound(f"File not found: {blob_name}")
    
    try:
        # Generate a v4 signed URL that expires in 15 minutes
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="GET"
        )
        
        return url
        
    except Forbidden:
        raise PermissionError(f"Permission denied generating URL for blob '{blob_name}'")
    except Exception as e:
        raise Exception(f"Failed to generate signed URL: {str(e)}")


def main():
    """
    Example usage of the upload_secure_document and get_secure_document_url functions.
    """
    # Example usage
    try:
        organization_id = "org-123"
        file_path = "/path/to/your/document.pdf"
        
        upload_secure_document(organization_id, file_path)
        print("Document uploaded successfully")
        
        # Example of getting a signed URL
        file_name = "document.pdf"
        url = get_secure_document_url(organization_id, file_name)
        print(f"Secure URL generated: {url}")
        
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()