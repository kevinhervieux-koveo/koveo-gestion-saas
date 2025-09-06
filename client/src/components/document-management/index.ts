/**
 * Document Management Components
 * 
 * A comprehensive set of reusable React components for document management
 * Built with TypeScript, Tailwind CSS, and Shadcn/ui
 * 
 * Features:
 * - Mobile-first design with camera integration
 * - Role-based access control and permissions
 * - Secure file upload and validation
 * - Law 25 compliance for Quebec property management
 */

// Core Document Management Components
export { SharedUploader } from './SharedUploader';
export { DocumentCard } from './DocumentCard';
// Note: DocumentViewModal and DocumentEditModal were temporarily removed but may be needed

// Invoice Management Components
export { default as InvoiceForm } from '../invoices/InvoiceForm';
export { default as GeminiInvoiceExtractor } from '../invoices/GeminiInvoiceExtractor';

// Bill Management Components
export { default as ModularBillForm } from '../bill-management/ModularBillForm';
export { GeminiBillExtractor } from '../bill-management/GeminiBillExtractor';

// Re-export useful types that consumers might need
export type {
  // Types that might be useful for consumers
} from './SharedUploader';

// Usage Examples:
//
// Basic file upload:
// <SharedUploader 
//   onDocumentChange={(file, text) => console.log(file, text)}
//   allowedFileTypes={['application/pdf', 'image/*']}
//   maxFileSize={25}
// />
//
// Document display:
// <DocumentCard
//   title="Building Bylaws 2024"
//   documentId="doc-123"
//   onViewClick={(id) => handleView(id)}
//   documentType="bylaw"
//   createdAt="2024-01-15"
// />
//
// AI-enhanced upload with form-specific context:
// <SharedUploader 
//   formType="bills"
//   uploadContext={{ type: 'bills', organizationId: 'org-123' }}
//   aiAnalysisEnabled={true}
//   showAiToggle={true}
//   onDocumentChange={(file, text) => console.log(file, text)}
//   onAiAnalysisComplete={(data) => console.log('AI extracted:', data)}
//   allowedFileTypes={['application/pdf', 'image/*']}
//   maxFileSize={25}
// />