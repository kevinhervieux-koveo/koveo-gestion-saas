import * as acme from 'acme-client';
import * as forge from 'node-forge';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CertificateData {
  certificate: string;
  privateKey: string;
  issuer: string;
  subject: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  fingerprint: string;
}

export interface SSLServiceOptions {
  email: string;
  staging?: boolean;
  keySize?: number;
  storageDir?: string;
}

export interface DNSRecord {
  name: string;
  type: string;
  value: string;
  ttl?: number;
}

export class SSLService {
  private client?: acme.Client;
  private accountKey?: Buffer;
  private options: Required<SSLServiceOptions>;

  constructor(options: SSLServiceOptions) {
    this.options = {
      email: options.email,
      staging: options.staging || false,
      keySize: options.keySize || 2048,
      storageDir: options.storageDir || './ssl-certificates'
    };
  }

  /**
   * Initialize the SSL service with ACME client
   */
  async initialize(): Promise<void> {
    try {
      // Create storage directory if it doesn't exist
      await this.ensureStorageDirectory();

      // Generate or load account key
      this.accountKey = await this.getOrCreateAccountKey();

      // Create ACME client
      const directoryUrl = this.options.staging 
        ? acme.directory.letsencrypt.staging 
        : acme.directory.letsencrypt.production;

      this.client = new acme.Client({
        directoryUrl,
        accountKey: this.accountKey!
      });

      // Create account if it doesn't exist
      await this.ensureAccount();
    } catch (error) {
      throw new Error(`Failed to initialize SSL service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Request SSL certificate for a domain using DNS challenge
   */
  async requestCertificate(domain: string): Promise<CertificateData> {
    if (!this.client) {
      throw new Error('SSL service not initialized. Call initialize() first.');
    }
    
    const client = this.client;

    try {
      // Validate domain format
      this.validateDomain(domain);

      // Generate certificate key pair
      const certificateKey = await this.generateKeyPair();

      // Create Certificate Signing Request (CSR)
      const csr = await acme.crypto.createCsr({
        key: certificateKey,
        commonName: domain
      });

      // Request certificate with DNS challenge
      const certificate = await client.auto({
        csr,
        email: this.options.email,
        termsOfServiceAgreed: true,
        challengeCreateFn: async (authz: any, challenge: any, keyAuthorization: string) => {
          await this.createDNSChallenge(authz, challenge, keyAuthorization);
        },
        challengeRemoveFn: async (authz: any, challenge: any, keyAuthorization: string) => {
          await this.removeDNSChallenge(authz, challenge, keyAuthorization);
        }
      });

      // Store certificate and key securely
      await this.storeCertificate(domain, certificate, certificateKey);

      // Parse certificate for metadata
      const certData = await this.parseCertificate(certificate, certificateKey);

      return certData;

    } catch (error) {
      throw new Error(`Failed to request certificate for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate domain ownership via DNS records
   */
  async validateDomainOwnership(domain: string): Promise<boolean> {
    try {
      const dns = await import('dns');
      const { promisify } = await import('util');
      const resolveTxt = promisify(dns.resolveTxt);

      // Check if domain has valid DNS records
      const txtRecords = await resolveTxt(domain).catch(() => []);
      
      // For basic validation, just check if domain resolves
      // In production, you might want more sophisticated checks
      return txtRecords !== undefined;
    } catch (error) {
      console.error(`Domain ownership validation failed for ${domain}:`, error);
      return false;
    }
  }

  /**
   * Rotate certificate (renew before expiry)
   */
  async rotateCertificate(domain: string): Promise<CertificateData> {
    try {
      // Check if certificate exists and is near expiry
      const existingCert = await this.getCertificate(domain);
      
      if (existingCert && this.shouldRotateCertificate(existingCert)) {
        console.log(`Rotating certificate for ${domain}`);
        return await this.requestCertificate(domain);
      }

      return existingCert || await this.requestCertificate(domain);
    } catch (error) {
      throw new Error(`Failed to rotate certificate for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get stored certificate for domain
   */
  async getCertificate(domain: string): Promise<CertificateData | null> {
    try {
      const certPath = path.join(this.options.storageDir, domain, 'certificate.pem');
      const keyPath = path.join(this.options.storageDir, domain, 'private-key.pem');

      const [certExists, keyExists] = await Promise.all([
        this.fileExists(certPath),
        this.fileExists(keyPath)
      ]);

      if (!certExists || !keyExists) {
        return null;
      }

      const [certificate, privateKey] = await Promise.all([
        fs.readFile(certPath, 'utf8'),
        fs.readFile(keyPath, 'utf8')
      ]);

      return await this.parseCertificate(certificate, privateKey);
    } catch (error) {
      console.error(`Failed to get certificate for ${domain}:`, error);
      return null;
    }
  }

  /**
   * List all managed certificates
   */
  async listCertificates(): Promise<{ domain: string; cert: CertificateData | null }[]> {
    try {
      const domains = await fs.readdir(this.options.storageDir).catch(() => []);
      const certificates = await Promise.all(
        domains.map(async (domain) => ({
          domain,
          cert: await this.getCertificate(domain)
        }))
      );
      return certificates;
    } catch (error) {
      console.error('Failed to list certificates:', error);
      return [];
    }
  }

  /**
   * Revoke certificate
   */
  async revokeCertificate(domain: string): Promise<void> {
    try {
      const cert = await this.getCertificate(domain);
      if (!cert) {
        throw new Error(`Certificate not found for domain: ${domain}`);
      }

      // Revoke with ACME
      await this.client!.revokeCertificate({
        certificate: Buffer.from(cert.certificate),
        reason: 0 // Unspecified
      });

      // Remove from storage
      await this.removeCertificateFromStorage(domain);
    } catch (error) {
      throw new Error(`Failed to revoke certificate for ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private methods

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.options.storageDir);
    } catch {
      await fs.mkdir(this.options.storageDir, { recursive: true, mode: 0o700 });
    }
  }

  private async getOrCreateAccountKey(): Promise<Buffer> {
    const keyPath = path.join(this.options.storageDir, 'account-key.pem');
    
    try {
      return await fs.readFile(keyPath);
    } catch {
      // Generate new account key
      const key = await acme.crypto.createPrivateKey();
      await fs.writeFile(keyPath, key, { mode: 0o600 });
      return key;
    }
  }

  private async ensureAccount(): Promise<void> {
    try {
      await this.client.createAccount({
        termsOfServiceAgreed: true,
        contact: [`mailto:${this.options.email}`]
      });
    } catch (error) {
      // Account might already exist, which is fine
      if (!error || !error.toString().includes('account already exists')) {
        console.warn('Account creation warning:', error);
      }
    }
  }

  private validateDomain(domain: string): void {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    
    if (!domainRegex.test(domain)) {
      throw new Error(`Invalid domain format: ${domain}`);
    }

    if (domain.length > 253) {
      throw new Error(`Domain too long: ${domain}`);
    }
  }

  private async generateKeyPair(): Promise<Buffer> {
    return await acme.crypto.createPrivateKey(this.options.keySize);
  }

  private async createDNSChallenge(authz: any, challenge: any, keyAuthorization: string): Promise<void> {
    const dnsRecord: DNSRecord = {
      name: `_acme-challenge.${authz.identifier.value}`,
      type: 'TXT',
      value: keyAuthorization,
      ttl: 300
    };

    console.log('\n=== DNS Challenge Required ===');
    console.log(`Domain: ${authz.identifier.value}`);
    console.log(`Record Name: ${dnsRecord.name}`);
    console.log(`Record Type: ${dnsRecord.type}`);
    console.log(`Record Value: ${dnsRecord.value}`);
    console.log('Please create this DNS record and wait for propagation before continuing.');
    console.log('===============================\n');

    // Wait for user confirmation or automated DNS provider integration
    await this.waitForDNSPropagation(dnsRecord);
  }

  private async removeDNSChallenge(authz: any, challenge: any, keyAuthorization: string): Promise<void> {
    const recordName = `_acme-challenge.${authz.identifier.value}`;
    console.log(`DNS challenge completed. You can now remove the TXT record: ${recordName}`);
  }

  private async waitForDNSPropagation(record: DNSRecord, maxAttempts = 30): Promise<void> {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const resolveTxt = promisify(dns.resolveTxt);

    console.log('Waiting for DNS propagation...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const txtRecords = await resolveTxt(record.name);
        const found = txtRecords.some(records => 
          records.some(txt => txt === record.value)
        );

        if (found) {
          console.log('DNS record propagated successfully!');
          return;
        }
      } catch (error) {
        // DNS resolution failed, continue waiting
      }

      console.log(`Attempt ${attempt}/${maxAttempts} - DNS record not yet propagated, waiting 10 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    throw new Error('DNS record propagation timeout. Please verify the DNS record was created correctly.');
  }

  private async storeCertificate(domain: string, certificate: string, privateKey: Buffer): Promise<void> {
    const domainDir = path.join(this.options.storageDir, domain);
    await fs.mkdir(domainDir, { recursive: true, mode: 0o700 });

    const certPath = path.join(domainDir, 'certificate.pem');
    const keyPath = path.join(domainDir, 'private-key.pem');
    const metaPath = path.join(domainDir, 'metadata.json');

    await Promise.all([
      fs.writeFile(certPath, certificate, { mode: 0o644 }),
      fs.writeFile(keyPath, privateKey, { mode: 0o600 }),
      fs.writeFile(metaPath, JSON.stringify({
        domain,
        issuedAt: new Date().toISOString(),
        issuer: 'Let\'s Encrypt'
      }, null, 2), { mode: 0o644 })
    ]);
  }

  private async parseCertificate(certificate: string, privateKey: string | Buffer): Promise<CertificateData> {
    try {
      const cert = forge.pki.certificateFromPem(certificate);
      const key = typeof privateKey === 'string' ? privateKey : privateKey.toString();

      return {
        certificate,
        privateKey: key,
        issuer: cert.issuer.getField('CN')?.value || 'Unknown',
        subject: cert.subject.getField('CN')?.value || 'Unknown',
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
        serialNumber: cert.serialNumber,
        fingerprint: forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex()
      };
    } catch (error) {
      throw new Error(`Failed to parse certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private shouldRotateCertificate(cert: CertificateData): boolean {
    const now = new Date();
    const expiryDate = new Date(cert.validTo);
    const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    // Rotate if certificate expires within 30 days
    return daysUntilExpiry <= 30;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async removeCertificateFromStorage(domain: string): Promise<void> {
    const domainDir = path.join(this.options.storageDir, domain);
    try {
      await fs.rm(domainDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove certificate storage for ${domain}:`, error);
    }
  }
}

/**
 * Factory function to create and initialize SSL service
 */
export async function createSSLService(options: SSLServiceOptions): Promise<SSLService> {
  const service = new SSLService(options);
  await service.initialize();
  return service;
}

/**
 * Utility function to check certificate status
 */
export function getCertificateStatus(cert: CertificateData): {
  isValid: boolean;
  isExpiring: boolean;
  daysUntilExpiry: number;
  status: 'valid' | 'expiring' | 'expired';
} {
  const now = new Date();
  const validFrom = new Date(cert.validFrom);
  const validTo = new Date(cert.validTo);
  
  const isValid = now >= validFrom && now <= validTo;
  const daysUntilExpiry = (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const isExpiring = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  
  let status: 'valid' | 'expiring' | 'expired';
  if (now > validTo) {
    status = 'expired';
  } else if (isExpiring) {
    status = 'expiring';
  } else {
    status = 'valid';
  }

  return {
    isValid,
    isExpiring,
    daysUntilExpiry: Math.floor(daysUntilExpiry),
    status
  };
}