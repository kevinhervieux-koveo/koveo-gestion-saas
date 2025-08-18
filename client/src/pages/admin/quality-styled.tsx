import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { useState } from 'react';

export default function QualityStyled() {
  const { user } = useAuth();
  const [selectedMetric, setSelectedMetric] = useState('overview');

  const qualityMetrics = {
    overview: {
      score: 92,
      tests: { passed: 76, total: 76 },
      coverage: 85,
      performance: 'Excellent',
      security: 'High',
      accessibility: 'AA Compliant'
    },
    codeQuality: {
      complexity: 6.2,
      maintainability: 'A',
      duplicateCode: '2.1%',
      codeSmells: 3,
      technicalDebt: '4h 30m'
    },
    testing: {
      unitTests: 45,
      integrationTests: 23,
      e2eTests: 8,
      lastRun: '2 minutes ago',
      failureRate: '0%'
    },
    performance: {
      loadTime: '1.2s',
      firstPaint: '0.8s',
      interactivity: '1.5s',
      cumulativeShift: '0.05',
      lighthouse: 94
    }
  };

  const recentIssues = [
    {
      id: 1,
      type: 'warning',
      title: 'Unused Import Detected',
      file: 'client/src/utils/validation.ts',
      line: 15,
      severity: 'Low',
      status: 'Open'
    },
    {
      id: 2,
      type: 'info',
      title: 'Performance Optimization Available',
      file: 'client/src/pages/admin/organizations.tsx',
      line: 45,
      severity: 'Medium',
      status: 'Open'
    },
    {
      id: 3,
      type: 'success',
      title: 'Security Vulnerability Fixed',
      file: 'server/auth/password-utils.ts',
      line: 23,
      severity: 'High',
      status: 'Resolved'
    }
  ];

  const getMetricColor = (value: number, type: 'score' | 'coverage' | 'performance') => {
    if (type === 'score' || type === 'coverage') {
      if (value >= 90) return '#10b981';
      if (value >= 75) return '#f59e0b';
      return '#dc2626';
    }
    return '#3b82f6';
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  };

  const getIssueColor = (severity: string) => {
    switch (severity) {
      case 'High': return { bg: '#fef2f2', text: '#dc2626' };
      case 'Medium': return { bg: '#fffbeb', text: '#f59e0b' };
      case 'Low': return { bg: '#f0fdf4', text: '#10b981' };
      default: return { bg: '#f8fafc', text: '#6b7280' };
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#f8fafc',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '280px',
        background: 'white',
        borderRight: '1px solid #e2e8f0',
        padding: '1.5rem',
        overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold'
          }}>
            K
          </div>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#1f2937'
          }}>
            KOVEO
          </span>
        </div>

        {/* Navigation */}
        <nav>
          <Link href="/dashboard">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              color: '#4b5563',
              textDecoration: 'none',
              marginBottom: '0.5rem',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
              <span>🏠</span>
              Dashboard
            </div>
          </Link>

          <div style={{
            color: '#9ca3af',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '1rem 0 0.5rem',
            padding: '0 0.75rem'
          }}>
            Admin
          </div>

          {[
            { icon: '🏢', label: 'Organizations', href: '/admin/organizations' },
            { icon: '📚', label: 'Documentation', href: '/admin/documentation' },
            { icon: '🗺️', label: 'Roadmap', href: '/admin/roadmap' },
            { icon: '✅', label: 'Quality Assurance', href: '/admin/quality', active: true },
            { icon: '🔐', label: 'RBAC Permissions', href: '/admin/permissions' }
          ].map((item, index) => (
            <Link key={index} href={item.href}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: item.active ? '#eff6ff' : 'transparent',
                color: item.active ? '#3b82f6' : '#4b5563',
                textDecoration: 'none',
                marginBottom: '0.5rem',
                cursor: 'pointer',
                fontWeight: item.active ? '500' : 'normal'
              }}
              onMouseOver={(e) => !item.active && (e.currentTarget.style.background = '#f1f5f9')}
              onMouseOut={(e) => !item.active && (e.currentTarget.style.background = 'transparent')}>
                <span>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '2rem',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '2rem'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            Quality Assurance Dashboard
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '1.125rem'
          }}>
            Code quality, testing, and performance metrics for Koveo Gestion
          </p>
        </div>

        {/* Quality Score Card */}
        <div style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          borderRadius: '0.75rem',
          padding: '2rem',
          marginBottom: '2rem',
          color: 'white'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Overall Quality Score
              </h2>
              <div style={{
                fontSize: '3rem',
                fontWeight: 'bold',
                marginBottom: '0.5rem'
              }}>
                {qualityMetrics.overview.score}/100
              </div>
              <p style={{
                opacity: 0.9
              }}>
                Excellent - Above industry standards
              </p>
            </div>
            <div style={{
              fontSize: '4rem',
              opacity: 0.8
            }}>
              🏆
            </div>
          </div>
        </div>

        {/* Metric Tabs */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'codeQuality', label: 'Code Quality', icon: '🔍' },
              { key: 'testing', label: 'Testing', icon: '🧪' },
              { key: 'performance', label: 'Performance', icon: '⚡' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedMetric(tab.key)}
                style={{
                  background: selectedMetric === tab.key ? '#3b82f6' : '#f8fafc',
                  color: selectedMetric === tab.key ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  if (selectedMetric !== tab.key) {
                    e.currentTarget.style.background = '#eff6ff';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedMetric !== tab.key) {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Display */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {selectedMetric === 'overview' && [
            { label: 'Test Coverage', value: `${qualityMetrics.overview.coverage}%`, icon: '🧪', type: 'coverage' },
            { label: 'Tests Passing', value: `${qualityMetrics.overview.tests.passed}/${qualityMetrics.overview.tests.total}`, icon: '✅', type: 'score' },
            { label: 'Performance', value: qualityMetrics.overview.performance, icon: '⚡', type: 'text' },
            { label: 'Security Level', value: qualityMetrics.overview.security, icon: '🔒', type: 'text' }
          ].map((metric, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{metric.icon}</span>
                <span style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {metric.label}
                </span>
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: typeof metric.value === 'string' && metric.value.includes('%') 
                  ? getMetricColor(parseInt(metric.value), 'coverage')
                  : '#1f2937'
              }}>
                {metric.value}
              </div>
            </div>
          ))}

          {selectedMetric === 'codeQuality' && [
            { label: 'Complexity Score', value: qualityMetrics.codeQuality.complexity, icon: '📈', suffix: '/10' },
            { label: 'Maintainability', value: qualityMetrics.codeQuality.maintainability, icon: '🔧', suffix: '' },
            { label: 'Code Duplication', value: qualityMetrics.codeQuality.duplicateCode, icon: '📋', suffix: '' },
            { label: 'Technical Debt', value: qualityMetrics.codeQuality.technicalDebt, icon: '⏰', suffix: '' }
          ].map((metric, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{metric.icon}</span>
                <span style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {metric.label}
                </span>
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                {metric.value}{metric.suffix}
              </div>
            </div>
          ))}

          {selectedMetric === 'testing' && [
            { label: 'Unit Tests', value: qualityMetrics.testing.unitTests, icon: '🔬', suffix: ' tests' },
            { label: 'Integration Tests', value: qualityMetrics.testing.integrationTests, icon: '🔗', suffix: ' tests' },
            { label: 'E2E Tests', value: qualityMetrics.testing.e2eTests, icon: '🌐', suffix: ' tests' },
            { label: 'Failure Rate', value: qualityMetrics.testing.failureRate, icon: '📊', suffix: '' }
          ].map((metric, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{metric.icon}</span>
                <span style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {metric.label}
                </span>
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                {metric.value}{metric.suffix}
              </div>
            </div>
          ))}

          {selectedMetric === 'performance' && [
            { label: 'Load Time', value: qualityMetrics.performance.loadTime, icon: '⚡', suffix: '' },
            { label: 'First Paint', value: qualityMetrics.performance.firstPaint, icon: '🎨', suffix: '' },
            { label: 'Interactivity', value: qualityMetrics.performance.interactivity, icon: '👆', suffix: '' },
            { label: 'Lighthouse Score', value: qualityMetrics.performance.lighthouse, icon: '🏠', suffix: '/100' }
          ].map((metric, index) => (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #f3f4f6'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>{metric.icon}</span>
                <span style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {metric.label}
                </span>
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: '#1f2937'
              }}>
                {metric.value}{metric.suffix}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Issues */}
        <div style={{
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #f3f4f6'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🔍 Recent Quality Issues
          </h2>
          
          <div style={{
            display: 'grid',
            gap: '1rem'
          }}>
            {recentIssues.map((issue) => {
              const colors = getIssueColor(issue.severity);
              return (
                <div key={issue.id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <span>{getIssueIcon(issue.type)}</span>
                      <h3 style={{
                        fontWeight: '500',
                        color: '#1f2937'
                      }}>
                        {issue.title}
                      </h3>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        background: colors.bg,
                        color: colors.text,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {issue.severity}
                      </div>
                      <div style={{
                        background: issue.status === 'Resolved' ? '#ecfdf5' : '#fef3c7',
                        color: issue.status === 'Resolved' ? '#059669' : '#d97706',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {issue.status}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    color: '#6b7280',
                    fontSize: '0.875rem'
                  }}>
                    {issue.file}:{issue.line}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}