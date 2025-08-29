#!/usr/bin/env python3
"""
Google Cloud Storage document upload utility.

This module provides a secure document upload function that organizes files
by organization structure in Google Cloud Storage.
"""

import os
from google.cloud import storage
from google.cloud.exceptions import NotFound, Forbidden


def upload_secure_document(bucket_name: str, organization_id: str, file_path: str) -> None:
    """
    Uploads a document securely to Google Cloud Storage with organization-based structure.
    
    Args:
        bucket_name (str): The name of the Google Cloud Storage bucket
        organization_id (str): The organization ID for organizing files
        file_path (str): Local path to the file to upload
        
    Raises:
        FileNotFoundError: If the local file doesn't exist
        PermissionError: If there are permission issues with Google Cloud Storage
        Exception: If the upload fails for other reasons
    """
    
    # Verify the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    
    # Initialize the Google Cloud Storage client using application default credentials
    try:
        client = storage.Client()
    except Exception as e:
        raise PermissionError(f"Failed to initialize Google Cloud Storage client: {str(e)}")
    
    # Get the bucket
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