import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Roadmap features data from the roadmap page
const roadmapData = [
  {
    category: 'Dashboard & Home',
    features: [
      { name: 'Property Overview Dashboard', description: 'Real-time overview of all properties, occupancy rates, and key metrics', status: 'planned' as const },
      { name: 'Quick Actions Panel', description: 'Fast access to common tasks like creating bills or maintenance requests', status: 'planned' as const },
      { name: 'Notification Center', description: 'Centralized notification management with priority levels', status: 'planned' as const, priority: 'high' as const },
      { name: 'Multi-language Support', description: 'Full French and English language support', status: 'planned' as const },
      { name: 'Dark Mode', description: 'Toggle between light and dark themes', status: 'planned' as const },
      { name: 'Customizable Widgets', description: 'Drag-and-drop dashboard customization', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Mobile App', description: 'Native iOS and Android applications', status: 'planned' as const, priority: 'high' as const },
    ]
  },
  {
    category: 'Property Management',
    features: [
      { name: 'Multi-Building Management', description: 'Manage multiple buildings from a single platform', status: 'planned' as const },
      { name: 'Residence Registry', description: 'Complete registry of all units with detailed information', status: 'planned' as const },
      { name: 'Occupancy Tracking', description: 'Real-time tracking of occupied, vacant, and reserved units', status: 'planned' as const, priority: 'high' as const },
      { name: 'Common Areas Management', description: 'Booking system for amenities and common spaces', status: 'planned' as const },
      { name: 'Parking Management', description: 'Assign and track parking spaces and storage units', status: 'planned' as const },
      { name: 'Digital Floor Plans', description: 'Interactive building floor plans with unit details', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Virtual Tours', description: '360° virtual tours for vacant units', status: 'planned' as const, priority: 'low' as const },
    ]
  },
  {
    category: 'Resident Management',
    features: [
      { name: 'Resident Portal', description: 'Self-service portal for residents to view bills and submit requests', status: 'planned' as const },
      { name: 'User Authentication', description: 'Secure login with role-based access control', status: 'planned' as const },
      { name: 'Resident Onboarding', description: 'Automated workflow for new resident registration', status: 'planned' as const, priority: 'high' as const },
      { name: 'Tenant Screening', description: 'Background checks and credit verification', status: 'planned' as const },
      { name: 'Digital Lease Management', description: 'Electronic lease signing and storage', status: 'planned' as const },
      { name: 'Move-in/Move-out Checklists', description: 'Digital inspection forms with photo documentation', status: 'planned' as const, priority: 'high' as const },
      { name: 'Community Board', description: 'Social features for resident communication', status: 'planned' as const, priority: 'medium' as const },
    ]
  },
  {
    category: 'Financial Management',
    features: [
      { name: 'Bill Generation', description: 'Automated monthly bill creation with customizable templates', status: 'planned' as const },
      { name: 'Payment Processing', description: 'Multiple payment methods including bank transfer and credit cards', status: 'planned' as const, priority: 'critical' as const },
      { name: 'Budget Management', description: 'Annual budget planning with line item tracking', status: 'planned' as const, priority: 'high' as const },
      { name: 'Financial Reporting', description: 'Detailed financial reports and statements', status: 'planned' as const, priority: 'high' as const },
      { name: 'Late Payment Management', description: 'Automated reminders and penalty calculations', status: 'planned' as const },
      { name: 'Payment Plans', description: 'Flexible payment arrangements for residents', status: 'planned' as const },
      { name: 'Expense Tracking', description: 'Track and categorize all property expenses', status: 'planned' as const },
      { name: 'Reserve Fund Management', description: 'Track and project reserve fund requirements', status: 'planned' as const, priority: 'high' as const },
      { name: 'Tax Document Generation', description: 'Automated tax forms and receipts', status: 'planned' as const, priority: 'high' as const },
    ]
  },
  {
    category: 'Maintenance & Requests',
    features: [
      { name: 'Request Submission', description: 'Easy submission with photo uploads and location details', status: 'planned' as const },
      { name: 'Priority Management', description: 'Automatic prioritization based on urgency and category', status: 'planned' as const, priority: 'high' as const },
      { name: 'Work Order Assignment', description: 'Assign to internal staff or external contractors', status: 'planned' as const, priority: 'high' as const },
      { name: 'Progress Tracking', description: 'Real-time status updates and completion tracking', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Preventive Maintenance', description: 'Scheduled maintenance calendar and reminders', status: 'planned' as const },
      { name: 'Vendor Management', description: 'Contractor database with ratings and history', status: 'planned' as const },
      { name: 'Inventory Management', description: 'Track maintenance supplies and equipment', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Cost Estimation', description: 'AI-powered maintenance cost predictions', status: 'planned' as const, priority: 'high' as const },
    ]
  },
  {
    category: 'Document Management',
    features: [
      { name: 'Document Upload', description: 'Secure upload with automatic categorization', status: 'planned' as const, priority: 'high' as const },
      { name: 'Access Control', description: 'Role-based document access permissions', status: 'planned' as const, priority: 'high' as const },
      { name: 'Version Control', description: 'Track document versions and changes', status: 'planned' as const },
      { name: 'Digital Signatures', description: 'Electronic signature integration', status: 'planned' as const },
      { name: 'Meeting Minutes', description: 'Template-based meeting documentation', status: 'planned' as const },
      { name: 'Contract Management', description: 'Track contract expiry and renewals', status: 'planned' as const, priority: 'high' as const },
      { name: 'Document OCR', description: 'Text extraction from scanned documents', status: 'planned' as const, priority: 'medium' as const },
    ]
  },
  {
    category: 'Communication',
    features: [
      { name: 'Email Notifications', description: 'Automated email alerts for important events', status: 'planned' as const, priority: 'high' as const },
      { name: 'In-App Messaging', description: 'Direct messaging between users', status: 'planned' as const },
      { name: 'SMS Alerts', description: 'Text message notifications for urgent matters', status: 'planned' as const },
      { name: 'Announcement Board', description: 'Building-wide announcements and notices', status: 'planned' as const },
      { name: 'Push Notifications', description: 'Mobile push notifications', status: 'planned' as const, priority: 'high' as const },
      { name: 'Newsletter System', description: 'Monthly newsletter generation and distribution', status: 'planned' as const, priority: 'low' as const },
    ]
  },
  {
    category: 'AI & Automation',
    features: [
      { name: 'AI Property Assistant', description: 'Natural language chat interface for queries', status: 'planned' as const },
      { name: 'Predictive Maintenance', description: 'AI-powered maintenance predictions', status: 'planned' as const, priority: 'high' as const },
      { name: 'Automated Bill Generation', description: 'Smart billing with automatic adjustments', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Document Intelligence', description: 'AI document analysis and extraction', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Expense Optimization', description: 'AI recommendations for cost reduction', status: 'planned' as const, priority: 'high' as const },
      { name: 'Occupancy Predictions', description: 'Forecast vacancy rates and trends', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Smart Scheduling', description: 'AI-optimized maintenance scheduling', status: 'planned' as const, priority: 'medium' as const },
    ]
  },
  {
    category: 'Compliance & Security',
    features: [
      { name: 'Law 25 Compliance', description: 'Full compliance with Quebec privacy law', status: 'planned' as const },
      { name: 'Data Encryption', description: 'End-to-end encryption for sensitive data', status: 'planned' as const, priority: 'critical' as const },
      { name: 'Audit Logging', description: 'Complete audit trail of all actions', status: 'planned' as const, priority: 'high' as const },
      { name: 'Two-Factor Authentication', description: '2FA for enhanced security', status: 'planned' as const },
      { name: 'GDPR Compliance', description: 'European data protection compliance', status: 'planned' as const },
      { name: 'Data Retention Policies', description: 'Automated data lifecycle management', status: 'planned' as const, priority: 'high' as const },
      { name: 'Security Monitoring', description: 'Real-time threat detection', status: 'planned' as const, priority: 'high' as const },
    ]
  },
  {
    category: 'Analytics & Reporting',
    features: [
      { name: 'Financial Reports', description: 'Comprehensive financial statements', status: 'planned' as const, priority: 'high' as const },
      { name: 'Occupancy Analytics', description: 'Occupancy trends and forecasting', status: 'planned' as const },
      { name: 'Maintenance Analytics', description: 'Maintenance cost and frequency analysis', status: 'planned' as const },
      { name: 'Custom Report Builder', description: 'Drag-and-drop report creation', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Executive Dashboards', description: 'High-level KPI dashboards', status: 'planned' as const, priority: 'high' as const },
      { name: 'Benchmark Analysis', description: 'Compare performance against industry standards', status: 'planned' as const, priority: 'low' as const },
    ]
  },
  {
    category: 'Integration & API',
    features: [
      { name: 'Payment Gateway Integration', description: 'Stripe and Moneris integration', status: 'planned' as const, priority: 'critical' as const },
      { name: 'Accounting Software Sync', description: 'QuickBooks and Sage integration', status: 'planned' as const },
      { name: 'RESTful API', description: 'Full API for third-party integrations', status: 'planned' as const },
      { name: 'Webhook System', description: 'Event-driven webhooks', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Calendar Sync', description: 'Google and Outlook calendar integration', status: 'planned' as const, priority: 'low' as const },
      { name: 'Banking API', description: 'Direct bank account integration', status: 'planned' as const, priority: 'high' as const },
    ]
  },
  {
    category: 'Infrastructure & Performance',
    features: [
      { name: 'Cloud Hosting', description: 'Scalable cloud infrastructure on Vercel', status: 'planned' as const },
      { name: 'Database Optimization', description: 'PostgreSQL with read replicas', status: 'planned' as const },
      { name: 'CDN Distribution', description: 'Global content delivery network', status: 'planned' as const, priority: 'medium' as const },
      { name: 'Auto-scaling', description: 'Automatic resource scaling', status: 'planned' as const },
      { name: 'Backup & Recovery', description: 'Automated backups with point-in-time recovery', status: 'planned' as const },
      { name: 'Load Balancing', description: 'Multi-region load distribution', status: 'planned' as const, priority: 'high' as const },
      { name: 'Performance Monitoring', description: 'Real-time performance analytics', status: 'planned' as const, priority: 'medium' as const },
    ]
  },
];

/**
 * Seeds the database with roadmap features data.
 * @returns Promise that resolves when seeding is complete.
 */
/**
 * SeedFeatures function.
 * @returns Function result.
 */
async function seedFeatures() {
  console.warn('🌱 Starting to seed features...');

  try {
    // Clear existing features
    console.warn('🗑️ Clearing existing features...');
    await db.delete(schema.features);
    
    let totalFeatures = 0;

    for (const section of roadmapData) {
      console.warn(`📁 Seeding ${section.category} features...`);
      
      for (const feature of section.features) {
        await db.insert(schema.features).values({
          name: feature.name,
          description: feature.description,
          category: section.category as any,
          status: feature.status,
          priority: feature.priority || 'medium',
          isPublicRoadmap: true,
        });
        totalFeatures++;
      }
    }

    console.warn(`✅ Successfully seeded ${totalFeatures} features from roadmap!`);
    
    // Verify the seeding
    const allFeatures = await db.select().from(schema.features);
    console.warn(`📊 Total features in database: ${allFeatures.length}`);
    
    // Show breakdown by status
    const statusCounts = allFeatures.reduce((acc, feature) => {
      acc[feature.status] = (acc[feature.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.warn('📈 Feature breakdown by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.warn(`  ${status}: ${count}`);
    });

  } catch (_error) {
    console.error('❌ Error seeding features:', _error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedFeatures().catch((_error) => {
  console.error('Fatal _error:', _error);
  process.exit(1);
});