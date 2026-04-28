import React, { useState, useMemo, useEffect, useRef } from 'react';
import { logDebug, logError } from '@/lib/logger';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { FilterSort } from '@/components/filter-sort/FilterSort';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/lib/demo-error-handler';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useTableState } from '@/lib/common-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Users, UserPlus, Mail, Edit, Home, Trash2, Search } from 'lucide-react';
import { SendInvitationDialog } from '@/components/admin/send-invitation-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User, UserWithAssignments, Organization, Building, Residence } from '@shared/schema';
import type { FilterValue, SortValue } from '@/lib/filter-sort/types';
import { UserAssignmentsTable } from '@/components/UserAssignmentsTableClean';
import { UserOrganizationsTab } from '@/components/user-tabs/UserOrganizationsTab';
import { UserBuildingsTab } from '@/components/user-tabs/UserBuildingsTab';
import { UserResidencesTab } from '@/components/user-tabs/UserResidencesTab';
import { InvitationManagement } from '@/components/InvitationManagement';

// Form validation schema for editing users - dynamic based on available roles
const createEditUserSchema = (availableRoles: { value: string; label: string }[]) => {
  if (!availableRoles || !Array.isArray(availableRoles) || availableRoles.length === 0) {
    return z.object({
      firstName: z.string().min(1, 'First name is required (example: Jean)').max(50, 'First name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, apostrophes and hyphens'),
      lastName: z.string().min(1, 'Last name is required (example: Dupont)').max(50, 'Last name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, apostrophes and hyphens'),
      email: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: jean.dupont@email.com)'),
      role: z.string().min(1, 'Please select a user role'),
      isActive: z.boolean(),
    });
  }
  
  const roleValues = availableRoles.map(role => role.value) as [string, ...string[]];
  
  return z.object({
    firstName: z.string().min(1, 'First name is required (example: Jean)').max(50, 'First name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'First name can only contain letters, spaces, apostrophes and hyphens'),
    lastName: z.string().min(1, 'Last name is required (example: Dupont)').max(50, 'Last name must be less than 50 characters').regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Last name can only contain letters, spaces, apostrophes and hyphens'),
    email: z.string().min(1, 'Email address is required').email('Please enter a valid email address (example: jean.dupont@email.com)'),
    role: roleValues.length > 0 ? z.enum(roleValues) : z.string().min(1, 'Please select a user role'),
    isActive: z.boolean(),
  });
};

// Form validation schema for deleting users
const deleteUserSchema = z.object({
  confirmEmail: z.string().min(1, 'Email confirmation is required to delete user').email('Please enter a valid email address that matches the user account'),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
});

/**
 * User Management Page for Management Menu
 * Consolidates user management functionalities for managers and admins.
 * Provides comprehensive user administration with role-based access controls.
 */
