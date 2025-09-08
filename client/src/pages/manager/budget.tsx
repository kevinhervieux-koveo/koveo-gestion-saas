import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { useLocation } from 'wouter';
import { 
  PieChart, 
  BarChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calculator,
  ArrowLeft
} from 'lucide-react';

interface BudgetProps {
  organizationId?: string;
  buildingId?: string;
}

function BudgetInner({ organizationId, buildingId }: BudgetProps) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const handleBackToOrganization = () => {
    navigate('/manager/budget');
  };

  const handleBackToBuilding = () => {
    navigate(`/manager/budget?organization=${organizationId}`);
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('budgetManagement')} subtitle={t('budgetSubtitle')} />
      
      {/* Back Navigation */}
      {(organizationId || buildingId) && (
        <div className="p-4 border-b border-gray-200">
          <Button
            variant="outline"
            onClick={buildingId ? handleBackToBuilding : handleBackToOrganization}
            className="flex items-center gap-2"
            data-testid={buildingId ? "button-back-to-building" : "button-back-to-organization"}
          >
            <ArrowLeft className="w-4 h-4" />
            {buildingId ? t('building') : t('organization')}
          </Button>
        </div>
      )}
      
      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Summary Cards */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>{t('totalBudget')}</CardTitle>
                <DollarSign className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$125,000</div>
                <p className='text-xs text-muted-foreground'>
                  <span className='text-green-600'>+2.1%</span> {t('fromLastYear')}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>{t('usedBudget')}</CardTitle>
                <Calculator className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$87,500</div>
                <p className='text-xs text-muted-foreground'>
                  70% {t('ofTotalBudget')}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>{t('remaining')}</CardTitle>
                <TrendingUp className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$37,500</div>
                <p className='text-xs text-muted-foreground'>
                  30% {t('percentRemaining')}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>{t('variance')}</CardTitle>
                <TrendingDown className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold text-green-600'>-$2,500</div>
                <p className='text-xs text-muted-foreground'>
                  {t('underBudget')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Budget Categories */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PieChart className='w-5 h-5' />
                {t('budgetCategories')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {[
                  { category: t('maintenance'), budget: 45000, used: 32000, color: 'bg-blue-500' },
                  { category: t('utilities'), budget: 30000, used: 28000, color: 'bg-green-500' },
                  { category: t('insurance'), budget: 25000, used: 15000, color: 'bg-purple-500' },
                  { category: t('administration'), budget: 15000, used: 8500, color: 'bg-orange-500' },
                  { category: t('cleaning'), budget: 10000, used: 4000, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.category} className='flex items-center justify-between p-4 border rounded-lg'>
                    <div className='flex items-center gap-3'>
                      <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                      <div>
                        <h3 className='font-semibold'>{item.category}</h3>
                        <p className='text-sm text-gray-600'>
                          ${item.used.toLocaleString()} / ${item.budget.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={item.used > item.budget ? 'destructive' : 'secondary'}>
                      {Math.round((item.used / item.budget) * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Spending */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <BarChart className='w-5 h-5' />
                {t('monthlySpendingTrend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='h-64 flex items-center justify-center text-gray-500'>
                <div className='text-center'>
                  <BarChart className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                  <p>{t('budgetAnalyticsChart')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const Budget = withHierarchicalSelection(BudgetInner, {
  hierarchy: ['organization', 'building']
});

export default Budget;