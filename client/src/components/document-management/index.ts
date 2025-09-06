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
export { DocumentViewModal } from './DocumentViewModal';
export { DocumentEditModal } from './DocumentEditModal';

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
// View modal:
// <DocumentViewModal
//   documentId="doc-123"
//   userPermissions={{ canDownload: true, canEdit: false }}
//   onEditClick={(id) => handleEdit(id)}
//   isOpen={isModalOpen}
//   onOpenChange={setIsModalOpen}
// />
//
// Edit/Create modal:
// <DocumentEditModal
//   documentId={editingId} // undefined for create mode
//   entityType="building"
//   entityId="building-123"
//   isOpen={isEditModalOpen}
//   onOpenChange={setIsEditModalOpen}
//   onSuccess={(id, action) => console.log(`Document ${action}:`, id)}
// />