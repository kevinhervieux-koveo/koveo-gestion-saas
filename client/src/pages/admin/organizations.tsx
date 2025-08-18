import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Organizations() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Organizations Management</h1>
            <p className="mt-1 text-sm text-gray-600">Create, view, edit and delete organizations in the system</p>
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
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Section Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Organizations</h2>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>

          {/* Empty State */}
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations found</h3>
            <p className="text-gray-500 text-center mb-6 max-w-md">
              Create your first organization to get started with property management.
            </p>
            <Button 
              variant="outline" 
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Create First Organization
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}