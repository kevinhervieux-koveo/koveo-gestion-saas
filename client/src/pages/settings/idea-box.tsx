import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Plus, ThumbsUp, MessageSquare, Filter, TrendingUp } from 'lucide-react';

/**
 *
 */
export default function  /**
   * Idea box function.
   */
 IdeaBox() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Idea Box' subtitle='Submit and vote on feature suggestions' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Lightbulb className='w-5 h-5' />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <Button className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Plus className='w-6 h-6' />
                  <span>Submit Idea</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <ThumbsUp className='w-6 h-6' />
                  <span>Vote on Ideas</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <MessageSquare className='w-6 h-6' />
                  <span>Comment & Discuss</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <TrendingUp className='w-6 h-6' />
                  <span>Trending Ideas</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card>
            <CardContent className='p-8 text-center'>
              <Lightbulb className='w-16 h-16 mx-auto text-gray-400 mb-4' />
              <h3 className='text-lg font-semibold text-gray-600 mb-2'>Community Idea System</h3>
              <p className='text-gray-500 mb-4'>Complete idea submission and voting system coming soon</p>
              <Badge variant='secondary'>Future Development</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
