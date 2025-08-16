#!/bin/bash

# SSL Certificate Deployment Usage Examples
# These examples demonstrate how to use the deployment scripts safely

# =============================================================================
# Shell Script Usage Examples
# =============================================================================

# Basic usage with certificate files
# ./deploy-ssl-cert.sh example.com /path/to/cert.pem /path/to/private.key

# Dry run to test configuration
# DRY_RUN=true ./deploy-ssl-cert.sh example.com /path/to/cert.pem /path/to/private.key

# Verbose output for debugging
# VERBOSE=true ./deploy-ssl-cert.sh example.com /path/to/cert.pem /path/to/private.key

# Custom configuration
# SSL_CERT_DIR=/custom/certs SSL_KEY_DIR=/custom/keys ./deploy-ssl-cert.sh example.com /path/to/cert.pem /path/to/private.key

# =============================================================================
# Ansible Playbook Usage Examples  
# =============================================================================

# Basic playbook execution with certificate content
# ansible-playbook -i ansible-inventory.ini deploy-ssl-cert.yml \
#   -e domain=example.com \
#   -e certificate_content="$(cat /path/to/cert.pem)" \
#   -e private_key_content="$(cat /path/to/private.key)"

# Using vault for encrypted private key
# echo "certificate_content: |" > ssl-vars.yml
# cat /path/to/cert.pem | sed 's/^/  /' >> ssl-vars.yml
# ansible-vault encrypt_string "$(cat /path/to/private.key)" --name private_key_content >> ssl-vars.yml
# ansible-playbook -i ansible-inventory.ini deploy-ssl-cert.yml -e @ssl-vars.yml --ask-vault-pass

# =============================================================================
# Integration with SSL Service Example
# =============================================================================

# Function to deploy certificate using the SSL service
deploy_certificate_to_nginx() {
    local domain="$1"
    local cert_data="$2"
    local private_key="$3"
    
    # Create temporary files
    local temp_cert=$(mktemp --suffix=.crt)
    local temp_key=$(mktemp --suffix=.key)
    
    # Cleanup function
    cleanup() {
        rm -f "$temp_cert"
        shred -u "$temp_key" 2>/dev/null || rm -f "$temp_key"
    }
    trap cleanup EXIT
    
    # Write certificate and key to temporary files
    echo "$cert_data" > "$temp_cert"
    echo "$private_key" > "$temp_key"
    chmod 600 "$temp_key"
    
    # Deploy using the shell script
    ./deploy-ssl-cert.sh "$domain" "$temp_cert" "$temp_key"
}

# =============================================================================
# NodeJS Integration Example 
# =============================================================================

# Example function for integrating with the SSL service
node_ssl_deployment_example() {
    cat << 'EOF'
// server/services/nginx-deployment.ts
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { CertificateData } from './ssl_service';

export async function deployToNginx(domain: string, certificate: CertificateData): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'ssl-deploy-'));
  
  try {
    const certFile = join(tempDir, 'certificate.crt');
    const keyFile = join(tempDir, 'private.key');
    
    // Write certificate and private key to temporary files
    writeFileSync(certFile, certificate.certificate, { mode: 0o644 });
    writeFileSync(keyFile, certificate.privateKey, { mode: 0o600 });
    
    // Execute deployment script
    const scriptPath = './server/scripts/ssl-deployment/deploy-ssl-cert.sh';
    const command = `${scriptPath} "${domain}" "${certFile}" "${keyFile}"`;
    
    execSync(command, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        // Configure deployment environment
        SSL_CERT_DIR: process.env.SSL_CERT_DIR || '/etc/ssl/certs',
        SSL_KEY_DIR: process.env.SSL_KEY_DIR || '/etc/ssl/private',
        NGINX_CONFIG_FILE: process.env.NGINX_CONFIG_FILE || domain,
        BACKUP_ENABLED: 'true'
      }
    });
    
    console.log(`Successfully deployed SSL certificate for ${domain}`);
    
  } finally {
    // Securely clean up temporary directory
    rmSync(tempDir, { recursive: true, force: true });
  }
}
EOF
}

echo "SSL deployment usage examples created"
echo "See the examples above for various deployment scenarios"