export default function UserManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingUserOrganizations, setEditingUserOrganizations] = useState<UserWithAssignments | null>(null);
  const [editingUserResidences, setEditingUserResidences] = useState<UserWithAssignments | null>(null);
  const [showDeleteOrphansDialog, setShowDeleteOrphansDialog] = useState(false);

  // Component initialization logging
  useEffect(() => {
    logDebug('🔍 [USER_MANAGEMENT] Component mounted');
  }, []);

  // Cascading filter states for user edit tabs
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<string[]>([]);
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<string[]>([]);
  const [selectedResidenceAssignments, setSelectedResidenceAssignments] = useState<any[]>([]);
  
  // Track initialization to prevent re-initialization on unrelated renders
  const lastInitializedUserIdRef = useRef<string | null>(null);

  // Cascading unselection handlers - centralized with memoized lookups and functional setState
  const handleOrganizationSelectionChange = (newOrganizationIds: string[]) => {
    // Use functional setState to ensure consistent diff calculations
    setSelectedOrganizationIds(prevOrganizationIds => {
      // Find organizations that were unselected using the current state
      const unselectedOrganizationIds = prevOrganizationIds.filter(
        orgId => !newOrganizationIds.includes(orgId)
      );
      
      if (unselectedOrganizationIds.length > 0) {
        // Remove buildings that belong to unselected organizations using O(1) lookups
        const unselectedOrgSet = new Set(unselectedOrganizationIds);
        setSelectedBuildingIds(prevBuildingIds => 
          prevBuildingIds.filter(buildingId => {
            const building = buildingLookup.get(buildingId);
            // Keep unknowns to handle race conditions - only remove if building exists and is unselected
            return !building || !unselectedOrgSet.has(building.organizationId);
          })
        );
        
        // Remove residences that belong to buildings in unselected organizations using O(1) lookups
        setSelectedResidenceAssignments(prevResidences => 
          prevResidences.filter(assignment => {
            const residence = residenceLookup.get(assignment.residenceId);
            // Keep unknowns to handle race conditions - only remove if residence exists
            if (!residence) return true;
            
            const building = buildingLookup.get(residence.buildingId);
            // Keep unknowns to handle race conditions - only remove if building exists and is unselected
            return !building || !unselectedOrgSet.has(building.organizationId);
          })
        );
      }
      
      return newOrganizationIds;
    });
  };
  
  const handleBuildingSelectionChange = (newBuildingIds: string[]) => {
    // Use functional setState to ensure consistent diff calculations
    setSelectedBuildingIds(prevBuildingIds => {
      // Find buildings that were unselected using the current state
      const unselectedBuildingIds = prevBuildingIds.filter(
        buildingId => !newBuildingIds.includes(buildingId)
      );
      
      if (unselectedBuildingIds.length > 0) {
        // Remove residences that belong to unselected buildings using O(1) lookups
        const unselectedBuildingSet = new Set(unselectedBuildingIds);
        setSelectedResidenceAssignments(prevResidences => 
          prevResidences.filter(assignment => {
            const residence = residenceLookup.get(assignment.residenceId);
            // Keep unknowns to handle race conditions - only remove if residence exists and building is unselected
            return !residence || !unselectedBuildingSet.has(residence.buildingId);
          })
        );
      }
      
      return newBuildingIds;
    });
  };

  // Shared table state hook handles pagination and the search input
  // (resetting to page 1 whenever the search term changes).
  const usersPerPage = 10;
  const tableState = useTableState({ initialPageSize: usersPerPage });
  const {
    currentPage,
    setCurrentPage,
    searchTerm: searchInput,
    setSearchTerm: setSearchInput,
  } = tableState;

  // Filter state - the dropdown filters live alongside the table state
  // because they don't share useTableState's generic shape.
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [orphanFilter, setOrphanFilter] = useState('');

  // Debounced search value used for the actual API query.
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearch(searchInput);
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Fetch users with server-side pagination
  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery<{
    users: UserWithAssignments[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['/api/users', { 
      page: currentPage, 
      limit: usersPerPage,
      roleFilter,
      statusFilter,
      organizationFilter,
      orphanFilter,
      search
    }],
    queryFn: async () => {
      // Build query parameters including filters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: usersPerPage.toString(),
      });
      
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (organizationFilter) params.append('organization', organizationFilter);
      if (orphanFilter) params.append('orphan', orphanFilter);
      if (search) params.append('search', search);
      
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
  });

  // Extract users and pagination info from response.
  // `/api/users` always returns `{ users: UserWithAssignments[], pagination: … }`;
  // fall back to an empty array only if the response hasn't arrived yet.
  const users = usersResponse?.users ?? [];
  const paginationInfo = usersResponse?.pagination;

  // Fetch dynamic filter options
  const { data: filterOptions } = useQuery<{
    roles: Array<{ value: string; label: string; translationKey?: boolean }>;
    statuses: Array<{ value: string; label: string; translationKey?: boolean }>;
    organizations: Array<{ value: string; label: string; translationKey?: boolean }>;
    orphanOptions: Array<{ value: string; label: string; translationKey?: boolean }>;
  }>({
    queryKey: ['/api/users/filter-options'],
  });

  // Get current user to check permissions (must be before useEffect that uses it)
  const { data: currentUser, isLoading: currentUserLoading, error: currentUserError } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Debug logging for currentUser query
  useEffect(() => {
    logDebug('🔍 [USER_MANAGEMENT] Current user query status:', {
      currentUser: currentUser ? { id: currentUser.id, email: currentUser.email, role: currentUser.role } : null,
      isLoading: currentUserLoading,
      error: currentUserError,
    });
  }, [currentUser, currentUserLoading, currentUserError]);

  // Fetch organizations - ensure always an array
  const { data: organizationsData, isLoading: organizationsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations');
      const result = await response.json();
      logDebug('🏢 [USER_MANAGEMENT] /api/organizations returned:', {
        count: Array.isArray(result) ? result.length : 'not an array',
        data: result
      });
      return result as Organization[];
    },
    enabled: true,
  });
  const organizations = Array.isArray(organizationsData) ? organizationsData : [];
  
  // Debug log when organizations changes
  useEffect(() => {
    logDebug('🏢 [USER_MANAGEMENT] Organizations state updated:', {
      currentUser: currentUser?.email,
      currentUserRole: currentUser?.role,
      organizationsCount: organizations.length,
      organizationsLoading
    });
  }, [organizations.length, currentUser, organizationsLoading]);

  // Fetch buildings - ensure always an array
  const { data: buildingsData } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      const response = await fetch('/api/buildings', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch buildings: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: true,
  });
  const buildings = Array.isArray(buildingsData) ? buildingsData : [];

  // Fetch residences - ensure always an array
  const { data: residencesData } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
    queryFn: async () => {
      const response = await fetch('/api/residences', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch residences: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: true,
  });
  const residences = Array.isArray(residencesData) ? residencesData : [];

  // Fetch current user's organizations independently
  const { data: currentUserOrganizations, isLoading: orgsLoading, error: orgsError } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
    queryFn: async () => {
      const response = await fetch('/api/users/me/organizations', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch organizations: ${response.statusText}`);
      }
      const data = await response.json();
      logDebug('🔍 [QUERY] /api/users/me/organizations returned:', data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!currentUser,
    staleTime: 0, // Force fresh data
  });

  // Fetch current user's buildings independently
  const { data: currentUserBuildings, isLoading: buildingsLoading, error: buildingsError } = useQuery<Building[]>({
    queryKey: ['/api/users/me/buildings'],
    queryFn: async () => {
      const response = await fetch('/api/users/me/buildings', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch buildings: ${response.statusText}`);
      }
      const data = await response.json();
      logDebug('🔍 [QUERY] /api/users/me/buildings returned:', data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!currentUser,
    staleTime: 0, // Force fresh data
  });

  // Fetch current user's residences independently
  const { data: currentUserResidences, isLoading: residencesLoading, error: residencesError } = useQuery<Residence[]>({
    queryKey: ['/api/users/me/residences'],
    queryFn: async () => {
      const response = await fetch('/api/users/me/residences', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch residences: ${response.statusText}`);
      }
      const data = await response.json();
      logDebug('🔍 [QUERY] /api/users/me/residences returned:', data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!currentUser,
    staleTime: 0, // Force fresh data
  });

  // Debug logging for all assignment queries
  useEffect(() => {
    logDebug('🔍 [USER_MANAGEMENT] Assignment queries data received:', {
      organizations: currentUserOrganizations ? `${currentUserOrganizations.length} orgs` : 'null',
      buildings: currentUserBuildings ? `${currentUserBuildings.length} buildings` : 'null',
      residences: currentUserResidences ? `${currentUserResidences.length} residences` : 'null',
      orgsLoading,
      buildingsLoading,
      residencesLoading,
      orgsError: orgsError?.message,
      buildingsError: buildingsError?.message,
      residencesError: residencesError?.message,
    });
  }, [currentUserOrganizations, currentUserBuildings, currentUserResidences, orgsLoading, buildingsLoading, residencesLoading, orgsError, buildingsError, residencesError]);

  // Debug logging for current user assignment queries
  useEffect(() => {
    logDebug('🔍 [USER_MANAGEMENT] Current user assignment queries status:', {
      currentUser: currentUser?.email,
      orgsLoading,
      buildingsLoading,
      residencesLoading,
      orgsError: orgsError?.message,
      buildingsError: buildingsError?.message,
      residencesError: residencesError?.message,
      currentUserOrganizations: currentUserOrganizations?.length,
      currentUserBuildings: currentUserBuildings?.length,
      currentUserResidences: currentUserResidences?.length
    });
  }, [currentUser, orgsLoading, buildingsLoading, residencesLoading, orgsError, buildingsError, residencesError, currentUserOrganizations, currentUserBuildings, currentUserResidences]);

  // Memoized lookup maps for O(1) performance
  const buildingLookup = useMemo(() => {
    if (!buildings || !Array.isArray(buildings)) return new Map();
    return new Map(buildings.map(building => [building.id, building]));
  }, [buildings]);

  const residenceLookup = useMemo(() => {
    if (!residences || !Array.isArray(residences)) return new Map();
    return new Map(residences.map(residence => [residence.id, residence]));
  }, [residences]);

  const organizationLookup = useMemo(() => {
    if (!organizations || !Array.isArray(organizations)) return new Map();
    return new Map(organizations.map(org => [org.id, org]));
  }, [organizations]);

  // Organization context detection for role filtering
  const userOrganizationContext = useMemo(() => {
    if (!currentUser || !organizations || !Array.isArray(organizations)) return null;

    // Get current user's organization assignments - if not in current page, we'll skip for admin
    const currentUserWithAssignments = users.find(u => u.id === currentUser.id);
    if (!currentUserWithAssignments?.organizations) {
      // For admin users, we don't need organization context to assign roles
      if (currentUser.role === 'admin') {
        return {
          isDemoUser: false,
          hasDemoOrganizations: false,
          hasRegularOrganizations: true,
          userOrganizations: [],
          organizationTypes: []
        };
      }
      return null;
    }

    const userOrganizations = currentUserWithAssignments.organizations;
    if (!Array.isArray(userOrganizations)) return null;
    
    const isDemoUser = ['demo_manager', 'demo_tenant', 'demo_resident'].includes(currentUser.role);
    const hasDemoOrganizations = userOrganizations.some(org => 
      organizations.find(o => o.id === org.id)?.type === 'demo'
    );
    const hasRegularOrganizations = userOrganizations.some(org => 
      organizations.find(o => o.id === org.id)?.type !== 'demo'
    );

    return {
      isDemoUser,
      hasDemoOrganizations,
      hasRegularOrganizations,
      userOrganizations: userOrganizations.map(org => org.id),
      organizationTypes: userOrganizations.map(org => 
        organizations.find(o => o.id === org.id)?.type || 'unknown'
      )
    };
  }, [currentUser, organizations, users]);

  // Role filtering function
  const getAvailableRoles = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    const { role } = currentUser;

    // Admin can assign any role regardless of organization context
    if (role === 'admin') {
      return [
        { value: 'admin', label: 'Admin' },
        { value: 'manager', label: 'Manager' },
        { value: 'tenant', label: 'Tenant' },
        { value: 'resident', label: 'Resident' },
        { value: 'demo_manager', label: 'Demo Manager' },
        { value: 'demo_tenant', label: 'Demo Tenant' },
        { value: 'demo_resident', label: 'Demo Resident' },
      ];
    }

    // For non-admin users, we need organization context
    if (!userOrganizationContext) {
      return [];
    }

    const { isDemoUser, hasDemoOrganizations, hasRegularOrganizations } = userOrganizationContext;

    // Manager role assignment restrictions
    if (role === 'manager') {
      // Check if editing user has demo organizations
      if (editingUser) {
        const editingUserWithAssignments = users.find(u => u.id === editingUser.id);
        if (editingUserWithAssignments?.organizations && Array.isArray(editingUserWithAssignments.organizations)) {
          const editingUserHasDemoOrgs = editingUserWithAssignments.organizations.some(org => {
            const orgId = typeof org === 'string' ? org : org.id;
            return organizations.find(o => o.id === orgId)?.type === 'demo';
          });
          
          if (editingUserHasDemoOrgs) {
            return [
              { value: 'manager', label: 'Manager' },
              { value: 'tenant', label: 'Tenant' },
              { value: 'resident', label: 'Resident' },
              { value: 'demo_manager', label: 'Demo Manager' },
              { value: 'demo_tenant', label: 'Demo Tenant' },
              { value: 'demo_resident', label: 'Demo Resident' },
            ];
          }
        }
      }
      
      return [
        { value: 'manager', label: 'Manager' },
        { value: 'tenant', label: 'Tenant' },
        { value: 'resident', label: 'Resident' },
      ];
    }

    // Demo manager role assignment restrictions
    if (role === 'demo_manager') {
      return [
        { value: 'demo_manager', label: 'Demo Manager' },
        { value: 'demo_tenant', label: 'Demo Tenant' },
        { value: 'demo_resident', label: 'Demo Resident' },
      ];
    }

    // Other roles cannot assign roles
    return [];
  }, [currentUser, userOrganizationContext, editingUser, users, organizations]);

  // Dynamic edit user schema based on available roles
  const editUserSchema = useMemo(() => {
    // Ensure we always pass an array to createEditUserSchema
    const rolesArray = Array.isArray(getAvailableRoles) ? getAvailableRoles : [];
    return createEditUserSchema(rolesArray);
  }, [getAvailableRoles]);

  // Bulk action handler
  // Exception (task #229): mutations in this file route errors through
  // `handleApiError` for demo-mode/locale-aware messaging and special cases,
  // which `useCreateUpdateMutation` cannot model — kept as raw `useMutation`.
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: Record<string, unknown> }) => {
      const selectedUserIds = Array.from(selectedUsers);
      const response = await apiRequest('POST', '/api/users/bulk-action', {
        action,
        userIds: selectedUserIds,
        data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('userUpdatedSuccess'),
      });
      setSelectedUsers(new Set());
      // Invalidate all user queries regardless of filters
      queryClient.invalidateQueries({ queryKey: ['/api/users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/users/filter-options'], exact: false });
    },
    onError: (_error: Error) => {
      handleApiError(
        _error,
        language,
        language === 'fr' ? 'Échec de l\'action groupée sur les utilisateurs' : 'Failed to perform bulk user action'
      );
    },
  });

  const handleBulkAction = async (action: string, data?: Record<string, unknown>) => {
    await bulkActionMutation.mutateAsync({ action, data });
  };

  // Flag to track if we're in unified save mode to prevent race conditions
  const [isUnifiedSaving, setIsUnifiedSaving] = useState(false);

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof editUserSchema> & { id: string }) => {
      const response = await apiRequest('PUT', `/api/users/${userData.id}`, userData);
      return response.json();
    },
    onSuccess: async () => {
      
      // Only invalidate cache if NOT part of unified save to prevent race conditions
      if (!isUnifiedSaving) {
        await queryClient.removeQueries({ queryKey: ['/api/users'], exact: false });
        await queryClient.invalidateQueries({ queryKey: ['/api/users'], exact: false });
        await queryClient.invalidateQueries({ queryKey: ['/api/users/filter-options'], exact: false });
        
        toast({
          title: t('success'),
          description: t('userUpdatedSuccess'),
        });
        
        // Close dialog after successful update
        setEditingUser(null);
      } else {
      }
    },
    onError: (error: Error) => {
      logError('❌ [editUserMutation] User update failed:', error);
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour du profil utilisateur' : 'Failed to update user profile'
      );
    },
  });

  // Edit user form
  const editForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: 'tenant',
      isActive: true,
    },
  });

  // Delete user form
  const deleteForm = useForm<z.infer<typeof deleteUserSchema>>({
    resolver: zodResolver(deleteUserSchema),
    defaultValues: {
      confirmEmail: '',
      reason: '',
    },
  });

  // Helper function to decode HTML entities
  const decodeHtmlEntities = (str: string): string => {
    if (!str) return str;
    
    // Named entities map
    const namedEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'"
    };
    
    return str
      // First decode named entities
      .replace(/&(?:amp|lt|gt|quot|apos);/g, (match) => namedEntities[match] || match)
      // Then decode decimal numeric entities (&#39;)
      .replace(/&#(\d+);/g, (match, num) => {
        const code = parseInt(num, 10);
        return code > 0 && code < 1114112 ? String.fromCharCode(code) : match;
      })
      // Finally decode hexadecimal numeric entities (&#x27;)
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        const code = parseInt(hex, 16);
        return code > 0 && code < 1114112 ? String.fromCharCode(code) : match;
      });
  };

  // Reset form when editing user changes
  useEffect(() => {
    if (editingUser) {
      editForm.reset({
        firstName: decodeHtmlEntities(editingUser.firstName || ''),
        lastName: decodeHtmlEntities(editingUser.lastName || ''),
        email: editingUser.email,
        role: editingUser.role,
        isActive: editingUser.isActive,
      });
    }
  }, [editingUser]);

  // Reset delete form when deleting user changes
  useEffect(() => {
    if (deletingUser) {
      deleteForm.reset({
        confirmEmail: '',
        reason: '',
      });
    }
  }, [deletingUser]);

  // Reset to page 1 when filters change (excluding search since it's disabled)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [roleFilter, statusFilter, organizationFilter, orphanFilter]);

  // Get current user's access information for role-based filtering
  const currentUserAccess = useMemo(() => {
    logDebug('🔍 [USER_MANAGEMENT] Computing currentUserAccess memo:', {
      currentUser: currentUser?.email,
      currentUserOrganizationsType: typeof currentUserOrganizations,
      currentUserOrganizationsIsArray: Array.isArray(currentUserOrganizations),
      currentUserOrganizationsLength: Array.isArray(currentUserOrganizations) ? currentUserOrganizations.length : 'N/A',
      currentUserBuildingsType: typeof currentUserBuildings,
      currentUserBuildingsIsArray: Array.isArray(currentUserBuildings),
      currentUserBuildingsLength: Array.isArray(currentUserBuildings) ? currentUserBuildings.length : 'N/A',
      currentUserResidencesType: typeof currentUserResidences,
      currentUserResidencesIsArray: Array.isArray(currentUserResidences),
      currentUserResidencesLength: Array.isArray(currentUserResidences) ? currentUserResidences.length : 'N/A',
      orgsLoading,
      buildingsLoading,
      residencesLoading
    });

    if (!currentUser) {
      logDebug('❌ [USER_MANAGEMENT] No current user, returning empty access');
      return {
        organizationIds: [],
        buildingIds: [],
        residenceIds: []
      };
    }

    // Extract organization IDs from current user's organizations
    // Ensure we have an array and it has data
    const organizationIds = Array.isArray(currentUserOrganizations) && currentUserOrganizations.length > 0
      ? currentUserOrganizations.map((org: any) => org.id).filter((id): id is string => !!id)
      : [];

    // Extract building IDs from current user's buildings
    const buildingIds = Array.isArray(currentUserBuildings) && currentUserBuildings.length > 0
      ? currentUserBuildings.map((building: any) => building.id).filter((id): id is string => !!id)
      : [];

    // Extract residence IDs from current user's residences
    const residenceIds = Array.isArray(currentUserResidences) && currentUserResidences.length > 0
      ? currentUserResidences.map((residence: any) => residence.id).filter((id): id is string => !!id)
      : [];

    logDebug('✅ [USER_MANAGEMENT] Extracted access IDs:', {
      organizationIds,
      buildingIds,
      residenceIds,
      organizationIdsCount: organizationIds.length,
      buildingIdsCount: buildingIds.length,
      residenceIdsCount: residenceIds.length
    });

    return {
      organizationIds,
      buildingIds,
      residenceIds
    };
  }, [currentUser, currentUserOrganizations, currentUserBuildings, currentUserResidences, orgsLoading, buildingsLoading, residencesLoading]);

  // Initialize states ONCE per user when dialog opens - guard against re-initialization
  useEffect(() => {
    if (editingUser && editingUser.id !== lastInitializedUserIdRef.current) {
      // Only initialize once per user - prevent re-initialization on unrelated renders
      const userWithAssignments = findUserWithAssignments(editingUser.id);
      
      if (userWithAssignments) {
        let currentOrgIds = Array.isArray(userWithAssignments.organizations) 
          ? userWithAssignments.organizations.map((org: any) => org.id) 
          : [];
        
        // For managers: if user has no organizations assigned yet, pre-select the manager's organizations
        // This allows managers to assign buildings and residences within their scope
        const isManager = currentUser?.role === 'manager' || currentUser?.role === 'demo_manager';
        if (isManager && currentOrgIds.length === 0 && currentUserAccess.organizationIds.length > 0) {
          currentOrgIds = currentUserAccess.organizationIds;
        }
        
        const currentBuildingIds = Array.isArray(userWithAssignments.buildings) 
          ? userWithAssignments.buildings.map((building: any) => building.id) 
          : [];
        const currentResidenceAssignments = Array.isArray(userWithAssignments.residences) 
          ? userWithAssignments.residences.map((residence: any) => ({
            residenceId: residence.id,
            relationshipType: residence.relationshipType || 'tenant',
            startDate: new Date().toISOString().split('T')[0],
            endDate: null,
            isActive: true
          }))
          : [];
        
        setSelectedOrganizationIds(currentOrgIds);
        setSelectedBuildingIds(currentBuildingIds);
        setSelectedResidenceAssignments(currentResidenceAssignments);
        lastInitializedUserIdRef.current = editingUser.id;
      }
    } else if (!editingUser) {
      // Reset states when dialog closes
      setSelectedOrganizationIds([]);
      setSelectedBuildingIds([]);
      setSelectedResidenceAssignments([]);
      lastInitializedUserIdRef.current = null;
    }
  }, [editingUser?.id, currentUser, currentUserAccess.organizationIds]);

  // Helper function to provide user-friendly error messages
  const getErrorMessage = (error: Error, context: string = '') => {
    const message = error.message.toLowerCase();
    
    // Demo user specific restrictions
    if (message.includes('demo') && message.includes('restrict')) {
      return `Demo users have limited permissions. ${context ? `For ${context}, ` : ''}please contact an administrator for full access.`;
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return `You don't have permission to perform this action. ${context ? `For ${context}, ` : ''}please contact your manager or administrator.`;
    }
    
    if (message.includes('not found')) {
      return `The requested ${context || 'resource'} could not be found. It may have been deleted or you may not have access to it.`;
    }
    
    if (message.includes('already exists') || message.includes('duplicate')) {
      return `This ${context || 'item'} already exists. Please check your selection and try again.`;
    }
    
    // For validation errors, make them more user-friendly
    if (message.includes('validation') || message.includes('invalid')) {
      return `Please check your input and make sure all required fields are filled correctly.`;
    }
    
    // Default to original message if no specific patterns match
    return error.message;
  };

  const handleEditUser = async (values: z.infer<typeof editUserSchema>) => {
    if (!editingUser) {
      return;
    }
    
    try {
      await editUserMutation.mutateAsync({ ...values, id: editingUser.id });
      
      
      // CRITICAL: Same cache invalidation as unified save
      await queryClient.removeQueries({ queryKey: ['/api/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      await queryClient.refetchQueries({ queryKey: ['/api/users'] });
      
      
      toast({
        title: "Success",
        description: "User information updated successfully"
      });
    } catch (error) {
      logError('❌ [handleEditUser] Error saving user:', error);
      toast({
        title: "Error",
        description: "Failed to update user information",
        variant: "destructive"
      });
    }
  };

  // Unified save function that saves all user data at once
  const handleUnifiedSave = async () => {
    if (!editingUser) {
      return;
    }


    // Apply cascade filtering before saving
    // Filter buildings: only include buildings that belong to selected organizations
    const filteredBuildingIds = selectedBuildingIds.filter(buildingId => {
      const building = buildingLookup.get(buildingId);
      return building && selectedOrganizationIds.includes(building.organizationId);
    });

    // Filter residences: only include residences that belong to filtered buildings
    const filteredResidenceAssignments = selectedResidenceAssignments.filter(assignment => {
      const residence = residenceLookup.get(assignment.residenceId);
      return residence && filteredBuildingIds.includes(residence.buildingId);
    });


    try {
      // Set unified saving flag to prevent individual cache invalidations
      setIsUnifiedSaving(true);
      
      // Get form values for basic info
      const formValues = editForm.getValues();
      
      // Save all data sequentially to ensure consistency
      await editUserMutation.mutateAsync({ ...formValues, id: editingUser.id });
      
      // Always save organization assignments (even if empty to clear them)
      if (canEditOrganizations) {
        await editOrganizationsMutation.mutateAsync({
          userId: editingUser.id,
          organizationIds: selectedOrganizationIds
        });
      }
      
      // Always save building assignments (even if empty to clear them)
      // Use filtered building IDs to respect cascade logic
      await editBuildingsMutation.mutateAsync({
        userId: editingUser.id,
        buildingIds: filteredBuildingIds
      });
      
      // Always save residence assignments (even if empty to clear them)
      // Use filtered residence assignments to respect cascade logic
      if (canEditResidences) {
        await editResidencesMutation.mutateAsync({
          userId: editingUser.id,
          residenceAssignments: filteredResidenceAssignments
        });
      }


      // Show success message
      toast({
        title: t('success'),
        description: 'All user information and assignments saved successfully',
      });

      // Allow database to achieve consistency after multiple mutations
      await new Promise(resolve => setTimeout(resolve, 200));
      
      
      // Comprehensive cache invalidation to ensure UI updates
      // Remove all cached queries first for immediate effect
      queryClient.removeQueries({ queryKey: ['/api/users'], exact: false });
      queryClient.removeQueries({ queryKey: ['/api/users/filter-options'], exact: false });
      queryClient.removeQueries({ queryKey: ['/api/organizations'], exact: false });
      queryClient.removeQueries({ queryKey: ['/api/buildings'], exact: false });
      queryClient.removeQueries({ queryKey: ['/api/residences'], exact: false });
      queryClient.removeQueries({ queryKey: ['/api/admin/all-user-organizations'], exact: false });
      queryClient.removeQueries({ queryKey: ['/api/admin/all-user-residences'], exact: false });
      
      
      // Force immediate refetch to update the table
      await queryClient.invalidateQueries({ queryKey: ['/api/users'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['/api/users/filter-options'], exact: false });
      
      
      // Close dialog after successful save and cache invalidation
      setEditingUser(null);
      
      
    } catch (error) {
      logError('❌ [Unified Save] Unified save failed:', error);
      toast({
        title: t('error'), 
        description: 'Failed to save all changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      // Always reset the unified saving flag
      setIsUnifiedSaving(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
  };

  // Helper function to find UserWithAssignments from the users list
  const findUserWithAssignments = (userId: string): UserWithAssignments | null => {
    return users.find(u => u.id === userId) || null;
  };

  const openDeleteDialog = (user: User) => {
    setDeletingUser(user);
  };

  const handleDeleteUser = async (values: z.infer<typeof deleteUserSchema>) => {
    if (!deletingUser) {
      return;
    }
    await deleteUserMutation.mutateAsync({ userId: deletingUser.id, data: values });
  };

  // Organization editing mutation
  const editOrganizationsMutation = useMutation({
    mutationFn: async ({
      userId,
      organizationIds,
    }: {
      userId: string;
      organizationIds: string[];
    }) => {
      const response = await apiRequest('PUT', `/api/users/${userId}/organizations`, {
        organizationIds,
      });
      return response.json();
    },
    onSuccess: async () => {
      
      // Only invalidate cache if NOT part of unified save to prevent race conditions
      if (!isUnifiedSaving) {
        await queryClient.removeQueries({ queryKey: ['/api/users'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        await queryClient.refetchQueries({ queryKey: ['/api/users'] });
        
        toast({
          title: t('success'),
          description: t('organizationAssignmentsUpdated'),
        });
        
        if (editingUserOrganizations) {
          setEditingUserOrganizations(null);
        }
      } else {
      }
    },
    onError: (error: Error) => {
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour des affectations d\'organisation' : 'Failed to update organization assignments'
      );
    },
  });

  // Building editing mutation
  const editBuildingsMutation = useMutation({
    mutationFn: async ({
      userId,
      buildingIds,
    }: {
      userId: string;
      buildingIds: string[];
    }) => {
      const response = await apiRequest('PUT', `/api/users/${userId}/buildings`, {
        buildingIds,
      });
      return response.json();
    },
    onSuccess: async () => {
      
      // Only invalidate cache if NOT part of unified save to prevent race conditions
      if (!isUnifiedSaving) {
        await queryClient.removeQueries({ queryKey: ['/api/users'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        await queryClient.refetchQueries({ queryKey: ['/api/users'] });
        
        toast({
          title: t('success'),
          description: t('buildingAssignmentsUpdated'),
        });
      } else {
      }
    },
    onError: (error: Error) => {
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour des affectations de bâtiment' : 'Failed to update building assignments'
      );
    },
  });

  // Residence editing mutation
  const editResidencesMutation = useMutation({
    mutationFn: async ({
      userId,
      residenceAssignments,
    }: {
      userId: string;
      residenceAssignments: any[];
    }) => {
      const response = await apiRequest('PUT', `/api/users/${userId}/residences`, {
        residenceAssignments,
      });
      return response.json();
    },
    onSuccess: async () => {
      
      // Only invalidate cache if NOT part of unified save to prevent race conditions
      if (!isUnifiedSaving) {
        await queryClient.removeQueries({ queryKey: ['/api/users'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
        await queryClient.refetchQueries({ queryKey: ['/api/users'] });
        
        toast({
          title: t('success'),
          description: t('residenceAssignmentsUpdated'),
        });
        
        if (editingUserResidences) {
          setEditingUserResidences(null);
        }
      } else {
      }
    },
    onError: (error: Error) => {
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour des affectations de résidence' : 'Failed to update residence assignments'
      );
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: z.infer<typeof deleteUserSchema>;
    }) => {
      const response = await apiRequest('POST', `/api/users/${userId}/delete-account`, data);
      return response.json();
    },
    onMutate: async ({ userId }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['/api/users'] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData(['/api/users', { 
        page: currentPage, 
        limit: usersPerPage,
        roleFilter,
        statusFilter,
        organizationFilter,
        orphanFilter,
        search
      }]);

      // Optimistically update to remove the user from the cache
      queryClient.setQueryData(['/api/users', { 
        page: currentPage, 
        limit: usersPerPage,
        roleFilter,
        statusFilter,
        organizationFilter,
        orphanFilter,
        search
      }], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.filter((user: any) => user.id !== userId),
          pagination: {
            ...old.pagination,
            total: Math.max(0, old.pagination.total - 1)
          }
        };
      });

      // Return a context object with the snapshotted value
      return { previousUsers };
    },
    onSuccess: () => {
      toast({
        title: t('accountDeleted'),
        description: t('accountDeletedDescription'),
      });
      setDeletingUser(null);
      // Invalidate and refetch user data to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/users/filter-options'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-user-residences'] });
      // Force refetch to update the table immediately
      queryClient.refetchQueries({ queryKey: ['/api/users'], exact: false });
    },
    onError: (error: Error, variables, context) => {
      // If the mutation fails, restore the previous data
      if (context?.previousUsers) {
        queryClient.setQueryData(['/api/users', { 
          page: currentPage, 
          limit: usersPerPage,
          roleFilter,
          statusFilter,
          organizationFilter,
          orphanFilter,
          search
        }], context.previousUsers);
      }
      
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la suppression de l\'utilisateur' : 'Failed to delete user'
      );
    },
  });

  // Permission checks
  const canEditOrganizations = useMemo(() => {
    if (!currentUser) return false;
    // Only show organizations tab if user has access to multiple organizations
    if (currentUser.role === 'admin') return true;
    // For managers and demo_managers, only show if they have access to multiple organizations
    return currentUserAccess.organizationIds.length > 1;
  }, [currentUser, currentUserAccess.organizationIds]);
  
  const canEditResidences = currentUser?.role === 'admin' || 
                           currentUser?.role === 'manager' || 
                           currentUser?.role === 'demo_manager';
  const canDeleteUsers = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Filter configuration - temporarily simplified
  // const filterConfig = {
  //   searchable: true,
  //   searchFields: ['firstName', 'lastName', 'email', 'username'],
  //   filters: [
  //     {
  //       id: 'role',
  //       field: 'role',
  //       label: 'Role',
  //       type: 'select' as const,
  //       options: [
  //         { label: 'Admin', _value: 'admin' },
  //         { label: 'Manager', _value: 'manager' },
  //         { label: 'Tenant', _value: 'tenant' },
  //         { label: 'Resident', _value: 'resident' },
  //         { label: 'Demo Manager', _value: 'demo_manager' },
  //         { label: 'Demo Tenant', _value: 'demo_tenant' },
  //         { label: 'Demo Resident', _value: 'demo_resident' },
  //       ],
  //     },
  //     {
  //       id: 'isActive',
  //       field: 'isActive',
  //       label: 'Status',
  //       type: 'select' as const,
  //       options: [
  //         { label: 'Active', _value: 'true' },
  //         { label: 'Inactive', _value: 'false' },
  //       ],
  //     },
  //     {
  //       id: 'organization',
  //       field: 'organization',
  //       label: 'Organization',
  //       type: 'select' as const,
  //       options: organizations?.map((org) => ({ label: org.name, _value: org.id })) || [],
  //     },
  //   ],
  //   sortOptions: [
  //     { field: 'firstName', label: 'First Name' },
  //     { field: 'lastName', label: 'Last Name' },
  //     { field: 'email', label: 'Email' },
  //     { field: 'role', label: 'Role' },
  //     { field: 'createdAt', label: 'Created Date' },
  //   ],
  // };





  // Use server-side paginated results directly
  // Server-side filtering is fully implemented (role, status, organization, orphan, search)
  const filteredUsers = users;

  // Filter handlers - temporarily disabled
  // const handleAddFilter = (filter: FilterValue) => {
  //   setFilters((prev) => [...prev.filter((f) => f.field !== filter.field), filter]);
  // };

  // const handleRemoveFilter = (field: string) => {
  //   setFilters((prev) => prev.filter((f) => f.field !== field));
  // };

  // const handleFilterUpdate = (field: string, filter: FilterValue) => {
  //   setFilters((prev) => prev.map((f) => (f.field === field ? filter : f)));
  // };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    // Don't clear organization filter for managers with only 1 organization or demo_manager
    const shouldKeepOrgFilter = 
      currentUser?.role === 'demo_manager' || 
      ((currentUser?.role === 'manager') && currentUserOrganizations && currentUserOrganizations.length === 1);
    
    if (!shouldKeepOrgFilter) {
      setOrganizationFilter('');
    }
    setOrphanFilter('');
  };

  // Clear orphan filter when organization is selected
  useEffect(() => {
    if (organizationFilter) {
      setOrphanFilter('');
    }
  }, [organizationFilter]);

  // Pre-filter for managers: automatically set organization filter based on their organizations
  useEffect(() => {
    if (!currentUser || !currentUserOrganizations || currentUserOrganizations.length === 0) {
      return;
    }

    // Only apply pre-filtering for manager and demo_manager roles
    const isManagerRole = currentUser.role === 'manager' || currentUser.role === 'demo_manager';
    if (!isManagerRole) {
      return;
    }

    // If manager has exactly 1 organization, pre-filter to that organization
    if (currentUserOrganizations.length === 1) {
      const orgId = currentUserOrganizations[0].id;
      if (organizationFilter !== orgId) {
        logDebug(`🔍 [USER_MANAGEMENT] Pre-filtering manager to their organization: ${orgId}`);
        setOrganizationFilter(orgId);
      }
    }
  }, [currentUser, currentUserOrganizations]);

  // Delete orphan users mutation (admin only)
  const deleteOrphanUsersMutation = useMutation({
    mutationFn: async () => {
      
      const response = await fetch('/api/users/orphans', {
        method: 'DELETE',
      });
      
      
      if (!response.ok) {
        const error = await response.json();
        logError('❌ [FRONTEND] API Error response:', error);
        throw new Error(error.error || 'Failed to delete orphan users');
      }
      
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: data.message || `Deleted ${data.deletedCount} orphan users`,
      });
      
      // Refresh the users list
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowDeleteOrphansDialog(false);
    },
    onError: (error) => {
      logError('💥 [FRONTEND] Delete orphans mutation failed:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error instanceof Error ? error : new Error('Failed to delete orphan users'), 'orphan user deletion'),
        variant: 'destructive',
      });
    },
  });

  // Handle delete orphan users
  const handleDeleteOrphanUsers = () => {
    // Delete orphans button clicked - triggering delete for user
    deleteOrphanUsersMutation.mutate();
  };

  // const handleToggleSort = (field: string) => {
  //   if (sort?.field === field) {
  //     setSort({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
  //   } else {
  //     setSort({ field, direction: 'asc' });
  //   }
  // };

  // Calculate stats using server-side pagination data
  const totalUsers = paginationInfo?.total || 0;
  const filteredTotal = filteredUsers.length;
  
  // Calculate stats based on current page results when filters are applied
  const hasActiveFilters = roleFilter || statusFilter || organizationFilter || orphanFilter;
  
  // If filters are applied, show stats for current visible users, otherwise show total stats
  const displayedActiveUsers = hasActiveFilters 
    ? users?.filter((user: User) => user.isActive).length || 0
    : totalUsers > 0 ? Math.floor(totalUsers * 0.85) : 0; // Estimate 85% active when no filters
    
  const displayedTotalUsers = hasActiveFilters ? `~${users.length}` : totalUsers;

  // Use server-side pagination calculations
  const totalPages = paginationInfo?.totalPages || 1;
  const hasNext = paginationInfo?.hasNext || false;
  const hasPrev = paginationInfo?.hasPrev || false;
  
  // For display, use filteredUsers (which may be less than the page size if filters are applied)
  const currentUsers = filteredUsers;

  if (usersError) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={t('userManagement')} subtitle={t('userManagementSubtitle')} />
        <div className='flex-1 overflow-auto p-6'>
          <Card>
            <CardContent className='p-6'>
              <p className='text-red-600'>{t('anErrorOccurred')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('userManagement')} subtitle={t('userManagementSubtitle')} />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
        {/* Quick Stats Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>{t('totalUsers')}</CardTitle>
              <Users className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{displayedTotalUsers}</div>
              <p className='text-xs text-muted-foreground'>{hasActiveFilters ? t('filtered') || 'Filtered' : t('total')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium text-gray-600'>{t('activeUsers')}</CardTitle>
              <UserPlus className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{displayedActiveUsers}</div>
              <p className='text-xs text-muted-foreground'>{hasActiveFilters ? t('onThisPage') || 'On this page' : t('active')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main User Management Tabs */}
        <Tabs defaultValue='users' className='space-y-6'>
          <div className='flex items-center justify-between'>
            <TabsList>
              <TabsTrigger value='users' className='flex items-center gap-2'>
                <Users className='h-4 w-4' />
                {t('users')}
              </TabsTrigger>
              <TabsTrigger value='invitations' className='flex items-center gap-2'>
                <Mail className='h-4 w-4' />
                {t('invitations')}
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={() => setShowInviteDialog(true)}
                      disabled={currentUser?.role === 'demo_manager'}
                      data-testid="button-invite-user"
                      data-onboarding="invitations.new-btn"
                    >
                      <UserPlus className='h-4 w-4 mr-2' />
                      {t('inviteUser')}
                    </Button>
                  </TooltipTrigger>
                  {currentUser?.role === 'demo_manager' && (
                    <TooltipContent>
                      <p>{t('userInvitationsNotAvailableDemo')}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              
              {/* Admin-only: Delete Orphan Users button */}
              {currentUser?.role === 'admin' && (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteOrphansDialog(true)}
                  data-testid="button-delete-orphans"
                >
                  <Trash2 className='h-4 w-4 mr-2' />
                  {t('deleteOrphanUsers')}
                </Button>
              )}
            </div>
          </div>

          <TabsContent value='users' className='space-y-6'>
            <Card>
              <CardContent className='p-6'>
                {usersLoading ? (
                  <p>{t('loadingUsers') || 'Loading users...'}</p>
                ) : (
                  <div className='space-y-4'>
                    {/* Simple Search and Filters */}
                    <div className='flex items-center gap-4 flex-wrap mb-4'>
                      {/* Search Input */}
                      <div className='relative flex-1 max-w-sm'>
                        <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
                        <Input
                          placeholder={t('searchUsers')}
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className='pl-10'
                          data-testid='search-users'
                        />
                      </div>

                      {/* Role Filter */}
                      <SearchableSelect
                        value={roleFilter}
                        onValueChange={setRoleFilter}
                        options={filterOptions?.roles?.map((role) => ({
                          value: role.value,
                          label: role.translationKey ? t(role.label as keyof typeof t) : role.label,
                        })) || []}
                        placeholder={t('filterByRole')}
                        searchPlaceholder="Search roles..."
                        width="w-40"
                        data-testid="filter-role"
                      />

                      {/* Status Filter */}
                      <SearchableSelect
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                        options={filterOptions?.statuses?.map((status) => ({
                          value: status.value,
                          label: status.translationKey ? t(status.label as keyof typeof t) : status.label,
                        })) || []}
                        placeholder={t('filterByStatus')}
                        searchPlaceholder="Search status..."
                        width="w-40"
                        data-testid="filter-status"
                      />

                      {/* Organization Filter - Hidden for demo_manager and managers with only 1 organization */}
                      {filterOptions?.organizations && 
                       Array.isArray(filterOptions.organizations) && 
                       filterOptions.organizations.length > 0 && 
                       !(currentUser?.role === 'demo_manager') &&
                       !(currentUser?.role === 'manager' && currentUserOrganizations && currentUserOrganizations.length === 1) &&
                       (currentUserOrganizations && currentUserOrganizations.length > 1) && (
                        <SearchableSelect
                          value={organizationFilter}
                          onValueChange={setOrganizationFilter}
                          options={filterOptions.organizations.map((org) => ({
                            value: org.value,
                            label: org.translationKey ? t(org.label as keyof typeof t) : org.label,
                          }))}
                          placeholder={t('filterByOrganization')}
                          searchPlaceholder="Search organizations..."
                          width="w-40"
                          data-testid="filter-organization"
                        />
                      )}

                      {/* Orphan User Filter - Admin Only, Hidden when organization is selected or for demo users */}
                      {filterOptions?.orphanOptions && 
                       Array.isArray(filterOptions.orphanOptions) && 
                       filterOptions.orphanOptions.length > 0 && 
                       !organizationFilter && 
                       currentUser?.role !== 'demo_manager' && (
                        <SearchableSelect
                          value={orphanFilter}
                          onValueChange={setOrphanFilter}
                          options={filterOptions.orphanOptions.map((option) => ({
                            value: option.value,
                            label: option.translationKey ? t(option.label as keyof typeof t) : option.label,
                          }))}
                          placeholder={t('filterByStatus')}
                          searchPlaceholder="Search options..."
                          width="w-40"
                          data-testid="filter-orphan"
                        />
                      )}
                      
                      {/* Show explanation when orphan filter is disabled - not for demo users */}
                      {organizationFilter && 
                       filterOptions?.orphanOptions && 
                       Array.isArray(filterOptions.orphanOptions) && 
                       filterOptions.orphanOptions.length > 0 && 
                       currentUser?.role !== 'demo_manager' && (
                        <div className="text-sm text-gray-500 italic px-3 py-2 border border-gray-200 rounded-md bg-gray-100">
                          {t('orphanFilterUnavailable')}
                        </div>
                      )}

                      {/* Clear Filters - adjust visibility for demo_manager and managers with only 1 organization */}
                      {(() => {
                        const canClearOrgFilter = !(
                          currentUser?.role === 'demo_manager' || 
                          (currentUser?.role === 'manager' && currentUserOrganizations && currentUserOrganizations.length === 1)
                        );
                        return (searchInput || roleFilter || statusFilter || (canClearOrgFilter && organizationFilter) || orphanFilter);
                      })() && (
                        <Button variant='outline' onClick={handleClearFilters}>
                          {t('clearFilters')}
                        </Button>
                      )}
                    </div>

                    <h3 className='text-lg font-semibold'>
                      {t('users')} ({filteredTotal} {t('of')} {totalUsers} {t('users').toLowerCase()})
                    </h3>

                    {/* User Table */}
                    <UserAssignmentsTable 
                      users={currentUsers} 
                      isLoading={usersLoading}
                      onEditUser={openEditDialog}
                      onEditOrganizations={setEditingUserOrganizations}
                      onEditResidences={setEditingUserResidences}
                      onDeleteUser={openDeleteDialog}
                      canEditOrganizations={canEditOrganizations}
                      canEditResidences={canEditResidences}
                      canDeleteUsers={canDeleteUsers}
                    />

                    {/* Server-side Pagination */}
                    {totalPages > 1 && (
                      <div className='flex justify-between items-center mt-4'>
                        <div className='text-sm text-gray-600'>
                          {t('page')} {currentPage} {t('of')} {totalPages} - {t('showing')} {users.length} {t('users').toLowerCase()} ({totalUsers} {t('total').toLowerCase()})
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={!hasPrev || usersLoading}
                          >
                            {t('previous') || 'Previous'}
                          </Button>
                          <span className='px-3 py-1 text-sm'>
                            {t('page') || 'Page'} {currentPage} {t('of') || 'of'} {totalPages}
                          </span>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={!hasNext || usersLoading}
                          >
                            {t('next') || 'Next'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='invitations' className='space-y-6'>
            <InvitationManagement />
          </TabsContent>
        </Tabs>

        {/* Comprehensive Invite Dialog */}
        <SendInvitationDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          onSuccess={() => {
            // Refresh users list after successful invitation
            queryClient.invalidateQueries({ queryKey: ['/api/users'] });
          }}
        />

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className='sm:max-w-[800px] max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle>{t('editUserTitle')}</DialogTitle>
              <DialogDescription>{t('editUserDescription')}</DialogDescription>
            </DialogHeader>

            <div className='space-y-6'>
              {/* Basic Information Section */}
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditUser)} className='space-y-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <FormField
                      control={editForm.control}
                      name='firstName'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('firstName')}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid='input-edit-firstName' />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name='lastName'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('lastName')}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid='input-edit-lastName' />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name='email'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('email')}</FormLabel>
                        <FormControl>
                          <Input {...field} type='email' data-testid='input-edit-email' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name='role'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('role')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid='select-edit-role'>
                              <SelectValue placeholder={t('selectRole')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(getAvailableRoles) && getAvailableRoles.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name='isActive'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('accountStatus')}</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === 'true')}
                          defaultValue={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid='select-edit-status'>
                              <SelectValue placeholder={t('selectStatus') || 'Select status'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='true'>{t('statusActive')}</SelectItem>
                            <SelectItem value='false'>{t('statusInactive')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </form>
              </Form>

              {/* Organization Assignments Section */}
              {canEditOrganizations && (
                <UserOrganizationsTab 
                  user={editingUser ? findUserWithAssignments(editingUser.id) : null}
                  organizations={organizations}
                  currentUser={currentUser}
                  currentUserOrganizations={currentUserAccess.organizationIds}
                  onSave={() => {}} // No individual save - only unified save button
                  onSelectionChange={handleOrganizationSelectionChange}
                  isLoading={editOrganizationsMutation.isPending}
                />
              )}

              {/* Building Assignments Section */}
              <UserBuildingsTab 
                user={editingUser ? findUserWithAssignments(editingUser.id) : null}
                buildings={buildings}
                organizations={organizations}
                currentUser={currentUser}
                currentUserBuildingIds={currentUserAccess.buildingIds}
                currentUserOrganizationIds={currentUserAccess.organizationIds}
                selectedOrganizationIds={selectedOrganizationIds}
                selectedBuildingIds={selectedBuildingIds}
                onSave={() => {}} // No individual save - only unified save button
                onSelectionChange={handleBuildingSelectionChange}
                isLoading={editBuildingsMutation.isPending}
              />

              {/* Residence Assignments Section */}
              {canEditResidences && (
                <UserResidencesTab 
                  user={editingUser ? findUserWithAssignments(editingUser.id) : null}
                  residences={residences}
                  buildings={buildings}
                  organizations={organizations}
                  currentUser={currentUser}
                  currentUserResidenceIds={currentUserAccess.residenceIds}
                  currentUserOrganizationIds={currentUserAccess.organizationIds}
                  selectedBuildingIds={selectedBuildingIds}
                  selectedResidenceAssignments={selectedResidenceAssignments}
                  onSave={() => {}} // No individual save - only unified save button
                  onSelectionChange={setSelectedResidenceAssignments}
                  isLoading={editResidencesMutation.isPending}
                />
              )}
            </div>

            {/* Unified Save Footer */}
            <DialogFooter className="mt-6">
              <Button
                type='button'
                variant='outline'
                onClick={() => setEditingUser(null)}
                data-testid='button-cancel-edit'
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleUnifiedSave}
                disabled={editUserMutation.isPending || editOrganizationsMutation.isPending || editBuildingsMutation.isPending || editResidencesMutation.isPending}
                data-testid='button-save-all'
              >
                {(editUserMutation.isPending || editOrganizationsMutation.isPending || editBuildingsMutation.isPending || editResidencesMutation.isPending) 
                  ? (t('saving') || 'Saving...') 
                  : (t('saveChanges') || 'Save Changes')
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Delete Orphan Users Confirmation Dialog */}
        <AlertDialog open={showDeleteOrphansDialog} onOpenChange={setShowDeleteOrphansDialog}>
          <AlertDialogContent className='sm:max-w-[500px] max-h-[90vh] overflow-y-auto'>
            <AlertDialogHeader>
              <AlertDialogTitle className='text-red-600'>{t('deleteOrphanUsersConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteOrphanUsersConfirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-4'>
              <p className='text-red-700 dark:text-red-300 text-sm'>
                <strong>{t('deleteOrphanUsersWarning')}</strong>
              </p>
              <ul className='text-red-700 dark:text-red-300 text-sm mt-2 list-disc list-inside'>
                <li>{t('deleteOrphanUsersWarningList1')}</li>
                <li>{t('deleteOrphanUsersWarningList2')}</li>
                <li>{t('deleteOrphanUsersWarningList3')}</li>
                <li>{t('deleteOrphanUsersWarningList4')}</li>
              </ul>
            </div>

            <AlertDialogFooter>
              <Button
                variant='outline'
                onClick={() => setShowDeleteOrphansDialog(false)}
                disabled={deleteOrphanUsersMutation.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                variant='destructive'
                onClick={handleDeleteOrphanUsers}
                disabled={deleteOrphanUsersMutation.isPending}
                data-testid="button-confirm-delete-orphans"
              >
                {deleteOrphanUsersMutation.isPending ? 'Deleting...' : t('deleteOrphanUsers')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <AlertDialogContent className='sm:max-w-[500px] max-h-[90vh] overflow-y-auto'>
            <AlertDialogHeader>
              <AlertDialogTitle className='text-red-600'>{t('deleteUserTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('deleteUserDescription').replace('and all associated data', `${deletingUser?.firstName} ${deletingUser?.lastName} and all associated data`)}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-4'>
              <p className='text-red-700 dark:text-red-300 text-sm'>
                <strong>{t('warning') || 'Warning'}:</strong> {t('deleteUserDataWarning') || 'This will delete all user data including'}:
              </p>
              <ul className='text-red-700 dark:text-red-300 text-sm mt-2 list-disc list-inside'>
                <li>{t('profileInfoAccess') || 'Profile information and account access'}</li>
                <li>{t('orgResidenceAssignments') || 'Organization and residence assignments'}</li>
                <li>{t('billsDocsMaintenance') || 'Bills, documents, and maintenance requests'}</li>
                <li>{t('notificationsActivity') || 'Notifications and activity history'}</li>
              </ul>
            </div>

            <Form {...deleteForm}>
              <form onSubmit={deleteForm.handleSubmit(handleDeleteUser)} className='space-y-4'>
                <FormField
                  control={deleteForm.control}
                  name='confirmEmail'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('confirmEmail') || 'Confirm Email'}:{' '}
                        <span className='font-mono text-sm'>{deletingUser?.email}</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='email'
                          placeholder={deletingUser?.email}
                          data-testid='input-confirm-delete-email'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={deleteForm.control}
                  name='reason'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('reasonOptional')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('enterReasonDeletion') || 'Enter reason for deletion...'}
                          data-testid='input-delete-reason'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <AlertDialogFooter>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setDeletingUser(null)}
                    disabled={deleteUserMutation.isPending}
                    data-testid='button-cancel-delete'
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    variant='destructive'
                    disabled={deleteUserMutation.isPending}
                    data-testid='button-confirm-delete'
                  >
                    {deleteUserMutation.isPending ? 'Deleting...' : 'Delete Account'}
                  </Button>
                </AlertDialogFooter>
              </form>
            </Form>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
    </div>
  );
}

