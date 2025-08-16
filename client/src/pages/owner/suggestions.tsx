import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  Shield,
  Code,
  FileText,
  Zap,
  Terminal,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';

/**
 *
 */
interface ImprovementSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  status: 'New' | 'Acknowledged' | 'Done';
  category: string;
  createdAt: string;
}

// Category configuration with icons and colors
const categoryConfig = [
  { name: 'Code Quality', icon: Code, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Testing', icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200' },
  { name: 'Documentation', icon: FileText, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { name: 'Security', icon: Shield, color: 'bg-red-50 text-red-700 border-red-200' },
  { name: 'Performance', icon: Zap, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
];

/**
 *
 */
export default function OwnerSuggestions() {
  const { toast } = useToast();
  const { data: suggestions = [], isLoading } = useQuery<ImprovementSuggestion[]>({
    queryKey: ['/api/pillars/suggestions'],
  });

  // Group suggestions by category and take 2 from each
  const categorizedSuggestions = useMemo(() => {
    const grouped = suggestions.reduce((acc, suggestion) => {
      if (!acc[suggestion.category]) {
        acc[suggestion.category] = [];
      }
      // Only add if not done and we have less than 2 in this category
      if (suggestion.status !== 'Done' && acc[suggestion.category].length < 2) {
        acc[suggestion.category].push(suggestion);
      }
      return acc;
    }, {} as Record<string, ImprovementSuggestion[]>);

    // Sort suggestions within each category by priority
    const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => 
        priorityOrder[a.priority] - priorityOrder[b.priority]
      );
    });

    return grouped;
  }, [suggestions]);

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/pillars/suggestions/${id}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pillars/suggestions'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/pillars/suggestions/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pillars/suggestions'] });
      // Show success message indicating deletion and continuous improvement update
      toast({
        title: 'Suggestion Completed',
        description:
          'Suggestion has been removed and continuous improvement analysis is running in the background.',
      });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-purple-100 text-purple-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'bg-green-100 text-green-800';
      case 'Acknowledged':
        return 'bg-blue-100 text-blue-800';
      case 'New':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAIPrompt = (suggestion: ImprovementSuggestion) => {
    const baseContext =
      'You are working on a Quebec property management SaaS called Koveo Gestion. ';

    switch (suggestion.category) {
      case 'Code Quality':
        return `${baseContext}${suggestion.description} Focus on improving code maintainability while preserving existing functionality. Follow existing TypeScript patterns and ensure all changes maintain type safety.`;

      case 'Testing':
        return `${baseContext}${suggestion.description} Add comprehensive unit tests using Jest and React Testing Library. Focus on critical paths and edge cases. Ensure tests follow the existing test structure in /tests/ directory.`;

      case 'Documentation':
        return `${baseContext}${suggestion.description} Add JSDoc comments to all exported functions and classes. Follow the existing documentation style and include parameter descriptions, return values, and usage examples where appropriate.`;

      case 'Security':
        return `${baseContext}${suggestion.description} Address security vulnerabilities while maintaining Law 25 compliance for Quebec privacy regulations. Update dependencies safely and validate all changes don't break authentication or data protection.`;

      case 'Performance':
        return `${baseContext}${suggestion.description} Optimize performance while maintaining the existing user experience. Consider code splitting, lazy loading, and bundle optimization. Test changes thoroughly to ensure no regressions.`;

      default:
        return `${baseContext}${suggestion.description} Implement this improvement following the existing codebase patterns and Quebec property management requirements. Ensure all changes are well-tested and documented.`;
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    const config = categoryConfig.find(c => c.name === categoryName);
    return config?.icon || MessageSquare;
  };

  const getCategoryColor = (categoryName: string) => {
    const config = categoryConfig.find(c => c.name === categoryName);
    return config?.color || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title='Improvement Suggestions'
        subtitle='Review and manage system improvement recommendations'
      />

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>tsx scripts/run-quality-check.ts</code>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          {/* Category Summary */}
          <Card className='mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'>
            <CardContent className='pt-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-lg font-semibold text-blue-900'>Continuous Improvement Overview</h3>
                  <p className='text-sm text-blue-700 mt-1'>
                    Displaying 2 priority suggestions per category for focused improvements
                  </p>
                </div>
                <Badge className='bg-blue-100 text-blue-800'>
                  {Object.values(categorizedSuggestions).flat().length} Active Suggestions
                </Badge>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className='flex items-center justify-center h-64'>
              <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-koveo-navy'></div>
            </div>
          ) : (
            <div className='space-y-8'>
              {categoryConfig.map((category) => {
                const categorySuggestions = categorizedSuggestions[category.name] || [];
                const Icon = category.icon;
                
                if (categorySuggestions.length === 0) return null;
                
                return (
                  <div key={category.name} className='space-y-4'>
                    {/* Category Header */}
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${category.color}`}>
                      <Icon className='h-5 w-5' />
                      <h2 className='text-lg font-semibold'>{category.name}</h2>
                      <Badge variant='outline' className='ml-auto'>
                        {categorySuggestions.length} {categorySuggestions.length === 1 ? 'suggestion' : 'suggestions'}
                      </Badge>
                    </div>
                    
                    {/* Category Suggestions */}
                    <div className='grid gap-4 md:grid-cols-2'>
                      {categorySuggestions.map((suggestion) => (
                        <Card key={suggestion.id} className='hover:shadow-lg transition-all hover:scale-[1.02]'>
                    <CardHeader>
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <CardTitle className='text-lg font-semibold text-koveo-navy'>
                            {suggestion.title}
                          </CardTitle>
                          <CardDescription className='mt-2'>
                            {suggestion.description}
                          </CardDescription>
                        </div>
                        <div className='flex flex-col gap-2 ml-4'>
                          <Badge className={getPriorityColor(suggestion.priority)}>
                            {suggestion.priority} Priority
                          </Badge>
                          <Badge className={getStatusColor(suggestion.status)}>
                            {suggestion.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className='mb-4'>
                        <div className='flex items-center gap-4 text-sm text-gray-600 mb-3'>
                          <span className='flex items-center gap-1'>
                            <MessageSquare size={16} />
                            {suggestion.category}
                          </span>
                          <span>
                            Created: {new Date(suggestion.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* AI Agent Prompt */}
                        <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                          <div className='text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide'>
                            AI Agent Prompt
                          </div>
                          <div className='text-sm text-blue-900 font-mono bg-white border rounded px-3 py-2 select-all cursor-pointer'>
                            {getAIPrompt(suggestion)}
                          </div>
                          <div className='text-xs text-blue-600 mt-1'>
                            Click to select and copy the prompt above
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center justify-between'>
                        <div></div>

                        <div className='flex gap-2'>
                          {suggestion.status === 'New' && (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => acknowledgeMutation.mutate(suggestion.id)}
                              disabled={acknowledgeMutation.isPending}
                              className='flex items-center gap-2'
                            >
                              <Clock size={16} />
                              Acknowledge
                            </Button>
                          )}

                          {(suggestion.status === 'New' ||
                            suggestion.status === 'Acknowledged') && (
                            <Button
                              size='sm'
                              onClick={() => completeMutation.mutate(suggestion.id)}
                              disabled={completeMutation.isPending}
                              className='flex items-center gap-2'
                            >
                              <CheckCircle size={16} />
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Empty State */}
              {Object.values(categorizedSuggestions).flat().length === 0 && (
                <Card>
                  <CardContent className='flex flex-col items-center justify-center py-16'>
                    <MessageSquare size={48} className='text-gray-400 mb-4' />
                    <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                      No Active Suggestions
                    </h3>
                    <p className='text-gray-500 text-center max-w-md'>
                      All suggestions have been completed or no improvement suggestions have been generated yet. 
                      Run the quality check to generate new recommendations.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
