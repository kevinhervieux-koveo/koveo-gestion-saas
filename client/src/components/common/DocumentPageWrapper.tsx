import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import DocumentManager from '@/components/common/DocumentManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface DocumentPageWrapperProps {
  type: 'building' | 'residence';
  userRole: 'manager' | 'resident';
  backPath: string;
  backLabel?: string;
  entityIdParam: string;
}

export default function DocumentPageWrapper({
  type,
  userRole,
  backPath,
  backLabel,
  entityIdParam,
}: DocumentPageWrapperProps) {
  const [, navigate] = useLocation();
  const params = useParams();
  const { t } = useLanguage();

  // Get entityId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const entityId = (params as any)[entityIdParam] || urlParams.get(entityIdParam);

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Get entity info based on type
  const entityApiPath = type === 'building' ? '/api/manager/buildings' : '/api/residences';
  const { data: entity, isError: entityError, error } = useQuery({
    queryKey: [entityApiPath, entityId],
    queryFn: async () => {
      if (type === 'residence') {
        const response = await fetch(`/api/residences/${entityId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('ENTITY_NOT_FOUND');
          }
          throw new Error(`Failed to fetch ${type}`);
        }
        return response.json();
      } else {
        return apiRequest('GET', `${entityApiPath}/${entityId}`) as Promise<any>;
      }
    },
    enabled: !!entityId,
    retry: false, // Don't retry on 404s
  });

  if (!entityId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <p className='text-gray-500 mb-4'>{type} ID is required</p>
            <Button
              variant='outline'
              onClick={() => navigate(backPath)}
              data-testid='button-back-to-list'
            >
              <ArrowLeft className='w-4 h-4 mr-2' />
              {backLabel || `Back to ${type}s`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle entity not found (specific to residence pages that had this logic)
  if (entityError && error?.message === 'ENTITY_NOT_FOUND' && type === 'residence') {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center max-w-md'>
            <h2 className='text-xl font-semibold mb-4'>Residence Not Found</h2>
            <p className='text-gray-500 mb-4'>
              The residence ID "{entityId}" doesn't exist in the development database.
            </p>
            <p className='text-sm text-gray-400 mb-6'>
              This might be a production database ID. Please use a valid development residence ID.
            </p>
            <div className='space-y-2'>
              <Button
                variant='default'
                onClick={() => navigate(backPath)}
                data-testid='button-back-to-list'
                className='w-full'
              >
                <ArrowLeft className='w-4 h-4 mr-2' />
                {backLabel || 'Back to Residences'}
              </Button>
              <Button
                variant='outline'
                onClick={() =>
                  navigate('/residents/residences/e27ac924-8120-4904-a791-d1e9db544d58/documents')
                }
                data-testid='button-go-to-valid-residence'
                className='w-full'
              >
                Go to Unit 101 (Test Residence)
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine permissions based on user role and type
  const isUserTenant = user?.role === 'tenant';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  
  const permissions = userRole === 'manager' 
    ? {
        allowCreate: isManager,
        allowEdit: isManager,
        allowDelete: isManager,
        showVisibilityToggle: isManager,
      }
    : {
        allowCreate: !isUserTenant,
        allowEdit: !isUserTenant,
        allowDelete: !isUserTenant,
        showVisibilityToggle: !isUserTenant,
      };

  // Generate entity name based on type
  const entityName = type === 'residence' 
    ? (entity?.unitNumber || entity?.unit_number ? `Unit ${entity.unitNumber || entity.unit_number}` : 'Residence')
    : entity?.name;

  const defaultBackLabel = backLabel || (type === 'building' ? 'Back to Buildings' : t('backToResidences'));

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* Back button */}
      <div className='p-6 pb-0'>
        <Button
          variant='outline'
          onClick={() => navigate(backPath)}
          className='mb-4'
          data-testid='button-back'
        >
          <ArrowLeft className='w-4 h-4 mr-2' />
          {defaultBackLabel}
        </Button>
      </div>

      <DocumentManager
        config={{
          type,
          userRole,
          entityId,
          entityName,
          entityAddress: entity?.address,
          ...permissions,
        }}
      />
    </div>
  );
}