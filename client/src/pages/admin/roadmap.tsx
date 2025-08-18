import { MapPin, Filter, Clock, CheckCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function Roadmap() {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const roadmapItems = [
    {
      id: 1,
      title: 'Enhanced Mobile Application',
      description: 'Native mobile apps for iOS and Android with offline capabilities and push notifications.',
      status: 'in-progress',
      quarter: 'Q1 2025',
      votes: 89,
      completion: 65
    },
    {
      id: 2,
      title: 'AI-Powered Maintenance Predictions',
      description: 'Machine learning algorithms to predict maintenance needs and optimize scheduling.',
      status: 'planned',
      quarter: 'Q2 2025',
      votes: 124,
      completion: 0
    },
    {
      id: 3,
      title: 'Advanced Financial Analytics',
      description: 'Comprehensive financial reporting with forecasting and budget optimization tools.',
      status: 'completed',
      quarter: 'Q4 2024',
      votes: 156,
      completion: 100
    },
    {
      id: 4,
      title: 'Integration with Quebec Government APIs',
      description: 'Direct integration with provincial databases for regulatory compliance and reporting.',
      status: 'research',
      quarter: 'Q3 2025',
      votes: 203,
      completion: 5
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Circle className="h-5 w-5 text-blue-500" />;
      case 'planned':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'planned':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Product Roadmap</h1>
            <p className="mt-1 text-sm text-gray-600">Upcoming features and development timeline</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Workspace</span>
            <span className="text-sm font-medium text-green-600">Active</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
            <div className="flex gap-2">
              {['all', 'completed', 'in-progress', 'planned', 'research'].map((filter) => (
                <Button
                  key={filter}
                  variant={selectedFilter === filter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter(filter)}
                  className="capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Roadmap Items */}
        <div className="space-y-4">
          {roadmapItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {getStatusIcon(item.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{item.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {item.quarter}
                      </span>
                      <span>{item.votes} votes</span>
                      {item.completion > 0 && (
                        <span>{item.completion}% complete</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    Vote
                  </Button>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
              
              {item.completion > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{item.completion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.completion}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}