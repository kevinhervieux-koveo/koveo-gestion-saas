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
interface LoginRequest {
  username: string;
  password: string;
}
```

**Example Request**:
```typescript
// Frontend implementation
const loginUser = async (credentials: LoginRequest) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
    credentials: 'include', // Important for session cookies
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  return response.json();
};

// Usage in React component
const handleLogin = async (formData: LoginRequest) => {
  try {
    const result = await loginUser(formData);
    // Handle successful login
    router.push('/dashboard');
  } catch (error) {
    setError('Invalid username or password');
  }
};
```

**Success Response**:
```typescript
interface LoginResponse {
  success: true;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'manager' | 'tenant' | 'resident';
    organizationId: string;
    isActive: boolean;
  };
}
```

**Error Response** (401 Unauthorized):
```typescript
{
  success: false;
  message: "Invalid username or password";
  code: "AUTH_INVALID_CREDENTIALS";
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
**Purpose**: Create new user with role-based permissions

**Request Body**:
```typescript
interface CreateUserRequest {
  username: string;        // Unique username (3-50 characters)
  email: string;          // Valid email address
  firstName: string;      // First name (1-100 characters)
  lastName: string;       // Last name (1-100 characters)
  role: 'admin' | 'manager' | 'tenant' | 'resident';
  organizationId: string; // Must be valid organization ID
  password: string;       // Min 8 characters, complexity requirements
  residenceId?: string;   // Required for tenant/resident roles
}
```

**Complete Implementation Example**:
```typescript
// Frontend: User creation with validation
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createUserSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().uuid('Invalid organization ID'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  residenceId: z.string().uuid().optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

// React Hook for user creation
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData: CreateUserFormData) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch users list
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });
}

// Form component usage
export function CreateUserForm() {
  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'resident',
      organizationId: '',
      password: '',
    },
  });
  
  const createUser = useCreateUser();
  
  const onSubmit = (data: CreateUserFormData) => {
    createUser.mutate(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields implementation */}
      </form>
    </Form>
  );
}
```

**Success Response**:
```typescript
{
  success: true;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
    isActive: boolean;
    createdAt: string;
  };
  message: "User created successfully";
}
```

**Validation Error Response** (400 Bad Request):
```typescript
{
  success: false;
  message: "Validation failed";
  errors: {
    username?: string[];
    email?: string[];
    password?: string[];
    // ... other field errors
  };
}
```

### PUT /api/users/:id
**Purpose**: Update user information

**Request Body**: Partial user object with fields to update

### DELETE /api/users/:id
**Purpose**: Deactivate user account

### POST /api/users/invite
**Purpose**: Send invitation to new user with role and residence assignment

**Request Body**:
```typescript
interface InviteUserRequest {
  email: string;           // Valid email address
  role: 'admin' | 'manager' | 'tenant' | 'resident';
  organizationId: string;  // Organization to invite user to
  residenceId?: string;    // Required for tenant/resident roles
  invitedBy: string;       // ID of user sending invitation
  message?: string;        // Optional personal message
  expiresAt?: string;      // Optional expiration date (ISO string)
}
```

**Advanced Implementation Example**:
```typescript
// Custom hook for invitation management
export function useInviteUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Get current user
  
  return useMutation({
    mutationFn: async (inviteData: Omit<InviteUserRequest, 'invitedBy'>) => {
      // Automatically add invitedBy from current user
      const payload: InviteUserRequest = {
        ...inviteData,
        invitedBy: user.id,
        expiresAt: inviteData.expiresAt || 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      };
      
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invitation');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });
}

// Invitation form with residence selection
export function InvitationForm() {
  const inviteUser = useInviteUser();
  const { data: residences } = useQuery({
    queryKey: ['/api/residences'],
    queryFn: () => fetch('/api/residences').then(res => res.json()),
  });
  
  const form = useForm<InviteUserRequest>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: '',
      role: 'resident',
      organizationId: user.organizationId,
      message: '',
    },
  });
  
  const selectedRole = form.watch('role');
  const needsResidence = selectedRole === 'tenant' || selectedRole === 'resident';
  
  const onSubmit = (data: InviteUserRequest) => {
    inviteUser.mutate(data, {
      onSuccess: () => {
        toast({
          title: 'Invitation sent',
          description: `Invitation sent to ${data.email}`,
        });
        form.reset();
      },
      onError: (error) => {
        toast({
          title: 'Failed to send invitation',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input {...field} type="email" placeholder="user@example.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {needsResidence && (
          <FormField
            control={form.control}
            name="residenceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Residence Assignment</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select residence" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {residences?.map((residence: any) => (
                      <SelectItem key={residence.id} value={residence.id}>
                        {residence.building.name} - Unit {residence.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Message (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  placeholder="Add a personal message to the invitation..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={inviteUser.isPending}>
          {inviteUser.isPending ? 'Sending...' : 'Send Invitation'}
        </Button>
      </form>
    </Form>
  );
}
```

**Success Response**:
```typescript
{
  success: true;
  invitation: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
    residenceId?: string;
    invitedBy: string;
    expiresAt: string;
    status: 'pending';
    createdAt: string;
  };
  message: "Invitation sent successfully";
}
```

**Error Responses**:
```typescript
// 409 Conflict - User already exists
{
  success: false;
  message: "User with this email already exists";
  code: "USER_EXISTS";
}

// 403 Forbidden - Insufficient permissions
{
  success: false;
  message: "Insufficient permissions to invite users with this role";
  code: "INSUFFICIENT_PERMISSIONS";
}

// 400 Bad Request - Invalid residence
{
  success: false;
  message: "Selected residence is not available or doesn't exist";
  code: "INVALID_RESIDENCE";
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