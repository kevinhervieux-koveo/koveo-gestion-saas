# Koveo Gestion API Documentation

## Table of Contents

- [Authentication Endpoints](#authentication-endpoints)
- [User Management](#user-management)
- [Organization Management](#organization-management)
- [Building Management](#building-management)
- [Residence Management](#residence-management)
- [Financial Management](#financial-management)
- [Maintenance Requests](#maintenance-requests)
- [Document Management](#document-management)
- [Notification System](#notification-system)
- [Roadmap & Features](#roadmap--features)
- [Demo Organization Sync](#demo-organization-sync)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)

## Authentication Endpoints

### POST /api/auth/login
**Purpose**: Authenticate user with username/password

**Request Body**:
```typescript
{
  username: string;
  password: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'manager' | 'tenant' | 'resident';
    organizationId: string;
  }
}
```

### POST /api/auth/logout
**Purpose**: End user session

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

### GET /api/auth/user
**Purpose**: Get current authenticated user information

**Response**:
```typescript
{
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  isActive: boolean;
}
```

## User Management

### GET /api/users
**Purpose**: List all users with optional filtering

**Query Parameters**:
- `organizationId`: Filter by organization
- `role`: Filter by user role
- `isActive`: Filter active/inactive users

**Response**:
```typescript
{
  users: User[];
  total: number;
}
```

### POST /api/users
**Purpose**: Create new user

**Request Body**:
```typescript
{
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'tenant' | 'resident';
  organizationId: string;
  password: string;
}
```

### PUT /api/users/:id
**Purpose**: Update user information

**Request Body**: Partial user object with fields to update

### DELETE /api/users/:id
**Purpose**: Deactivate user account

### POST /api/users/invite
**Purpose**: Send invitation to new user

**Request Body**:
```typescript
{
  email: string;
  role: string;
  organizationId: string;
  residenceId?: string;
  invitedBy: string;
}
```

## Organization Management

### GET /api/organizations
**Purpose**: List all organizations (admin only)

**Response**:
```typescript
{
  organizations: Organization[];
}
```

### POST /api/organizations
**Purpose**: Create new organization

**Request Body**:
```typescript
{
  name: string;
  type: 'koveo' | 'demo' | 'normal';
  contactEmail: string;
  phone?: string;
  address?: string;
}
```

### PUT /api/organizations/:id
**Purpose**: Update organization details

### GET /api/organizations/:id/stats
**Purpose**: Get organization statistics and metrics

**Response**:
```typescript
{
  totalBuildings: number;
  totalResidences: number;
  totalUsers: number;
  activeMaintenanceRequests: number;
  unpaidBills: number;
}
```

## Building Management

### GET /api/buildings
**Purpose**: List buildings for organization

**Query Parameters**:
- `organizationId`: Required for filtering

**Response**:
```typescript
{
  buildings: Building[];
}
```

### POST /api/buildings
**Purpose**: Create new building

**Request Body**:
```typescript
{
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'apartment' | 'condo' | 'townhouse';
  organizationId: string;
  totalUnits: number;
}
```

### PUT /api/buildings/:id
**Purpose**: Update building information

### DELETE /api/buildings/:id
**Purpose**: Deactivate building

### GET /api/buildings/:id/residences
**Purpose**: Get all residences in a building

## Residence Management

### GET /api/residences
**Purpose**: List residences with filtering

**Query Parameters**:
- `buildingId`: Filter by building
- `isActive`: Filter active/inactive

### POST /api/residences
**Purpose**: Create new residence

**Request Body**:
```typescript
{
  buildingId: string;
  unitNumber: string;
  floor: number;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
}
```

### PUT /api/residences/:id
**Purpose**: Update residence details

### POST /api/user-residences
**Purpose**: Associate user with residence

**Request Body**:
```typescript
{
  userId: string;
  residenceId: string;
  relationshipType: 'owner' | 'tenant' | 'occupant';
  startDate: string;
  endDate?: string;
}
```

## Financial Management

### GET /api/bills
**Purpose**: List bills with filtering

**Query Parameters**:
- `residenceId`: Filter by residence
- `status`: Filter by payment status
- `type`: Filter by bill type

### POST /api/bills
**Purpose**: Create new bill

**Request Body**:
```typescript
{
  residenceId: string;
  billNumber: string;
  amount: number;
  type: 'condo_fees' | 'special_assessment' | 'utility' | 'other';
  dueDate: string;
  description?: string;
}
```

### PUT /api/bills/:id
**Purpose**: Update bill (typically status changes)

### GET /api/budgets
**Purpose**: List budgets for building/organization

### POST /api/budgets
**Purpose**: Create annual budget

**Request Body**:
```typescript
{
  buildingId: string;
  year: number;
  category: string;
  plannedAmount: number;
  description?: string;
}
```

## Maintenance Requests

### GET /api/maintenance-requests
**Purpose**: List maintenance requests

**Query Parameters**:
- `residenceId`: Filter by residence
- `status`: Filter by request status
- `priority`: Filter by priority level

### POST /api/maintenance-requests
**Purpose**: Submit new maintenance request

**Request Body**:
```typescript
{
  residenceId: string;
  title: string;
  description: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'structural' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  submittedBy: string;
}
```

### PUT /api/maintenance-requests/:id
**Purpose**: Update maintenance request status

### POST /api/maintenance-requests/:id/assign
**Purpose**: Assign maintenance request to user

**Request Body**:
```typescript
{
  assignedTo: string;
  scheduledDate?: string;
  notes?: string;
}
```

## Document Management

### GET /api/documents
**Purpose**: List documents with access control

**Query Parameters**:
- `organizationId`: Filter by organization
- `buildingId`: Filter by building
- `category`: Filter by document type
- `isPublic`: Filter public/private documents

### POST /api/documents
**Purpose**: Upload new document

**Request Body** (multipart/form-data):
```typescript
{
  file: File;
  category: string;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  isPublic: boolean;
  description?: string;
}
```

### DELETE /api/documents/:id
**Purpose**: Delete document (with permission checks)

## Notification System

### GET /api/notifications
**Purpose**: Get user notifications

**Query Parameters**:
- `isRead`: Filter read/unread notifications
- `type`: Filter by notification type

### POST /api/notifications
**Purpose**: Create new notification

**Request Body**:
```typescript
{
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  relatedEntityId?: string;
  relatedEntityType?: string;
}
```

### PUT /api/notifications/:id/read
**Purpose**: Mark notification as read

## Roadmap & Features

### GET /api/features
**Purpose**: List platform features and roadmap items

**Query Parameters**:
- `showOnRoadmap`: Filter roadmap visibility
- `category`: Filter by feature category

### POST /api/features
**Purpose**: Create new feature (admin only)

**Request Body**:
```typescript
{
  title: string;
  description: string;
  category: string;
  status: 'planned' | 'in_development' | 'testing' | 'released';
  showOnRoadmap: boolean;
  estimatedCompletion?: string;
}
```

### PUT /api/features/:id
**Purpose**: Update feature status

## Demo Organization Sync

### POST /api/demo-organization/sync
**Purpose**: Synchronize demo organization data

**Headers**:
- `x-sync-api-key`: Required API key for synchronization

### GET /api/demo-organization/export
**Purpose**: Export demo organization data

### GET /api/demo-organization/status
**Purpose**: Check synchronization status

## Response Formats

### Success Response
```typescript
{
  success: true;
  data: any;
  message?: string;
}
```

### Error Response
```typescript
{
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

### Pagination Response
```typescript
{
  data: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
}
```

## Error Handling

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `422`: Validation Error
- `500`: Internal Server Error

### Common Error Codes
- `AUTH_REQUIRED`: Authentication required
- `PERMISSION_DENIED`: Insufficient permissions
- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `DUPLICATE_ENTRY`: Resource already exists

## Authentication

Most endpoints require authentication via session cookies. Admin-only endpoints require `admin` role. Organization-scoped endpoints automatically filter by user's organization unless user has admin role.

## Rate Limiting

API requests are limited to 1000 requests per hour per user to prevent abuse.