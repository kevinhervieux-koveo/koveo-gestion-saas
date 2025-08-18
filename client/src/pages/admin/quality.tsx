import { Shield, CheckCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Quality() {
  const qualityMetrics = {
    overview: {
      score: 92,
      tests: { passed: 76, total: 76 },
      coverage: 85,
      performance: 'Excellent',
      security: 'High',
      accessibility: 'AA Compliant'
    }
  };

  const recentIssues = [
    {
      id: 1,
      type: 'warning',
      title: 'Unused Import Detected',
      file: 'client/src/utils/validation.ts',
      severity: 'Low',
      status: 'Open'
    },
    {
      id: 2,
      type: 'info',
      title: 'Performance Optimization Available',
      file: 'client/src/pages/admin/organizations.tsx',
      severity: 'Medium',
      status: 'Open'
    },
    {
      id: 3,
      type: 'success',
      title: 'Security Vulnerability Fixed',
      file: 'server/auth/password-utils.ts',
      severity: 'High',
      status: 'Resolved'
    }
  ];

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
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
            <h1 className="text-2xl font-semibold text-gray-900">Quality Assurance</h1>
            <p className="mt-1 text-sm text-gray-600">Code quality metrics and system health</p>
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
        {/* Quality Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-600">Quality Score</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{qualityMetrics.overview.score}/100</div>
            <div className="text-sm text-green-600">Excellent</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-600">Test Coverage</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{qualityMetrics.overview.coverage}%</div>
            <div className="text-sm text-gray-600">
              {qualityMetrics.overview.tests.passed}/{qualityMetrics.overview.tests.total} tests passing
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-600">Security</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{qualityMetrics.overview.security}</div>
            <div className="text-sm text-green-600">No vulnerabilities</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium text-gray-600">Performance</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{qualityMetrics.overview.performance}</div>
            <div className="text-sm text-green-600">Load time: 1.2s</div>
          </div>
        </div>

        {/* Recent Issues */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-900">Recent Issues</h2>
            </div>
            <Button variant="outline" size="sm">
              View All Issues
            </Button>
          </div>

          <div className="divide-y divide-gray-200">
            {recentIssues.map((issue) => (
              <div key={issue.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {getIssueIcon(issue.type)}
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">{issue.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{issue.file}</p>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span className="text-xs text-gray-500">{issue.status}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}