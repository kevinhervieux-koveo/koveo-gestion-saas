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
    queryKey: ['/api/buildings', buildingId],
    queryFn: async () => {
      const response = await fetch(`/api/buildings/${buildingId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch building');
      return response.json();
    },
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

  const isUserTenant = user?.role === 'tenant';

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* Back button */}
      <div className='p-6 pb-0'>
        <Button
          variant='outline'
          onClick={() => navigate('/residents/buildings')}
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
          userRole: 'resident',
          entityId: buildingId,
          entityName: building?.name,
          entityAddress: building?.address,
          allowCreate: false, // Residents can't create building documents
          allowEdit: false, // Residents can't edit building documents
          allowDelete: false, // Residents can't delete building documents
          showVisibilityToggle: false,
        }}
      />
    </div>
  );
}
