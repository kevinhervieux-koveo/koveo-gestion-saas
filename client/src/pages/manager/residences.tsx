import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, Plus, Settings, Search, Users } from 'lucide-react';

/**
 *
 */
export default function Residences() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Residences Management' subtitle='Manage all residences and units' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Home className='w-5 h-5' />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <Button className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Plus className='w-6 h-6' />
                  <span>Add New Unit</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Search className='w-6 h-6' />
                  <span>Search Units</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Users className='w-6 h-6' />
                  <span>Assign Residents</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Settings className='w-6 h-6' />
                  <span>Unit Settings</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card>
            <CardContent className='p-8 text-center'>
              <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
              <h3 className='text-lg font-semibold text-gray-600 mb-2'>Residences Management Interface</h3>
              <p className='text-gray-500 mb-4'>Complete residence and unit management system coming soon</p>
              <Badge variant='secondary'>Future Development</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
