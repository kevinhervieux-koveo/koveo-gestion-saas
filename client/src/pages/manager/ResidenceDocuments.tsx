import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import DocumentManager from '@/components/common/DocumentManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ResidenceDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();

  // Get residenceId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const residenceId = params.residenceId || urlParams.get('residenceId');

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Get residence info
  const { data: residence } = useQuery({
    queryKey: ['/api/residences', residenceId],
    queryFn: async () => {
      const response = await fetch(`/api/residences/${residenceId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch residence');
      return response.json();
    },
    enabled: !!residenceId,
  });

  if (!residenceId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 flex items-center justify-center'>
          <p className='text-gray-500'>Residence ID is required</p>
        </div>
      </div>
    );
  }

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const residenceName = residence?.unitNumber 
    ? `Unit ${residence.unitNumber}` 
    : 'Residence';

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* Back button */}
      <div className='p-6 pb-0'>
        <Button
          variant='outline'
          onClick={() => navigate('/manager/residences')}
          className='mb-4'
          data-testid='button-back'
        >
          <ArrowLeft className='w-4 h-4 mr-2' />
          Back to Residences
        </Button>
      </div>

      <DocumentManager
        config={{
          type: 'residence',
          userRole: 'manager',
          entityId: residenceId,
          entityName: residenceName,
          entityAddress: residence?.address,
          allowCreate: isManager,
          allowEdit: isManager,
          allowDelete: isManager,
          showVisibilityToggle: isManager,
        }}
      />
    </div>
  );
}