import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { useState } from 'react';

export default function RoadmapStyled() {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const roadmapItems = [
    {
      id: 1,
      title: 'Enhanced Mobile Application',
      description: 'Native mobile apps for iOS and Android with offline capabilities and push notifications.',
      status: 'in-progress',
      category: 'mobile',
      priority: 'high',
      quarter: 'Q1 2025',
      votes: 89,
      completion: 65
    },
    {
      id: 2,
      title: 'AI-Powered Maintenance Predictions',
      description: 'Machine learning algorithms to predict maintenance needs and optimize scheduling.',
      status: 'planned',
      category: 'ai',
      priority: 'medium',
      quarter: 'Q2 2025',
      votes: 124,
      completion: 0
    },
    {
      id: 3,
      title: 'Advanced Financial Analytics',
      description: 'Comprehensive financial reporting with forecasting and budget optimization tools.',
      status: 'completed',
      category: 'finance',
      priority: 'high',
      quarter: 'Q4 2024',
      votes: 156,
      completion: 100
    },
    {
      id: 4,
      title: 'Integration with Quebec Government APIs',
      description: 'Direct integration with provincial databases for regulatory compliance and reporting.',
      status: 'research',
      category: 'compliance',
      priority: 'high',
      quarter: 'Q3 2025',
      votes: 203,
      completion: 5
    },
    {
      id: 5,
      title: 'Multi-language Support Enhancement',
      description: 'Extended language support beyond French and English, including Indigenous languages.',
      status: 'planned',
      category: 'localization',
      priority: 'medium',
      quarter: 'Q2 2025',
      votes: 67,
      completion: 0
    },
    {
      id: 6,
      title: 'Real-time Communication Platform',
      description: 'Integrated chat system for residents, managers, and service providers.',
      status: 'in-progress',
      category: 'communication',
      priority: 'medium',
      quarter: 'Q1 2025',
      votes: 98,
      completion: 30
    }
  ];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: '#10b981', bg: '#ecfdf5', label: 'Completed' };
      case 'in-progress':
        return { color: '#3b82f6', bg: '#eff6ff', label: 'In Progress' };
      case 'planned':
        return { color: '#f59e0b', bg: '#fffbeb', label: 'Planned' };
      case 'research':
        return { color: '#8b5cf6', bg: '#f3e8ff', label: 'Research' };
      default:
        return { color: '#6b7280', bg: '#f9fafb', label: 'Unknown' };
    }
  };

  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case 'high':
        return { color: '#dc2626', bg: '#fef2f2', label: 'High' };
      case 'medium':
        return { color: '#f59e0b', bg: '#fffbeb', label: 'Medium' };
      case 'low':
        return { color: '#10b981', bg: '#ecfdf5', label: 'Low' };
      default:
        return { color: '#6b7280', bg: '#f9fafb', label: 'Unknown' };
    }
  };

  const filteredItems = roadmapItems.filter(item => {
    if (selectedFilter === 'all') return true;
    return item.status === selectedFilter;
  });

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
            { icon: '🗺️', label: 'Roadmap', href: '/admin/roadmap', active: true },
            { icon: '✅', label: 'Quality Assurance', href: '/admin/quality' },
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
            Product Roadmap
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '1.125rem'
          }}>
            Discover what's coming next in Koveo Gestion's evolution
          </p>
        </div>

        {/* Filter Tabs */}
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
              { key: 'all', label: 'All', count: roadmapItems.length },
              { key: 'completed', label: 'Completed', count: roadmapItems.filter(i => i.status === 'completed').length },
              { key: 'in-progress', label: 'In Progress', count: roadmapItems.filter(i => i.status === 'in-progress').length },
              { key: 'planned', label: 'Planned', count: roadmapItems.filter(i => i.status === 'planned').length },
              { key: 'research', label: 'Research', count: roadmapItems.filter(i => i.status === 'research').length }
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setSelectedFilter(filter.key)}
                style={{
                  background: selectedFilter === filter.key ? '#3b82f6' : '#f8fafc',
                  color: selectedFilter === filter.key ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  if (selectedFilter !== filter.key) {
                    e.currentTarget.style.background = '#eff6ff';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedFilter !== filter.key) {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
              >
                {filter.label}
                <span style={{
                  background: selectedFilter === filter.key ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                  borderRadius: '1rem',
                  padding: '0.125rem 0.5rem',
                  fontSize: '0.75rem',
                  minWidth: '1.5rem',
                  textAlign: 'center'
                }}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Roadmap Items */}
        <div style={{
          display: 'grid',
          gap: '1.5rem'
        }}>
          {filteredItems.map((item) => {
            const statusInfo = getStatusInfo(item.status);
            const priorityInfo = getPriorityInfo(item.priority);
            
            return (
              <div key={item.id} style={{
                background: 'white',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #f3f4f6',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '0.5rem'
                    }}>
                      {item.title}
                    </h3>
                    <p style={{
                      color: '#6b7280',
                      lineHeight: '1.6',
                      marginBottom: '1rem'
                    }}>
                      {item.description}
                    </p>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    marginLeft: '1rem'
                  }}>
                    <div style={{
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {statusInfo.label}
                    </div>
                    <div style={{
                      background: priorityInfo.bg,
                      color: priorityInfo.color,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {priorityInfo.label} Priority
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                {item.completion > 0 && (
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#6b7280'
                      }}>
                        Progress
                      </span>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#3b82f6'
                      }}>
                        {item.completion}%
                      </span>
                    </div>
                    <div style={{
                      background: '#f1f5f9',
                      borderRadius: '1rem',
                      height: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                        height: '100%',
                        width: `${item.completion}%`,
                        borderRadius: '1rem',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                  </div>
                )}
                
                {/* Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      🗓️ {item.quarter}
                    </span>
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280'
                    }}>
                      📊 {item.category}
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#f8fafc',
                    borderRadius: '0.5rem',
                    padding: '0.375rem 0.75rem'
                  }}>
                    <span style={{ fontSize: '0.875rem' }}>👍</span>
                    <span style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#1f2937'
                    }}>
                      {item.votes}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Call to Action */}
        <div style={{
          marginTop: '3rem',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          borderRadius: '0.75rem',
          padding: '2rem',
          textAlign: 'center',
          color: 'white'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            Have a Feature Request?
          </h2>
          <p style={{
            marginBottom: '1.5rem',
            opacity: 0.9
          }}>
            Your feedback shapes our roadmap. Share your ideas and vote on upcoming features.
          </p>
          <Link href="/admin/suggestions">
            <div style={{
              background: 'white',
              color: '#3b82f6',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-block',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,255,255,0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              Submit Feature Request
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}