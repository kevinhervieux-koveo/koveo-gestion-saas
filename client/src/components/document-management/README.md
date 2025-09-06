# Document Management Components

A comprehensive set of reusable React components for document management in the Koveo Gestion property management system. Built with TypeScript, Tailwind CSS, and Shadcn/ui for Quebec's residential communities.

## 🚀 Features

- **Mobile-First Design**: Camera integration, touch-friendly interactions
- **Role-Based Access Control**: Admin, Manager, Tenant, Resident permissions
- **Security Compliant**: Law 25 compliance for Quebec property management
- **File Upload**: Drag-and-drop, clipboard paste, mobile camera integration
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## 📱 Mobile Features

- **Camera Integration**: `capture="environment"` for rear camera access
- **Touch Feedback**: Visual feedback on touch interactions
- **Responsive Layout**: Adapts to screen size and orientation
- **Accessibility**: Screen reader support and keyboard navigation

## 🔧 Components

### 1. SharedUploader

A reusable component for file uploads and text creation.

```tsx
import { SharedUploader } from '@/components/document-management';

<SharedUploader
  onDocumentChange={(file, text) => {
    // Handle file or text content
    console.log('File:', file);
    console.log('Text:', text);
  }}
  allowedFileTypes={['application/pdf', 'image/*']}
  maxFileSize={25} // MB
  defaultTab="file" // or "text"
/>
```

**Features:**
- Mobile camera integration with `capture="environment"`
- Drag-and-drop file upload
- Clipboard paste for screenshots
- Text-only document creation
- File validation (type, size, security)
- Tabs interface for upload modes

### 2. DocumentCard

Standardized card for displaying document summaries.

```tsx
import { DocumentCard } from '@/components/document-management';

<DocumentCard
  title="Building Bylaws 2024"
  documentId="doc-123"
  onViewClick={(id) => handleView(id)}
  documentType="bylaw"
  description="Updated building regulations"
  createdAt="2024-01-15"
  fileSize={2048576} // bytes
  mimeType="application/pdf"
  uploadedBy="John Smith"
  isVisibleToTenants={true}
  compact={false}
  showMetadata={true}
/>
```

**Features:**
- Mobile-friendly touch targets
- Rich metadata display
- Document type badges
- File size and date formatting
- Responsive design options

### 3. DocumentViewModal

Modal for displaying document details with role-based permissions.

```tsx
import { DocumentViewModal } from '@/components/document-management';

<DocumentViewModal
  documentId="doc-123"
  userPermissions={{
    canView: true,
    canDownload: true,
    canEdit: false,
    canDelete: false
  }}
  onEditClick={(id) => handleEdit(id)}
  isOpen={isModalOpen}
  onOpenChange={setIsModalOpen}
/>
```

**Features:**
- TanStack Query integration for data fetching
- Role-based permission handling
- Rich document metadata display
- File download and view capabilities
- Error handling and loading states

### 4. DocumentEditModal

Modal for creating, editing, and deleting documents.

```tsx
import { DocumentEditModal } from '@/components/document-management';

<DocumentEditModal
  documentId={editingId} // undefined for create mode
  entityType="building"
  entityId="building-123"
  isOpen={isEditModalOpen}
  onOpenChange={setIsEditModalOpen}
  onSuccess={(id, action) => {
    console.log(`Document ${action}:`, id);
  }}
/>
```

**Features:**
- React Hook Form with Zod validation
- Create and edit modes in single component
- SharedUploader integration
- Delete confirmation workflow
- Comprehensive error handling

## 🔐 Permission System

The components use a comprehensive permission interface:

```tsx
interface DocumentPermissions {
  canView: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}
```

### Role-Based Permissions

| Role | View | Download | Edit | Delete | Create |
|------|------|----------|------|---------|--------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resident | ✅ | ✅ | ❌ | ❌ | ❌ |
| Tenant | ✅ | ✅ | ❌ | ❌ | ❌ |

## 📄 Document Types

Supported document categories:
- `bylaw` - Building bylaws and regulations
- `financial` - Financial documents and reports
- `maintenance` - Maintenance records and schedules
- `legal` - Legal documents and contracts
- `meeting_minutes` - Meeting minutes and notes
- `insurance` - Insurance policies and claims
- `contracts` - Service contracts and agreements
- `permits` - Building permits and licenses
- `inspection` - Inspection reports and certifications
- `lease` - Lease agreements and amendments
- `correspondence` - Official correspondence
- `utilities` - Utility bills and records
- `other` - Miscellaneous documents

## 🔒 Security Features

- **Authentication Required**: All API endpoints protected by `requireAuth`
- **Role Validation**: User permissions validated for each operation
- **File Validation**: Size, type, and security checks
- **Rate Limiting**: Protection against upload abuse
- **Audit Logging**: Comprehensive security logging
- **Law 25 Compliance**: Quebec privacy law compliance

## 📱 Mobile Usage

The components are optimized for mobile devices:

```tsx
// Mobile camera integration
<input 
  type="file" 
  accept="image/*" 
  capture="environment" // Rear camera
/>

// Touch-friendly interactions
className="active:scale-[0.98] transform"

// Responsive design
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

## 🚀 Integration Example

Complete integration example:

```tsx
import {
  SharedUploader,
  DocumentCard,
  DocumentViewModal,
  DocumentEditModal
} from '@/components/document-management';

export default function DocumentPage() {
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const userPermissions = {
    canView: true,
    canDownload: true,
    canEdit: user?.role === 'manager',
    canDelete: user?.role === 'manager',
    canCreate: user?.role === 'manager',
  };

  return (
    <div>
      {/* Document grid */}
      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          title={doc.name}
          documentId={doc.id}
          onViewClick={(id) => {
            setSelectedId(id);
            setIsViewOpen(true);
          }}
          // ... other props
        />
      ))}

      {/* Modals */}
      <DocumentViewModal
        documentId={selectedId || ''}
        userPermissions={userPermissions}
        onEditClick={(id) => {
          setSelectedId(id);
          setIsEditOpen(true);
          setIsViewOpen(false);
        }}
        isOpen={isViewOpen}
        onOpenChange={setIsViewOpen}
      />

      <DocumentEditModal
        documentId={selectedId}
        entityType="building"
        entityId="building-123"
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={(id, action) => {
          console.log(`Document ${action}:`, id);
          // Refresh data, show toast, etc.
        }}
      />
    </div>
  );
}
```

## 🔧 Development Notes

- All components include comprehensive `data-testid` attributes for testing
- TypeScript types are exported from `shared/schemas/documents`
- Components follow Shadcn/ui design patterns
- Mobile-first responsive design approach
- Dark mode support included

## 📋 API Integration

The components integrate with these secure API endpoints:

- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document details
- `POST /api/documents` - Create text document
- `POST /api/documents/upload` - Upload file document
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:id/file` - Download/view file

All endpoints require authentication and validate user permissions.

## 🎯 Benefits vs Monolithic Approach

| Aspect | Modular Components | Monolithic DocumentManager |
|--------|-------------------|----------------------------|
| **Maintainability** | Small, focused components | Large 800+ line component |
| **Reusability** | Used across different pages | Tightly coupled to specific use case |
| **Testing** | Easy unit testing | Complex integration testing |
| **Mobile UX** | Optimized touch interactions | Basic mobile support |
| **Bundle Size** | Tree-shakable imports | Entire component loaded |
| **Development** | Independent component updates | Changes affect entire system |

---

*Built for Koveo Gestion - Quebec Property Management Platform*