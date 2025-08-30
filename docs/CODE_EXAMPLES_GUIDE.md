# Comprehensive Code Examples Guide

This guide provides practical, real-world code examples for the Koveo Gestion application, demonstrating best practices, common patterns, and Quebec-specific implementations.

## Table of Contents

- [Authentication & Session Management](#authentication--session-management)
- [Form Handling with Validation](#form-handling-with-validation)
- [API Integration Patterns](#api-integration-patterns)
- [RBAC Implementation](#rbac-implementation)
- [Quebec Compliance Examples](#quebec-compliance-examples)
- [Database Operations](#database-operations)
- [UI Component Patterns](#ui-component-patterns)
- [Testing Examples](#testing-examples)

## Authentication & Session Management

### Complete Login Flow

```typescript
// hooks/use-auth.tsx - Authentication context and hooks
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/shared/schema';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Essential for session cookies
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if server logout fails
      setUser(null);
    }
  };

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Protected route component
export function ProtectedRoute({
  children,
  requiredRole
}: {
  children: React.ReactNode;
  requiredRole?: string;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${location}`} />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="text-center p-6">
        <h2 className="text-xl font-semibold text-red-600">Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

### Session Persistence and Security

```typescript
// server/middleware/auth.ts - Server-side session handling
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from '@/server/db';

const PgSession = connectPgSimple(session);

export const sessionConfig = {
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict',
  },
  name: 'koveo.sid', // Custom session name
};

// Auth middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }
  next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.session?.userRole;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
}
```

## Form Handling with Validation

### Advanced Form with Quebec Compliance

```typescript
// components/forms/OrganizationForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Quebec-specific validation schemas
const quebecPostalCode = z.string()
  .regex(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, 'Format de code postal invalide (ex: H1A 1A1)')
  .transform(val => val.replace(/\s/g, '').replace(/(.{3})(.{3})/, '$1 $2')); // Auto-format

const quebecPhoneNumber = z.string()
  .optional()
  .refine(val => !val || /^(\+1\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}$/.test(val), {
    message: 'Numéro de téléphone invalide (format canadien requis)',
  });

const organizationSchema = z.object({
  name: z.string()
    .min(1, 'Le nom de l\'organisation est requis')
    .max(200, 'Le nom ne peut pas dépasser 200 caractères'),
  type: z.enum(['normal', 'demo', 'koveo'], {
    errorMap: () => ({ message: 'Type d\'organisation requis' }),
  }),
  address: z.string()
    .min(1, 'L\'adresse est requise')
    .max(300, 'L\'adresse ne peut pas dépasser 300 caractères'),
  city: z.string()
    .min(1, 'La ville est requise')
    .max(100, 'Le nom de ville ne peut pas dépasser 100 caractères'),
  province: z.string().default('QC'),
  postalCode: quebecPostalCode,
  phone: quebecPhoneNumber,
  email: z.string()
    .email('Format d\'email invalide')
    .optional()
    .or(z.literal('')),
  website: z.string()
    .url('URL de site web invalide')
    .optional()
    .or(z.literal('')),
  registrationNumber: z.string()
    .optional()
    .refine(val => !val || val.length >= 5, {
      message: 'Numéro d\'enregistrement doit avoir au moins 5 caractères',
    }),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

export function OrganizationForm({
  organization,
  open,
  onOpenChange
}: {
  organization?: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { language } = useLanguage();

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization?.name || '',
      type: organization?.type || 'normal',
      address: organization?.address || '',
      city: organization?.city || '',
      province: organization?.province || 'QC',
      postalCode: organization?.postalCode || '',
      phone: organization?.phone || '',
      email: organization?.email || '',
      website: organization?.website || '',
      registrationNumber: organization?.registrationNumber || '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: OrganizationFormData) => {
      const url = organization ? `/api/organizations/${organization.id}` : '/api/organizations';
      const method = organization ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save organization');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({
        title: language === 'fr' ? 'Succès' : 'Success',
        description: language === 'fr'
          ? 'Organisation sauvegardée avec succès'
          : 'Organization saved successfully',
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: OrganizationFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {organization
              ? (language === 'fr' ? 'Modifier l\'organisation' : 'Edit Organization')
              : (language === 'fr' ? 'Nouvelle organisation' : 'New Organization')
            }
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      {language === 'fr' ? 'Nom de l\'organisation' : 'Organization Name'} *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={language === 'fr'
                          ? 'Syndicat de copropriété...'
                          : 'Condominium Association...'
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === 'fr' ? 'Type d\'organisation' : 'Organization Type'} *
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal">
                          {language === 'fr' ? 'Normale' : 'Normal'}
                        </SelectItem>
                        <SelectItem value="demo">
                          {language === 'fr' ? 'Démonstration' : 'Demo'}
                        </SelectItem>
                        <SelectItem value="koveo">Koveo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === 'fr' ? 'Numéro d\'enregistrement' : 'Registration Number'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={language === 'fr' ? 'NEQ ou autre...' : 'NEQ or other...'}
                      />
                    </FormControl>
                    <FormDescription>
                      {language === 'fr'
                        ? 'Numéro d\'entreprise du Québec (NEQ) ou autre numéro d\'enregistrement'
                        : 'Quebec Business Number (NEQ) or other registration number'
                      }
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address section with Quebec formatting */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {language === 'fr' ? 'Adresse' : 'Address'}
              </h3>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === 'fr' ? 'Adresse complète' : 'Street Address'} *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={language === 'fr'
                          ? '123 Rue de la Paix, Apt 4B'
                          : '123 Peace Street, Apt 4B'
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === 'fr' ? 'Ville' : 'City'} *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={language === 'fr' ? 'Montréal' : 'Montreal'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="QC">Québec (QC)</SelectItem>
                          <SelectItem value="ON">Ontario (ON)</SelectItem>
                          <SelectItem value="BC">British Columbia (BC)</SelectItem>
                          <SelectItem value="AB">Alberta (AB)</SelectItem>
                          {/* Add other provinces as needed */}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === 'fr' ? 'Code postal' : 'Postal Code'} *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="H1A 1A1"
                          onChange={(e) => {
                            // Auto-format postal code as user types
                            const value = e.target.value.toUpperCase();
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {language === 'fr' ? 'Coordonnées' : 'Contact Information'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === 'fr' ? 'Téléphone' : 'Phone'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="(514) 555-0123"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="contact@organization.ca"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === 'fr' ? 'Site web' : 'Website'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        placeholder="https://www.organization.ca"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? (language === 'fr' ? 'Sauvegarde...' : 'Saving...')
                  : (language === 'fr' ? 'Sauvegarder' : 'Save')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

## API Integration Patterns

### Type-Safe API Client

```typescript
// lib/api-client.ts - Centralized API client with error handling
import { toast } from '@/hooks/use-toast';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL = '') {
    this.baseURL = baseURL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || `HTTP ${response.status}`,
          response.status,
          data.code,
          data.details
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      throw new ApiError('Network error occurred', 0, 'NETWORK_ERROR', error);
    }
  }

  // Generic CRUD operations
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Specialized methods for common operations
  async login(username: string, password: string) {
    return this.post<{ user: User }>('/api/auth/login', {
      username,
      password,
    });
  }

  async logout() {
    return this.post('/api/auth/logout');
  }

  async getCurrentUser() {
    return this.get<User>('/api/auth/user');
  }

  // Organization operations
  async getOrganizations() {
    return this.get<{ organizations: Organization[] }>('/api/organizations');
  }

  async createOrganization(data: CreateOrganizationRequest) {
    return this.post<{ organization: Organization }>('/api/organizations', data);
  }

  async updateOrganization(id: string, data: UpdateOrganizationRequest) {
    return this.put<{ organization: Organization }>(`/api/organizations/${id}`, data);
  }

  // User operations with filtering
  async getUsers(filters?: {
    organizationId?: string;
    role?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const endpoint = `/api/users${params.toString() ? `?${params}` : ''}`;
    return this.get<{ users: User[]; total: number; page: number }>(endpoint);
  }

  async inviteUser(data: InviteUserRequest) {
    return this.post<{ invitation: Invitation }>('/api/users/invite', data);
  }

  // File upload with progress
  async uploadFile(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          const error = JSON.parse(xhr.responseText);
          reject(new ApiError(error.message, xhr.status, error.code));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new ApiError('Upload failed', 0, 'UPLOAD_ERROR'));
      });

      xhr.open('POST', `${this.baseURL}${endpoint}`);
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// React hooks for API operations
export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: ApiError) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
  }
) {
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (options?.showSuccessToast) {
        toast({
          title: 'Success',
          description: 'Operation completed successfully',
        });
      }
      options?.onSuccess?.(data);
    },
    onError: (error: ApiError) => {
      if (options?.showErrorToast !== false) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
      options?.onError?.(error);
    },
  });
}

// Usage examples
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useApiMutation((data: CreateOrganizationRequest) => apiClient.createOrganization(data), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
    },
    showSuccessToast: true,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();

  return useApiMutation((data: InviteUserRequest) => apiClient.inviteUser(data), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
    },
    showSuccessToast: true,
  });
}
```

This comprehensive guide provides practical examples for building robust, Quebec-compliant applications with proper error handling, validation, and user experience considerations.
