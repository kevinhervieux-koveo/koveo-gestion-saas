import { Book, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Documentation() {
  const documentationSections = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of using Koveo Gestion',
      icon: '🚀',
      items: [
        'Quick Start Guide',
        'User Account Setup', 
        'Navigation Overview',
        'First Organization'
      ]
    },
    {
      title: 'Property Management',
      description: 'Manage buildings, residents, and operations',
      icon: '🏢',
      items: [
        'Creating Organizations',
        'Building Setup',
        'Resident Management',
        'Maintenance Requests'
      ]
    },
    {
      title: 'Financial Management',
      description: 'Budgeting, billing, and financial reporting',
      icon: '💰',
      items: [
        'Budget Planning',
        'Bill Generation',
        'Payment Tracking',
        'Financial Reports'
      ]
    },
    {
      title: 'Quebec Compliance',
      description: 'Law 25 and regulatory requirements',
      icon: '⚖️',
      items: [
        'Privacy Protection',
        'Data Compliance',
        'Audit Logging',
        'Legal Requirements'
      ]
    }
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Documentation</h1>
            <p className="mt-1 text-sm text-gray-600">Comprehensive guides and API documentation</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {documentationSections.map((section, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{section.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
                    <span className="text-sm text-gray-700">{item}</span>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Book className="h-5 w-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View Full Documentation
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              API Reference
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}