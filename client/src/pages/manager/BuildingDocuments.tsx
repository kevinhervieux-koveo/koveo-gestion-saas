import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import DocumentManager from '@/components/common/DocumentManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BuildingDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();

  // Get buildingId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const buildingId = (params as any).buildingId || urlParams.get('buildingId');

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Get building info
  const { data: building } = useQuery({
    queryKey: ['/api/manager/buildings', buildingId],
    queryFn: () => apiRequest('GET', `/api/manager/buildings/${buildingId}`) as Promise<any>,
    enabled: !!buildingId,
  });

  if (!buildingId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 flex items-center justify-center'>
          <p className='text-gray-500'>Building ID is required</p>
        </div>
      </div>
    );
  }

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* Back button */}
      <div className='p-6 pb-0'>
        <Button
          variant='outline'
          onClick={() => navigate('/manager/buildings')}
          className='mb-4'
          data-testid='button-back'
        >
          <ArrowLeft className='w-4 h-4 mr-2' />
          Back to Buildings
        </Button>
      </div>

      <DocumentManager
        config={{
          type: 'building',
          userRole: 'manager',
          entityId: buildingId,
          entityName: building?.name,
          entityAddress: building?.address,
          allowCreate: isManager,
          allowEdit: isManager,
          allowDelete: isManager,
          showVisibilityToggle: isManager,
        }}
      />
    </div>
  );
}
