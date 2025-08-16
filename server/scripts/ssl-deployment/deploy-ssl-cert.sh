#!/bin/bash

# SSL Certificate Deployment Script for Nginx
# Securely deploys SSL certificates to Nginx and restarts the service
# Usage: ./deploy-ssl-cert.sh <domain> <cert_file> <key_file>

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# =============================================================================
# Configuration - Override with environment variables
# =============================================================================

# Nginx configuration settings
NGINX_SITES_AVAILABLE="${NGINX_SITES_AVAILABLE:-/etc/nginx/sites-available}"
NGINX_SITES_ENABLED="${NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}"
NGINX_CONFIG_FILE="${NGINX_CONFIG_FILE:-default}"
NGINX_RESTART_CMD="${NGINX_RESTART_CMD:-systemctl restart nginx}"
NGINX_TEST_CMD="${NGINX_TEST_CMD:-nginx -t}"
NGINX_RELOAD_CMD="${NGINX_RELOAD_CMD:-systemctl reload nginx}"

# SSL certificate storage settings
SSL_CERT_DIR="${SSL_CERT_DIR:-/etc/ssl/certs}"
SSL_KEY_DIR="${SSL_KEY_DIR:-/etc/ssl/private}"
SSL_BACKUP_DIR="${SSL_BACKUP_DIR:-/etc/ssl/backups}"

# Security settings
SSL_CERT_PERMISSIONS="${SSL_CERT_PERMISSIONS:-644}"
SSL_KEY_PERMISSIONS="${SSL_KEY_PERMISSIONS:-600}"
SSL_KEY_OWNER="${SSL_KEY_OWNER:-root:root}"

# Deployment settings
BACKUP_ENABLED="${BACKUP_ENABLED:-true}"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    local level="$1"
    shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [${level}] $*" >&2
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        log "DEBUG" "$@"
    fi
}

# Secure cleanup function - ensures no sensitive data is left behind
cleanup() {
    local exit_code=$?
    
    # Clean up any temporary files (but don't log their contents)
    if [[ -n "${TEMP_CERT_FILE:-}" && -f "${TEMP_CERT_FILE}" ]]; then
        rm -f "${TEMP_CERT_FILE}"
        log_debug "Cleaned up temporary certificate file"
    fi
    
    if [[ -n "${TEMP_KEY_FILE:-}" && -f "${TEMP_KEY_FILE}" ]]; then
        shred -u "${TEMP_KEY_FILE}" 2>/dev/null || rm -f "${TEMP_KEY_FILE}"
        log_debug "Securely cleaned up temporary key file"
    fi
    
    exit $exit_code
}

trap cleanup EXIT

# Validate required commands are available
check_dependencies() {
    local deps=("nginx" "openssl")
    
    if [[ "${NGINX_RESTART_CMD}" == systemctl* ]]; then
        deps+=("systemctl")
    fi
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            log_error "Required command not found: $dep"
            exit 1
        fi
    done
}

# Validate certificate and private key
validate_ssl_files() {
    local cert_file="$1"
    local key_file="$2"
    
    log_debug "Validating SSL certificate and private key"
    
    # Check certificate validity
    if ! openssl x509 -in "$cert_file" -noout -checkend 86400 >/dev/null 2>&1; then
        log_error "Certificate validation failed or expires within 24 hours"
        return 1
    fi
    
    # Check private key validity
    if ! openssl rsa -in "$key_file" -check -noout >/dev/null 2>&1; then
        log_error "Private key validation failed"
        return 1
    fi
    
    # Verify certificate and key match
    local cert_modulus key_modulus
    cert_modulus=$(openssl x509 -noout -modulus -in "$cert_file" 2>/dev/null | openssl md5 2>/dev/null)
    key_modulus=$(openssl rsa -noout -modulus -in "$key_file" 2>/dev/null | openssl md5 2>/dev/null)
    
    if [[ "$cert_modulus" != "$key_modulus" ]]; then
        log_error "Certificate and private key do not match"
        return 1
    fi
    
    log_info "SSL certificate and private key validation successful"
    return 0
}

