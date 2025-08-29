#!/usr/bin/env python3
"""
Google Cloud Storage document upload utility.

This module provides a secure document upload function that organizes files
by organization structure in Google Cloud Storage.
"""

import os
from typing import Optional
from google.cloud import storage


def upload_secure_document(bucket_name: str, organization_id: str, file_path: str) -> str:
    """
    Uploads a document securely to Google Cloud Storage with organization-based structure.
    
    Args:
        bucket_name (str): The name of the Google Cloud Storage bucket
        organization_id (str): The organization ID for organizing files
        file_path (str): Local path to the file to upload
        
    Returns:
        str: The public URL of the uploaded file
        
    Raises:
        FileNotFoundError: If the local file doesn't exist
        Exception: If the upload fails
    """
    
    # Verify the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Initialize the Google Cloud Storage client
    client = storage.Client()
    
    # Get the bucket
    bucket = client.bucket(bucket_name)
    
    # Create the destination path with organization structure
    filename = os.path.basename(file_path)
    destination_path = f"organizations/{organization_id}/documents/{filename}"
    
    # Create the blob (file object in the bucket)
    blob = bucket.blob(destination_path)
    
    try:
        # Upload the file
        with open(file_path, 'rb') as file_data:
            blob.upload_from_file(file_data)
        
        # Make the blob publicly readable (optional - remove for private files)
        blob.make_public()
        
        print(f"File {filename} uploaded successfully to {destination_path}")
        
        # Return the public URL
        return blob.public_url
        
    except Exception as e:
        raise Exception(f"Failed to upload file: {str(e)}")


def main():
    """
    Example usage of the upload_secure_document function.
    """
    # Example usage
    try:
        bucket_name = "your-bucket-name"
        organization_id = "org-123"
        file_path = "/path/to/your/document.pdf"
        
        url = upload_secure_document(bucket_name, organization_id, file_path)
        print(f"Document uploaded successfully: {url}")
        
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()