import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { useFullscreen } from '@/hooks/use-fullscreen';
import {
  Maximize2,
  Minimize2,
  Home,
  FileText,
  Wrench,
  DollarSign,
  MessageSquare,
} from 'lucide-react';

/**
 * Residents Dashboard - Main dashboard for residents.
 */
export default function ResidentsDashboard() {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const { language } = useLanguage();

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title='Welcome Back'
        subtitle='Your personal residence dashboard - manage your home and stay connected with your building community'
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Fullscreen Controls */}
          <div className='flex justify-end mb-4'>
            <Button
              variant='outline'
              size='sm'
              onClick={toggleFullscreen}
              className='flex items-center gap-2'
              data-testid='button-fullscreen-toggle'
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className='w-4 h-4' />
                  <span className='hidden sm:inline'>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className='w-4 h-4' />
                  <span className='hidden sm:inline'>Fullscreen</span>
                </>
              )}
            </Button>
          </div>

          {/* Quick Actions Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'>
            <Card className='cursor-pointer hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>My Home</CardTitle>
                <Home className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>Unit 4B</div>
                <p className='text-xs text-muted-foreground'>Building status: Good</p>
              </CardContent>
            </Card>

            <Card className='cursor-pointer hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Documents</CardTitle>
                <FileText className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>3</div>
                <p className='text-xs text-muted-foreground'>New documents</p>
              </CardContent>
            </Card>

            <Card className='cursor-pointer hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Maintenance</CardTitle>
                <Wrench className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>1</div>
                <p className='text-xs text-muted-foreground'>Active request</p>
              </CardContent>
            </Card>

            <Card className='cursor-pointer hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Bills</CardTitle>
                <DollarSign className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$1,250</div>
                <p className='text-xs text-muted-foreground'>Next payment due</p>
              </CardContent>
            </Card>

            <Card className='cursor-pointer hover:shadow-md transition-shadow'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Messages</CardTitle>
                <MessageSquare className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>2</div>
                <p className='text-xs text-muted-foreground'>Unread messages</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates from your building</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center space-x-4'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Maintenance completed</p>
                    <p className='text-xs text-muted-foreground'>
                      Elevator maintenance finished - Unit 4B
                    </p>
                  </div>
                  <p className='text-xs text-muted-foreground'>2 hours ago</p>
                </div>
                <div className='flex items-center space-x-4'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>Payment confirmed</p>
                    <p className='text-xs text-muted-foreground'>Monthly condo fees - $1,250</p>
                  </div>
                  <p className='text-xs text-muted-foreground'>1 day ago</p>
                </div>
                <div className='flex items-center space-x-4'>
                  <div className='w-2 h-2 bg-orange-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>New building notice</p>
                    <p className='text-xs text-muted-foreground'>
                      Pool maintenance scheduled for next week
                    </p>
                  </div>
                  <p className='text-xs text-muted-foreground'>3 days ago</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Building events and important dates</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between p-3 bg-blue-50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Board Meeting</p>
                    <p className='text-xs text-muted-foreground'>Monthly community meeting</p>
                  </div>
                  <p className='text-sm text-blue-600'>Jan 15</p>
                </div>
                <div className='flex items-center justify-between p-3 bg-green-50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Pool Reopening</p>
                    <p className='text-xs text-muted-foreground'>After maintenance completion</p>
                  </div>
                  <p className='text-sm text-green-600'>Jan 20</p>
                </div>
                <div className='flex items-center justify-between p-3 bg-orange-50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Fire Drill</p>
                    <p className='text-xs text-muted-foreground'>Mandatory building safety drill</p>
                  </div>
                  <p className='text-sm text-orange-600'>Jan 25</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