# Create backup of existing certificates
backup_existing_certs() {
    local domain="$1"
    local backup_dir="${SSL_BACKUP_DIR}/${domain}/$(date +%Y%m%d_%H%M%S)"
    
    if [[ "${BACKUP_ENABLED}" != "true" ]]; then
        return 0
    fi
    
    log_info "Creating backup of existing certificates"
    
    mkdir -p "$backup_dir"
    chmod 700 "$backup_dir"
    
    local cert_path="${SSL_CERT_DIR}/${domain}.crt"
    local key_path="${SSL_KEY_DIR}/${domain}.key"
    
    if [[ -f "$cert_path" ]]; then
        cp "$cert_path" "$backup_dir/"
        log_debug "Backed up existing certificate to $backup_dir"
    fi
    
    if [[ -f "$key_path" ]]; then
        cp "$key_path" "$backup_dir/"
        chmod 600 "$backup_dir/$(basename "$key_path")"
        log_debug "Backed up existing private key to $backup_dir"
    fi
}

# Deploy certificate and private key
deploy_ssl_files() {
    local domain="$1"
    local cert_file="$2"
    local key_file="$3"
    
    local target_cert_path="${SSL_CERT_DIR}/${domain}.crt"
    local target_key_path="${SSL_KEY_DIR}/${domain}.key"
    
    log_info "Deploying SSL certificate for domain: $domain"
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would deploy certificate to: $target_cert_path"
        log_info "[DRY RUN] Would deploy private key to: $target_key_path"
        return 0
    fi
    
    # Create directories if they don't exist
    mkdir -p "$SSL_CERT_DIR" "$SSL_KEY_DIR"
    
    # Deploy certificate
    cp "$cert_file" "$target_cert_path"
    chmod "$SSL_CERT_PERMISSIONS" "$target_cert_path"
    chown "$SSL_KEY_OWNER" "$target_cert_path"
    log_info "Certificate deployed to: $target_cert_path"
    
    # Deploy private key securely
    (
        umask 077  # Ensure restrictive permissions during creation
        cp "$key_file" "$target_key_path"
    )
    chmod "$SSL_KEY_PERMISSIONS" "$target_key_path"
    chown "$SSL_KEY_OWNER" "$target_key_path"
    log_info "Private key deployed securely"
    
    # Verify final permissions
    local cert_perms key_perms
    cert_perms=$(stat -c "%a" "$target_cert_path")
    key_perms=$(stat -c "%a" "$target_key_path")
    
    if [[ "$cert_perms" != "$SSL_CERT_PERMISSIONS" ]]; then
        log_warn "Certificate permissions are $cert_perms, expected $SSL_CERT_PERMISSIONS"
    fi
    
    if [[ "$key_perms" != "$SSL_KEY_PERMISSIONS" ]]; then
        log_error "Private key permissions are $key_perms, expected $SSL_KEY_PERMISSIONS"
        return 1
    fi
}

# Update Nginx configuration
update_nginx_config() {
    local domain="$1"
    local config_path="${NGINX_SITES_AVAILABLE}/${NGINX_CONFIG_FILE}"
    local backup_config="${config_path}.backup.$(date +%Y%m%d_%H%M%S)"
    
    log_info "Updating Nginx configuration for domain: $domain"
    
    if [[ ! -f "$config_path" ]]; then
        log_error "Nginx configuration file not found: $config_path"
        return 1
    fi
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would update Nginx configuration: $config_path"
        return 0
    fi
    
    # Backup existing configuration
    cp "$config_path" "$backup_config"
    log_debug "Nginx configuration backed up to: $backup_config"
    
    # Create updated configuration
    local cert_path="${SSL_CERT_DIR}/${domain}.crt"
    local key_path="${SSL_KEY_DIR}/${domain}.key"
    
    # Use a temporary file for the update to avoid partial writes
    local temp_config="${config_path}.tmp"
    
    # Generate SSL configuration block
    cat > "$temp_config" << EOF
server {
    listen 80;
    server_name ${domain};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};
    
    # SSL Configuration
    ssl_certificate ${cert_path};
    ssl_certificate_key ${key_path};
    
    # Modern SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Document root and location blocks
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
    
    # Atomic move to replace configuration
    mv "$temp_config" "$config_path"
    log_info "Nginx configuration updated successfully"
}

