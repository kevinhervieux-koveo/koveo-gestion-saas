import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Settings, Send, Calculator } from 'lucide-react';

/**
 *
 */
export default function Bills() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Bills Management' subtitle='Manage bills and invoicing' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <FileText className='w-5 h-5' />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <Button className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Plus className='w-6 h-6' />
                  <span>Create Bill</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Send className='w-6 h-6' />
                  <span>Send Bills</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Calculator className='w-6 h-6' />
                  <span>Payment Tracking</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Settings className='w-6 h-6' />
                  <span>Bill Settings</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card>
            <CardContent className='p-8 text-center'>
              <FileText className='w-16 h-16 mx-auto text-gray-400 mb-4' />
              <h3 className='text-lg font-semibold text-gray-600 mb-2'>Bills Management Interface</h3>
              <p className='text-gray-500 mb-4'>Complete billing and invoicing system coming soon</p>
              <Badge variant='secondary'>Future Development</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
