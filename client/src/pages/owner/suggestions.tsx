import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ImprovementSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Acknowledged' | 'Done';
  category: string;
  createdAt: string;
}

export default function OwnerSuggestions() {
  const { data: suggestions, isLoading } = useQuery<ImprovementSuggestion[]>({
    queryKey: ['/api/pillars/suggestions'],
    refetchInterval: 5000, // Auto-update every 5 seconds
  });

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
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Acknowledged': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Improvement Suggestions"
        subtitle="Review and manage system improvement recommendations"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-koveo-navy"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions && suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-koveo-navy">
                            {suggestion.title}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {suggestion.description}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={16} />
                            {suggestion.category}
                          </span>
                          <span>
                            Created: {new Date(suggestion.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          {suggestion.status === 'Pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeMutation.mutate(suggestion.id)}
                              disabled={acknowledgeMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              <Clock size={16} />
                              Acknowledge
                            </Button>
                          )}
                          
                          {(suggestion.status === 'Pending' || suggestion.status === 'Acknowledged') && (
                            <Button
                              size="sm"
                              onClick={() => completeMutation.mutate(suggestion.id)}
                              disabled={completeMutation.isPending}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle size={16} />
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <MessageSquare size={48} className="text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No Suggestions Available</h3>
                    <p className="text-gray-500 text-center">
                      No improvement suggestions have been generated yet. 
                      Run the quality check to generate recommendations.
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