# Test and restart Nginx
restart_nginx() {
    log_info "Testing Nginx configuration"
    
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would test and restart Nginx"
        return 0
    fi
    
    # Test configuration first
    if ! eval "$NGINX_TEST_CMD" >/dev/null 2>&1; then
        log_error "Nginx configuration test failed"
        return 1
    fi
    
    log_info "Nginx configuration test passed"
    
    # Try graceful reload first, fallback to restart
    if eval "$NGINX_RELOAD_CMD" >/dev/null 2>&1; then
        log_info "Nginx reloaded successfully"
    elif eval "$NGINX_RESTART_CMD" >/dev/null 2>&1; then
        log_info "Nginx restarted successfully"
    else
        log_error "Failed to reload/restart Nginx"
        return 1
    fi
}

# =============================================================================
# Main Function
# =============================================================================

main() {
    local domain="$1"
    local cert_file="$2"
    local key_file="$3"
    
    log_info "Starting SSL certificate deployment for domain: $domain"
    
    # Validate inputs
    if [[ ! -f "$cert_file" ]]; then
        log_error "Certificate file not found: $cert_file"
        exit 1
    fi
    
    if [[ ! -f "$key_file" ]]; then
        log_error "Private key file not found: $key_file"
        exit 1
    fi
    
    # Check dependencies
    check_dependencies
    
    # Validate SSL files
    if ! validate_ssl_files "$cert_file" "$key_file"; then
        log_error "SSL file validation failed"
        exit 1
    fi
    
    # Create backup of existing certificates
    backup_existing_certs "$domain"
    
    # Deploy SSL files
    if ! deploy_ssl_files "$domain" "$cert_file" "$key_file"; then
        log_error "Failed to deploy SSL files"
        exit 1
    fi
    
    # Update Nginx configuration
    if ! update_nginx_config "$domain"; then
        log_error "Failed to update Nginx configuration"
        exit 1
    fi
    
    # Test and restart Nginx
    if ! restart_nginx; then
        log_error "Failed to restart Nginx"
        exit 1
    fi
    
    log_info "SSL certificate deployment completed successfully for domain: $domain"
}

# =============================================================================
# Script Entry Point
# =============================================================================

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Validate arguments
    if [[ $# -ne 3 ]]; then
        echo "Usage: $0 <domain> <certificate_file> <private_key_file>"
        echo ""
        echo "Environment variables:"
        echo "  NGINX_SITES_AVAILABLE   - Nginx sites-available directory (default: /etc/nginx/sites-available)"
        echo "  NGINX_CONFIG_FILE       - Nginx config file name (default: default)"
        echo "  NGINX_RESTART_CMD       - Command to restart Nginx (default: systemctl restart nginx)"
        echo "  SSL_CERT_DIR           - Directory for certificates (default: /etc/ssl/certs)"
        echo "  SSL_KEY_DIR            - Directory for private keys (default: /etc/ssl/private)"
        echo "  DRY_RUN                - Set to 'true' for dry run (default: false)"
        echo "  VERBOSE                - Set to 'true' for verbose output (default: false)"
        exit 1
    fi
    
    # Check if running as root (required for system file modifications)
    if [[ $EUID -ne 0 && "${DRY_RUN}" != "true" ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    main "$@"
fi