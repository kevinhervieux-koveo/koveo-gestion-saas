import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Clock, CheckCircle } from 'lucide-react';

/**
 * Residents Demands page component.
 * Placeholder implementation for resident requests/demands functionality.
 */
export default function ResidentsDemands() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title='My Requests' 
        subtitle='View and manage your maintenance requests and service demands' 
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-4xl mx-auto space-y-6'>
          {/* New Request Button */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <span className='flex items-center gap-2'>
                  <FileText className='w-5 h-5' />
                  Service Requests
                </span>
                <Button disabled>
                  <Plus className='w-4 h-4 mr-2' />
                  New Request
                </Button>
              </CardTitle>
              <CardDescription>
                Submit and track maintenance requests for your residence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-center py-8'>
                <FileText className='w-12 h-12 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Requests Yet</h3>
                <p className='text-gray-500 mb-4'>
                  You haven't submitted any maintenance requests. Use the button above to create your first request.
                </p>
                <Badge variant='secondary'>Feature Coming Soon</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Request History */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Clock className='w-5 h-5' />
                Request History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-center py-8'>
                <Clock className='w-12 h-12 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No History Available</h3>
                <p className='text-gray-500'>
                  Your request history will appear here once you start submitting maintenance requests.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}