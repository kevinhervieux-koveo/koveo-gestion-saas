import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  PieChart, 
  BarChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calculator
} from 'lucide-react';

export default function Budget() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Budget Dashboard' subtitle='Tableau de bord budgétaire' />
      
      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Summary Cards */}
          <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Total Budget</CardTitle>
                <DollarSign className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$125,000</div>
                <p className='text-xs text-muted-foreground'>
                  <span className='text-green-600'>+2.1%</span> from last year
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Used Budget</CardTitle>
                <Calculator className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$87,500</div>
                <p className='text-xs text-muted-foreground'>
                  70% of total budget
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Remaining</CardTitle>
                <TrendingUp className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>$37,500</div>
                <p className='text-xs text-muted-foreground'>
                  30% remaining
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Variance</CardTitle>
                <TrendingDown className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold text-green-600'>-$2,500</div>
                <p className='text-xs text-muted-foreground'>
                  Under budget
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Budget Categories */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PieChart className='w-5 h-5' />
                Budget Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {[
                  { category: 'Maintenance', budget: 45000, used: 32000, color: 'bg-blue-500' },
                  { category: 'Utilities', budget: 30000, used: 28000, color: 'bg-green-500' },
                  { category: 'Insurance', budget: 25000, used: 15000, color: 'bg-purple-500' },
                  { category: 'Administration', budget: 15000, used: 8500, color: 'bg-orange-500' },
                  { category: 'Cleaning', budget: 10000, used: 4000, color: 'bg-red-500' },
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
                Monthly Spending Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='h-64 flex items-center justify-center text-gray-500'>
                <div className='text-center'>
                  <BarChart className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                  <p>Budget analytics chart would appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}