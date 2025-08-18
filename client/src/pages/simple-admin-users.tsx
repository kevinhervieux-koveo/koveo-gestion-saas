import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { useState } from 'react';

export default function SimpleAdminUsers() {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!user || user.role !== 'admin') {
    return (
      <div style={{ padding: '20px', background: '#ffffff', minHeight: '100vh' }}>
        <h1>Access Denied</h1>
        <p>You need admin privileges to access this page.</p>
        <Link href="/simple-dashboard">
          <button style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Back to Dashboard
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', background: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        borderLeft: '4px solid #28a745'
      }}>
        <Link href="/simple-dashboard" style={{ textDecoration: 'none', color: '#28a745' }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ margin: '10px 0', color: '#212529' }}>User Management</h1>
        <p style={{ margin: 0, color: '#6c757d' }}>
          Create, view, and manage users and their permissions
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: '#e8f5e8',
          border: '1px solid #a5d6a7',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>Total Users</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2e7d32' }}>127</div>
        </div>
        
        <div style={{
          background: '#e3f2fd',
          border: '1px solid #90caf9',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>Active Users</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1565c0' }}>115</div>
        </div>
        
        <div style={{
          background: '#fff3e0',
          border: '1px solid #ffcc02',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#f57c00' }}>Admins</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f57c00' }}>3</div>
        </div>
        
        <div style={{
          background: '#fce4ec',
          border: '1px solid #f8bbd9',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#c2185b' }}>Managers</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c2185b' }}>12</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '12px 24px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Create User'}
        </button>
        
        <button style={{
          padding: '12px 24px',
          background: '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginRight: '10px'
        }}>
          Export Users
        </button>

        <button style={{
          padding: '12px 24px',
          background: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Bulk Actions
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <h3 style={{ margin: '0 0 20px 0' }}>Create New User</h3>
          <form style={{ display: 'grid', gap: '15px', maxWidth: '600px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  First Name:
                </label>
                <input 
                  type="text" 
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                  placeholder="First name"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Last Name:
                </label>
                <input 
                  type="text" 
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                  placeholder="Last name"
                />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Email:
              </label>
              <input 
                type="email" 
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px'
                }}
                placeholder="user@example.com"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Role:
              </label>
              <select style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px'
              }}>
                <option value="">Select role</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="tenant">Tenant</option>
                <option value="resident">Resident</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Organization:
              </label>
              <select style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px'
              }}>
                <option value="">Select organization</option>
                <option value="1">Résidence du Parc</option>
                <option value="2">Le Château</option>
                <option value="3">Villa Moderne</option>
                <option value="4">Les Jardins</option>
                <option value="5">Tour Horizon</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Phone:
              </label>
              <input 
                type="tel" 
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px'
                }}
                placeholder="(514) 123-4567"
              />
            </div>
            
            <div style={{ marginTop: '10px' }}>
              <button 
                type="submit"
                style={{
                  padding: '12px 24px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                Create User
              </button>
              <button 
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '12px 24px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{
          background: '#f8f9fa',
          padding: '15px 20px',
          borderBottom: '1px solid #dee2e6'
        }}>
          <h3 style={{ margin: 0 }}>Users List</h3>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr 100px',
            gap: '15px',
            padding: '10px 0',
            borderBottom: '2px solid #dee2e6',
            fontWeight: 'bold',
            color: '#495057'
          }}>
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Organization</div>
            <div>Status</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          
          {/* Sample Data */}
          {[
            { name: 'Jean Dupuis', email: 'jean.dupuis@email.com', role: 'Admin', org: 'System', status: 'Active', created: '2023-01-15' },
            { name: 'Marie Tremblay', email: 'marie.tremblay@email.com', role: 'Manager', org: 'Résidence du Parc', status: 'Active', created: '2023-02-20' },
            { name: 'Pierre Leblanc', email: 'pierre.leblanc@email.com', role: 'Tenant', org: 'Le Château', status: 'Active', created: '2023-03-10' },
            { name: 'Sophie Martin', email: 'sophie.martin@email.com', role: 'Resident', org: 'Villa Moderne', status: 'Inactive', created: '2023-04-05' },
            { name: 'Michel Bouchard', email: 'michel.bouchard@email.com', role: 'Manager', org: 'Les Jardins', status: 'Active', created: '2023-05-12' }
          ].map((userItem, index) => (
            <div key={index} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 1fr 100px',
              gap: '15px',
              padding: '15px 0',
              borderBottom: '1px solid #f1f3f4',
              alignItems: 'center'
            }}>
              <div style={{ fontWeight: '500' }}>{userItem.name}</div>
              <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>{userItem.email}</div>
              <div>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  background: userItem.role === 'Admin' ? '#ffeaa7' : userItem.role === 'Manager' ? '#a8e6cf' : '#ddd',
                  color: userItem.role === 'Admin' ? '#d63031' : userItem.role === 'Manager' ? '#00b894' : '#636e72'
                }}>
                  {userItem.role}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem' }}>{userItem.org}</div>
              <div>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  background: userItem.status === 'Active' ? '#d4edda' : '#f8d7da',
                  color: userItem.status === 'Active' ? '#155724' : '#721c24'
                }}>
                  {userItem.status}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>{userItem.created}</div>
              <div>
                <button style={{
                  padding: '4px 8px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}>
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}