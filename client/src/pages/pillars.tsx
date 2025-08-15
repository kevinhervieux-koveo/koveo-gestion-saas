import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Code,
  Lock,
  TestTube,
  Zap,
} from 'lucide-react';
import type { ImprovementSuggestion } from '@shared/schema';

/**
 *
 */
export default function PillarsPage() {
  const {
    data: suggestions,
    isLoading,
    error,
    refetch,
  } = useQuery<ImprovementSuggestion[]>({
    queryKey: ['/api/pillars/suggestions'],
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Code Quality':
        return <Code className='h-4 w-4' />;
      case 'Security':
        return <Lock className='h-4 w-4' />;
      case 'Testing':
        return <TestTube className='h-4 w-4' />;
      case 'Documentation':
        return <FileText className='h-4 w-4' />;
      case 'Performance':
        return <Zap className='h-4 w-4' />;
      default:
        return <AlertCircle className='h-4 w-4' />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-500 hover:bg-red-600';
      case 'High':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'Medium':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Low':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Done':
        return <CheckCircle className='h-4 w-4 text-green-500' />;
      case 'Acknowledged':
        return <AlertCircle className='h-4 w-4 text-yellow-500' />;
      case 'New':
      default:
        return <XCircle className='h-4 w-4 text-red-500' />;
    }
  };

  return (
    <div className='container mx-auto py-8 px-4 max-w-6xl'>
      <div className='mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <ShieldCheck className='h-8 w-8 text-primary' />
            <div>
              <h1 className='text-3xl font-bold'>Pillar Framework Health Dashboard</h1>
              <p className='text-muted-foreground mt-1'>
                Continuous improvement suggestions for your codebase
              </p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant='outline' className='flex items-center gap-2'>
            <RefreshCw className='h-4 w-4' />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className='space-y-4'>
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className='h-4 w-3/4 mb-2' />
                <Skeleton className='h-3 w-1/2' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-16 w-full' />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            Failed to load improvement suggestions. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {suggestions && suggestions.length === 0 && (
        <Alert className='border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800'>
          <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
          <AlertDescription className='text-green-800 dark:text-green-200'>
            No suggestions at this time. The system is healthy.
          </AlertDescription>
        </Alert>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className='space-y-4'>
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className='hover:shadow-lg transition-shadow duration-200'>
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-2'>
                      <CardTitle className='text-xl'>{suggestion.title}</CardTitle>
                      {getStatusIcon(suggestion.status)}
                    </div>
                    <div className='flex items-center gap-3 flex-wrap'>
                      <div className='flex items-center gap-1'>
                        {getCategoryIcon(suggestion.category)}
                        <span className='text-sm text-muted-foreground'>{suggestion.category}</span>
                      </div>
                      <Badge className={`${getPriorityColor(suggestion.priority)} text-white`}>
                        {suggestion.priority}
                      </Badge>
                      {suggestion.filePath && (
                        <span className='text-sm text-muted-foreground font-mono'>
                          {suggestion.filePath}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className='text-base leading-relaxed'>
                  {suggestion.description}
                </CardDescription>
                {suggestion.status === 'New' && (
                  <div className='mt-4 flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={async () => {
                        await fetch(`/api/pillars/suggestions/${suggestion.id}/acknowledge`, {
                          method: 'POST',
                        });
                        refetch();
                      }}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant='default'
                      size='sm'
                      onClick={async () => {
                        await fetch(`/api/pillars/suggestions/${suggestion.id}/complete`, {
                          method: 'POST',
                        });
                        refetch();
                      }}
                    >
                      Mark as Done
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className='mt-8 text-center text-sm text-muted-foreground'>
        <p>Run the quality auditor to generate new suggestions:</p>
        <code className='bg-muted px-2 py-1 rounded mt-2 inline-block font-mono'>
          tsx scripts/run-quality-check.ts
        </code>
      </div>
    </div>
  );
}
