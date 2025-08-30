import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import DocumentManager from '@/components/common/DocumentManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export default function ResidenceDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();
  const { t } = useLanguage();

  // Get residenceId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const residenceId = (params as any).residenceId || urlParams.get('residenceId');

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Get residence info
  const { data: residence, isError: residenceError, error } = useQuery({
    queryKey: ['/api/residences', residenceId],
    queryFn: async () => {
      console.log('🔍 ResidenceDocuments: Fetching residence data for ID:', residenceId);
      const response = await fetch(`/api/residences/${residenceId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('RESIDENCE_NOT_FOUND');
        }
        throw new Error('Failed to fetch residence');
      }
      const data = await response.json();
      console.log('🔍 ResidenceDocuments: Residence API response:', data);
      return data;
    },
    enabled: !!residenceId,
    retry: false, // Don't retry on 404s
  });

  if (!residenceId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <p className='text-gray-500 mb-4'>Residence ID is required</p>
            <Button
              variant='outline'
              onClick={() => navigate('/residents/residence')}
              data-testid='button-back-to-residences'
            >
              <ArrowLeft className='w-4 h-4 mr-2' />
              Back to Residences
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle residence not found
  if (residenceError && error?.message === 'RESIDENCE_NOT_FOUND') {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center max-w-md'>
            <h2 className='text-xl font-semibold mb-4'>Residence Not Found</h2>
            <p className='text-gray-500 mb-4'>
              The residence ID "{residenceId}" doesn't exist in the development database.
            </p>
            <p className='text-sm text-gray-400 mb-6'>
              This might be a production database ID. Please use a valid development residence ID.
            </p>
            <div className='space-y-2'>
              <Button
                variant='default'
                onClick={() => navigate('/residents/residence')}
                data-testid='button-back-to-residences'
                className='w-full'
              >
                <ArrowLeft className='w-4 h-4 mr-2' />
                Back to Residences
              </Button>
              <Button
                variant='outline'
                onClick={() => navigate('/residents/residences/e27ac924-8120-4904-a791-d1e9db544d58/documents')}
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

  const isUserTenant = user?.role === 'tenant';
  const residenceName = residence?.unitNumber || residence?.unit_number 
    ? `Unit ${residence.unitNumber || residence.unit_number}` 
    : 'Residence';

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      {/* Back button */}
      <div className='p-6 pb-0'>
        <Button
          variant='outline'
          onClick={() => navigate('/residents/residence')}
          className='mb-4'
          data-testid='button-back'
        >
          <ArrowLeft className='w-4 h-4 mr-2' />
          {t('backToResidences')}
        </Button>
      </div>

      <DocumentManager
        config={{
          type: 'residence',
          userRole: 'resident',
          entityId: residenceId,
          entityName: residenceName,
          entityAddress: residence?.address,
          allowCreate: !isUserTenant,
          allowEdit: !isUserTenant,
          allowDelete: !isUserTenant,
          showVisibilityToggle: !isUserTenant,
        }}
      />
    </div>
  );
}