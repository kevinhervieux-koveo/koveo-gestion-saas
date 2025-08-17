import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  DollarSign,
  Wrench,
  FileText,
  Bell,
  Calendar,
  Users,
  Building,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
} from 'lucide-react';

/**
 *
 */
export default function ResidentsDashboard() {
  // Mock data for demonstration - in real app this would come from API
  const residenceInfo = {
    unit: 'Unit 302',
    building: 'Maple Heights',
    address: '123 Rue Saint-Catherine, Montreal, QC',
    occupancy: 'Owner-Occupied',
    moveInDate: 'January 2023',
  };

  const quickStats = [
    {
      title: 'Current Balance',
      value: '$0.00',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Open Requests',
      value: '2',
      icon: Wrench,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Unread Notices',
      value: '5',
      icon: Bell,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Next Meeting',
      value: 'Mar 15',
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  const recentBills = [
    {
      id: 1,
      description: 'Monthly Condo Fees - March 2025',
      amount: '$485.00',
      dueDate: 'March 1, 2025',
      status: 'paid',
      paidDate: 'February 28, 2025',
    },
    {
      id: 2,
      description: 'Monthly Condo Fees - February 2025',
      amount: '$485.00',
      dueDate: 'February 1, 2025',
      status: 'paid',
      paidDate: 'January 30, 2025',
    },
    {
      id: 3,
      description: 'Special Assessment - Elevator Repair',
      amount: '$125.00',
      dueDate: 'April 15, 2025',
      status: 'pending',
    },
  ];

  const maintenanceRequests = [
    {
      id: 1,
      title: 'Bathroom Faucet Leak',
      category: 'Plumbing',
      priority: 'Medium',
      status: 'in_progress',
      submittedDate: 'March 5, 2025',
      assignedTo: 'Mike Johnson - Plumber',
    },
    {
      id: 2,
      title: 'Kitchen Light Fixture',
      category: 'Electrical',
      priority: 'Low',
      status: 'pending',
      submittedDate: 'March 8, 2025',
      assignedTo: 'Pending Assignment',
    },
  ];

  const buildingAnnouncements = [
    {
      id: 1,
      title: 'Spring Cleaning Day',
      message: 'Join us for our annual spring cleaning of common areas on March 20th at 9 AM.',
      date: 'March 10, 2025',
      priority: 'medium',
    },
    {
      id: 2,
      title: 'Parking Lot Maintenance',
      message: 'Parking lot will be sealed and painted March 25-26. Please move vehicles by 7 AM.',
      date: 'March 8, 2025',
      priority: 'high',
    },
    {
      id: 3,
      title: 'Board Meeting Minutes Available',
      message: 'February board meeting minutes have been posted in the documents section.',
      date: 'March 5, 2025',
      priority: 'low',
    },
  ];

  const statusBadgeConfig = {
    paid: { className: 'bg-green-100 text-green-800 hover:bg-green-100', label: 'Paid' },
    pending: { className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100', label: 'Pending' },
    overdue: { className: 'bg-red-100 text-red-800 hover:bg-red-100', label: 'Overdue' },
    in_progress: { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100', label: 'In Progress' },
  } as const;

  const getStatusBadge = (status: string) => {
    const config = statusBadgeConfig[status as keyof typeof statusBadgeConfig];
    return config ? <Badge className={config.className}>{config.label}</Badge> : null;
  };

  const priorityColorMap = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-gray-600',
  } as const;

  const getPriorityColor = (priority: string) => {
    return (
      priorityColorMap[priority.toLowerCase() as keyof typeof priorityColorMap] || 'text-gray-600'
    );
  };

  const statusIconMap = {
    in_progress: <Clock className='w-4 h-4 text-blue-600' />,
    completed: <CheckCircle2 className='w-4 h-4 text-green-600' />,
    pending: <AlertCircle className='w-4 h-4 text-yellow-600' />,
  } as const;

  const getRequestStatusIcon = (status: string) => {
    return statusIconMap[status as keyof typeof statusIconMap] || null;
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Resident Dashboard' subtitle='Welcome to your resident portal' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Welcome Section */}
          <div className='bg-gradient-to-r from-koveo-navy to-blue-600 text-white rounded-lg p-6'>
            <div className='flex items-start justify-between'>
              <div>
                <h2 className='text-2xl font-bold'>Welcome Home!</h2>
                <p className='text-blue-100 mt-1'>Here's what's happening in your building</p>
              </div>
              <div className='text-right text-blue-100'>
                <div className='flex items-center space-x-2'>
                  <Building className='w-5 h-5' />
                  <span>{residenceInfo.building}</span>
                </div>
                <div className='flex items-center space-x-2 mt-1'>
                  <Home className='w-4 h-4' />
                  <span>{residenceInfo.unit}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {quickStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={`${stat.title}-${stat.value}`}>
                  <CardContent className='p-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-sm text-gray-600'>{stat.title}</p>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Recent Bills */}
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle>Recent Bills & Payments</CardTitle>
                    <CardDescription>Your billing history and upcoming payments</CardDescription>
                  </div>
                  <Button variant='outline' size='sm' disabled>
                    View All Bills
                    <Badge variant='secondary' className='ml-2 text-xs'>Future</Badge>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {recentBills.map((bill) => (
                    <div
                      key={bill.id}
                      className='flex items-center justify-between p-3 border rounded-lg'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center justify-between'>
                          <h4 className='font-medium'>{bill.description}</h4>
                          {getStatusBadge(bill.status)}
                        </div>
                        <p className='text-sm text-gray-600'>Due: {bill.dueDate}</p>
                        {bill.status === 'paid' && bill.paidDate && (
                          <p className='text-xs text-green-600'>Paid on {bill.paidDate}</p>
                        )}
                      </div>
                      <div className='text-right ml-4'>
                        <p className='font-bold'>{bill.amount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Requests */}
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle>Maintenance Requests</CardTitle>
                    <CardDescription>Your submitted maintenance requests</CardDescription>
                  </div>
                  <Button variant='outline' size='sm' disabled>
                    <Plus className='w-4 h-4 mr-2' />
                    New Request
                    <Badge variant='secondary' className='ml-2 text-xs'>Future</Badge>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {maintenanceRequests.map((request) => (
                    <div key={request.id} className='p-3 border rounded-lg'>
                      <div className='flex items-start justify-between'>
                        <div className='flex items-start space-x-3'>
                          {getRequestStatusIcon(request.status)}
                          <div>
                            <h4 className='font-medium'>{request.title}</h4>
                            <p className='text-sm text-gray-600'>
                              {request.category} • {request.submittedDate}
                            </p>
                            <p className='text-xs text-gray-500'>
                              Assigned to: {request.assignedTo}
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <span
                            className={`text-xs font-medium ${getPriorityColor(request.priority)}`}
                          >
                            {request.priority}
                          </span>
                          <div className='mt-1'>{getStatusBadge(request.status)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Building Announcements */}
          <Card>
            <CardHeader>
              <CardTitle>Building Announcements</CardTitle>
              <CardDescription>Latest news and updates from building management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {buildingAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className='p-4 border rounded-lg hover:bg-gray-50 transition-colors'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center space-x-2'>
                          <h4 className='font-medium'>{announcement.title}</h4>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              {
                                high: 'bg-red-100 text-red-800',
                                medium: 'bg-yellow-100 text-yellow-800',
                                low: 'bg-gray-100 text-gray-800',
                              }[announcement.priority] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {announcement.priority}
                          </span>
                        </div>
                        <p className='text-sm text-gray-600 mt-1'>{announcement.message}</p>
                      </div>
                      <div className='text-sm text-gray-500 ml-4'>{announcement.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and frequently used features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Wrench className='w-6 h-6 text-blue-600' />
                  <span className='text-sm'>Submit Request</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <DollarSign className='w-6 h-6 text-green-600' />
                  <span className='text-sm'>Pay Bills</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <FileText className='w-6 h-6 text-purple-600' />
                  <span className='text-sm'>View Documents</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <Button variant='outline' className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Users className='w-6 h-6 text-orange-600' />
                  <span className='text-sm'>Building Info</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
