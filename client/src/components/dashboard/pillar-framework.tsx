import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Columns, TrendingUp, FileText, Shield, TestTube, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

/**
 * Enhanced Pillar framework component that displays all five core development pillars
 * of the Koveo Gestion methodology with real-time status, metrics, and improvement suggestions.
 * @returns JSX element displaying the comprehensive pillar framework interface.
 */
export function PillarFramework() {
  const { t } = useLanguage();

  // Fetch real-time pillar data and improvement suggestions
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['/api/pillars/suggestions'],
    refetchInterval: 30000, // Refresh every 30 seconds for continuous monitoring
  });

  const { data: qualityMetrics } = useQuery({
    queryKey: ['/api/quality-metrics'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate completion percentages and health scores
  const calculatePillarHealth = (pillarName: string) => {
    if (!suggestions) return { health: 85, suggestions: 0, completedToday: 0 };
    
    const pillarSuggestions = Array.isArray(suggestions) ? suggestions.filter((s: any) => 
      s.category?.toLowerCase().includes(pillarName.toLowerCase())
    ) : [];
    const completedSuggestions = pillarSuggestions.filter((s: any) => s.status === 'Done');
    
    return {
      health: pillarSuggestions.length > 0 ? Math.round((completedSuggestions.length / pillarSuggestions.length) * 100) : 85,
      suggestions: pillarSuggestions.length,
      completedToday: completedSuggestions.filter((s: any) => {
        const completedDate = new Date(s.completedAt || s.updatedAt);
        const today = new Date();
        return completedDate.toDateString() === today.toDateString();
      }).length
    };
  };

  // Enhanced pillar configuration with all 5 pillars and real-time data
  const pillars = [
    {
      id: 1,
      title: t('validationQAPillar') || 'Validation & QA',
      description: t('coreQualityAssurance') || 'Core quality assurance and validation framework',
      status: 'in-progress',
      statusText: t('inProgress') || 'In Progress',
      icon: CheckCircle2,
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
      statusColor: 'text-orange-600 dark:text-orange-400',
      ...calculatePillarHealth('Quality')
    },
    {
      id: 2,
      title: t('testingPillar') || 'Testing Framework',
      description: t('automatedTestingFramework') || 'Automated testing and validation system',
      status: 'in-progress',
      statusText: t('inProgress') || 'In Progress',
      icon: TestTube,
      bgColor: 'bg-green-50 dark:bg-green-950',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-400',
      statusColor: 'text-orange-600 dark:text-orange-400',
      ...calculatePillarHealth('Testing')
    },
    {
      id: 3,
      title: t('securityPillar') || 'Security & Compliance',
      description: t('law25ComplianceFramework') || 'Quebec Law 25 compliance and security framework',
      status: 'in-progress',
      statusText: t('inProgress') || 'In Progress',
      icon: Shield,
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      borderColor: 'border-purple-200 dark:border-purple-800',
      iconColor: 'text-purple-600 dark:text-purple-400',
      statusColor: 'text-orange-600 dark:text-orange-400',
      ...calculatePillarHealth('Security')
    },
    {
      id: 4,
      title: t('continuousImprovementPillar') || 'Continuous Improvement',
      description: t('continuousImprovementDescription') || 'AI-driven metrics, analytics, and automated improvement suggestions',
      status: 'active',
      statusText: t('activePillar') || 'Active',
      icon: TrendingUp,
      bgColor: 'bg-indigo-50 dark:bg-indigo-950',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      statusColor: 'text-green-600 dark:text-green-400',
      ...calculatePillarHealth('Continuous Improvement')
    },
    {
      id: 5,
      title: t('documentationPillar') || 'Documentation & Knowledge',
      description: t('documentationDescription') || 'Comprehensive documentation and knowledge management system',
      status: 'in-progress',
      statusText: t('inProgress') || 'In Progress',
      icon: FileText,
      bgColor: 'bg-amber-50 dark:bg-amber-950',
      borderColor: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
      statusColor: 'text-orange-600 dark:text-orange-400',
      ...calculatePillarHealth('Documentation')
    },
  ];

  const overallHealth = Math.round(pillars.reduce((acc, pillar) => acc + pillar.health, 0) / pillars.length);
  const totalSuggestions = pillars.reduce((acc, pillar) => acc + pillar.suggestions, 0);
  const completedToday = pillars.reduce((acc, pillar) => acc + pillar.completedToday, 0);

  if (suggestionsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Columns className='text-koveo-navy' size={20} />
            {t('pillarMethodology') || 'Pillar Methodology'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='animate-pulse space-y-4'>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className='h-16 bg-gray-200 dark:bg-gray-700 rounded-lg'></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Overview Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Columns className='text-koveo-navy' size={20} />
              {t('pillarMethodology') || 'Pillar Methodology Framework'}
            </div>
            <Badge variant={overallHealth >= 80 ? 'default' : overallHealth >= 60 ? 'secondary' : 'destructive'}>
              {overallHealth}% Health
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
            <div className='bg-blue-50 dark:bg-blue-950 p-4 rounded-lg'>
              <div className='flex items-center gap-2 mb-2'>
                <TrendingUp className='text-blue-600 dark:text-blue-400' size={16} />
                <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>System Health</span>
              </div>
              <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>{overallHealth}%</div>
              <Progress value={overallHealth} className='mt-2' />
            </div>
            <div className='bg-green-50 dark:bg-green-950 p-4 rounded-lg'>
              <div className='flex items-center gap-2 mb-2'>
                <CheckCircle2 className='text-green-600 dark:text-green-400' size={16} />
                <span className='text-sm font-medium text-green-900 dark:text-green-100'>Completed Today</span>
              </div>
              <div className='text-2xl font-bold text-green-600 dark:text-green-400'>{completedToday}</div>
            </div>
            <div className='bg-purple-50 dark:bg-purple-950 p-4 rounded-lg'>
              <div className='flex items-center gap-2 mb-2'>
                <AlertCircle className='text-purple-600 dark:text-purple-400' size={16} />
                <span className='text-sm font-medium text-purple-900 dark:text-purple-100'>Active Suggestions</span>
              </div>
              <div className='text-2xl font-bold text-purple-600 dark:text-purple-400'>{totalSuggestions}</div>
            </div>
          </div>

          {/* Pillar Cards */}
          <div className='space-y-4'>
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.id}
                  className={`${pillar.bgColor} border ${pillar.borderColor} rounded-lg p-4 transition-all hover:shadow-md`}
                  data-testid={`pillar-card-${pillar.id}`}
                >
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center gap-2'>
                        <Icon className={pillar.iconColor} size={20} />
                        <span className='font-bold text-gray-500 dark:text-gray-400'>#{pillar.id}</span>
                      </div>
                      <div>
                        <h3 className='font-semibold text-gray-900 dark:text-gray-100'>{pillar.title}</h3>
                        <p className='text-sm text-gray-600 dark:text-gray-400'>{pillar.description}</p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <Badge className={pillar.statusColor}>{pillar.statusText}</Badge>
                      <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        {pillar.health}% healthy
                      </div>
                    </div>
                  </div>
                  
                  <div className='flex items-center justify-between'>
                    <div className='flex-1 mr-4'>
                      <Progress value={pillar.health} className='h-2' />
                    </div>
                    <div className='flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400'>
                      <span className='flex items-center gap-1'>
                        <AlertCircle size={14} />
                        {pillar.suggestions} suggestions
                      </span>
                      {pillar.completedToday > 0 && (
                        <span className='flex items-center gap-1 text-green-600 dark:text-green-400'>
                          <CheckCircle2 size={14} />
                          {pillar.completedToday} completed today
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
