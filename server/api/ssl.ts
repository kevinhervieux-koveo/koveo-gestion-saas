import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { sslCertificates } from '@shared/schema';
import { requireAuth } from '../auth';
import { getCertificateStatus } from '../services/ssl_service';

// Domain validation schema
const domainSchema = z.object({
  domain: z.string()
    .min(1, 'Domain is required')
    .max(253, 'Domain too long')
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
      'Invalid domain format'
    )
    .refine(
      (domain) => {
        // Additional validation rules
        if (domain.startsWith('-') || domain.endsWith('-')) {return false;}
        if (domain.includes('..')) {return false;}
        const parts = domain.split('.');
        return parts.every(part => part.length > 0 && part.length <= 63);
      },
      'Invalid domain format'
    )
});

/**
 * Registers all SSL-related API endpoints.
 *
 * @param app - Express application instance.
 */
export function registerSSLRoutes(app: Express): void {
  /**
   * GET /api/ssl/:domain - Retrieves SSL certificate information for a given domain.
   * 
   * Requires authentication and returns certificate data, expiry date, and renewal status.
   * 
   * @param domain - The domain name to retrieve certificate information for.
   * @returns SSL certificate information including status and expiry details.
   */
  app.get('/api/ssl/:domain', requireAuth, async (req, res) => {
    try {
      // Validate domain parameter
      const validationResult = domainSchema.safeParse({ domain: req.params.domain });
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid domain format',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      const { domain } = validationResult.data;

      // Query the ssl_certificates table
      const certificateRecord = await db.select()
        .from(sslCertificates)
        .where(eq(sslCertificates.domain, domain))
        .limit(1);

      if (certificateRecord.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: `No SSL certificate found for domain: ${domain}`
        });
      }

      const certificate = certificateRecord[0];

      // Calculate certificate status and expiry information
      const certificateData = {
        certificate: certificate.certificateData,
        privateKey: certificate.privateKey,
        issuer: certificate.issuer,
        subject: certificate.subject,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        serialNumber: certificate.serialNumber,
        fingerprint: certificate.fingerprint
      };

      const status = getCertificateStatus(certificateData);

      // Prepare response data (excluding sensitive information)
      const responseData = {
        domain: certificate.domain,
        issuer: certificate.issuer,
        subject: certificate.subject,
        serialNumber: certificate.serialNumber,
        fingerprint: certificate.fingerprint,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        status: certificate.status,
        autoRenew: certificate.autoRenew,
        lastRenewalAttempt: certificate.lastRenewalAttempt,
        renewalAttempts: certificate.renewalAttempts,
        maxRenewalAttempts: certificate.maxRenewalAttempts,
        renewalError: certificate.renewalError,
        dnsProvider: certificate.dnsProvider,
        createdAt: certificate.createdAt,
        updatedAt: certificate.updatedAt,
        // Computed status information
        certificateStatus: {
          isValid: status.isValid,
          isExpiring: status.isExpiring,
          daysUntilExpiry: status.daysUntilExpiry,
          statusLabel: status.status
        }
      };

      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error(`Failed to fetch SSL certificate for domain ${req.params.domain}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve SSL certificate information'
      });
    }
  });

  /**
   * GET /api/ssl - Retrieves all SSL certificates (admin only).
   * 
   * Returns a list of all managed SSL certificates with their status.
   */
  app.get('/api/ssl', requireAuth, async (req, res) => {
    try {
      // Check if user has appropriate permissions (assuming admin role required)
      // This could be enhanced with proper RBAC using the permissions system
      if (req.user?.role !== 'admin' && req.user?.role !== 'owner') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions to view all SSL certificates'
        });
      }

      const certificates = await db.select({
        id: sslCertificates.id,
        domain: sslCertificates.domain,
        issuer: sslCertificates.issuer,
        subject: sslCertificates.subject,
        validFrom: sslCertificates.validFrom,
        validTo: sslCertificates.validTo,
        status: sslCertificates.status,
        autoRenew: sslCertificates.autoRenew,
        lastRenewalAttempt: sslCertificates.lastRenewalAttempt,
        renewalAttempts: sslCertificates.renewalAttempts,
        maxRenewalAttempts: sslCertificates.maxRenewalAttempts,
        renewalError: sslCertificates.renewalError,
        createdAt: sslCertificates.createdAt,
        updatedAt: sslCertificates.updatedAt
      }).from(sslCertificates);

      // Calculate status for each certificate
      const certificatesWithStatus = certificates.map(cert => {
        const certificateData = {
          certificate: '', // Not needed for status calculation
          privateKey: '',
          issuer: cert.issuer,
          subject: cert.subject,
          validFrom: cert.validFrom,
          validTo: cert.validTo,
          serialNumber: '',
          fingerprint: ''
        };

        const status = getCertificateStatus(certificateData);

        return {
          ...cert,
          certificateStatus: {
            isValid: status.isValid,
            isExpiring: status.isExpiring,
            daysUntilExpiry: status.daysUntilExpiry,
            statusLabel: status.status
          }
        };
      });

      res.json({
        success: true,
        data: certificatesWithStatus,
        count: certificatesWithStatus.length
      });

    } catch (error) {
      console.error('Failed to fetch SSL certificates:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve SSL certificates'
      });
    }
  });

  /**
   * GET /api/ssl/:domain/status - Get detailed status information for a certificate.
   * 
   * Returns detailed certificate status including expiry warnings and renewal information.
   */
  app.get('/api/ssl/:domain/status', requireAuth, async (req, res) => {
    try {
      // Validate domain parameter
      const validationResult = domainSchema.safeParse({ domain: req.params.domain });
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid domain format',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      const { domain } = validationResult.data;

      const certificateRecord = await db.select()
        .from(sslCertificates)
        .where(eq(sslCertificates.domain, domain))
        .limit(1);

      if (certificateRecord.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: `No SSL certificate found for domain: ${domain}`
        });
      }

      const certificate = certificateRecord[0];
      const certificateData = {
        certificate: certificate.certificateData,
        privateKey: certificate.privateKey,
        issuer: certificate.issuer,
        subject: certificate.subject,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        serialNumber: certificate.serialNumber,
        fingerprint: certificate.fingerprint
      };

      const status = getCertificateStatus(certificateData);

      const statusInfo = {
        domain: certificate.domain,
        status: certificate.status,
        autoRenew: certificate.autoRenew,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        daysUntilExpiry: status.daysUntilExpiry,
        isValid: status.isValid,
        isExpiring: status.isExpiring,
        statusLabel: status.status,
        lastRenewalAttempt: certificate.lastRenewalAttempt,
        renewalAttempts: certificate.renewalAttempts,
        maxRenewalAttempts: certificate.maxRenewalAttempts,
        renewalError: certificate.renewalError,
        issuer: certificate.issuer,
        // Additional computed information
        needsRenewal: status.isExpiring || status.status === 'expired',
        canAutoRenew: certificate.autoRenew && certificate.renewalAttempts < certificate.maxRenewalAttempts,
        nextRenewalEligible: certificate.renewalAttempts < certificate.maxRenewalAttempts,
        warnings: []
      };

      // Add warnings based on certificate status
      if (status.status === 'expired') {
        statusInfo.warnings.push('Certificate has expired and needs immediate renewal');
      } else if (status.isExpiring) {
        statusInfo.warnings.push(`Certificate expires in ${status.daysUntilExpiry} days`);
      }

      if (certificate.renewalAttempts >= certificate.maxRenewalAttempts) {
        statusInfo.warnings.push('Maximum renewal attempts reached - manual intervention required');
      }

      if (certificate.renewalError) {
        statusInfo.warnings.push(`Last renewal failed: ${certificate.renewalError}`);
      }

      res.json({
        success: true,
        data: statusInfo
      });

    } catch (error) {
      console.error(`Failed to fetch SSL certificate status for domain ${req.params.domain}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve SSL certificate status'
      });
    }
  });
}