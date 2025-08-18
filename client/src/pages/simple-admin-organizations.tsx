import { useAuth } from '@/hooks/use-auth';
import { Link } from 'wouter';
import { useState } from 'react';

export default function SimpleAdminOrganizations() {
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
        borderLeft: '4px solid #007bff'
      }}>
        <Link href="/simple-dashboard" style={{ textDecoration: 'none', color: '#007bff' }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ margin: '10px 0', color: '#212529' }}>Organizations Management</h1>
        <p style={{ margin: 0, color: '#6c757d' }}>
          Create, view, and manage organizations in the system
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
          background: '#e3f2fd',
          border: '1px solid #90caf9',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>Total Organizations</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1565c0' }}>5</div>
        </div>
        
        <div style={{
          background: '#e8f5e8',
          border: '1px solid #a5d6a7',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>Active Organizations</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2e7d32' }}>4</div>
        </div>
        
        <div style={{
          background: '#fff3e0',
          border: '1px solid #ffcc02',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#f57c00' }}>Total Buildings</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f57c00' }}>23</div>
        </div>
        
        <div style={{
          background: '#fce4ec',
          border: '1px solid #f8bbd9',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#c2185b' }}>Total Users</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c2185b' }}>127</div>
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
          {showCreateForm ? 'Cancel' : '+ Create Organization'}
        </button>
        
        <button style={{
          padding: '12px 24px',
          background: '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Export Data
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
          <h3 style={{ margin: '0 0 20px 0' }}>Create New Organization</h3>
          <form style={{ display: 'grid', gap: '15px', maxWidth: '600px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Organization Name:
              </label>
              <input 
                type="text" 
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px'
                }}
                placeholder="Enter organization name"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Type:
              </label>
              <select style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ced4da',
                borderRadius: '4px'
              }}>
                <option value="">Select type</option>
                <option value="condo">Condominium</option>
                <option value="coop">Cooperative</option>
                <option value="rental">Rental Property</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Address:
              </label>
              <input 
                type="text" 
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px'
                }}
                placeholder="Enter full address"
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  City:
                </label>
                <input 
                  type="text" 
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                  placeholder="City"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Postal Code:
                </label>
                <input 
                  type="text" 
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                  placeholder="H0H 0H0"
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Contact Email:
                </label>
                <input 
                  type="email" 
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ced4da',
                    borderRadius: '4px'
                  }}
                  placeholder="contact@organization.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Contact Phone:
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
                Create Organization
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

      {/* Organizations List */}
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
          <h3 style={{ margin: 0 }}>Organizations List</h3>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr 100px',
            gap: '15px',
            padding: '10px 0',
            borderBottom: '2px solid #dee2e6',
            fontWeight: 'bold',
            color: '#495057'
          }}>
            <div>Name</div>
            <div>Type</div>
            <div>Address</div>
            <div>Status</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          
          {/* Sample Data */}
          {[
            { name: 'Résidence du Parc', type: 'Condo', address: '123 Rue Principale, Montréal', status: 'Active', created: '2023-01-15' },
            { name: 'Le Château', type: 'Coop', address: '456 Ave des Érables, Québec', status: 'Active', created: '2023-02-20' },
            { name: 'Villa Moderne', type: 'Rental', address: '789 Boul. Saint-Laurent, Laval', status: 'Active', created: '2023-03-10' },
            { name: 'Les Jardins', type: 'Condo', address: '321 Rue de la Paix, Gatineau', status: 'Inactive', created: '2023-04-05' },
            { name: 'Tour Horizon', type: 'Condo', address: '654 Ave du Mont-Royal, Montréal', status: 'Active', created: '2023-05-12' }
          ].map((org, index) => (
            <div key={index} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr 100px',
              gap: '15px',
              padding: '15px 0',
              borderBottom: '1px solid #f1f3f4',
              alignItems: 'center'
            }}>
              <div style={{ fontWeight: '500' }}>{org.name}</div>
              <div>{org.type}</div>
              <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>{org.address}</div>
              <div>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  background: org.status === 'Active' ? '#d4edda' : '#f8d7da',
                  color: org.status === 'Active' ? '#155724' : '#721c24'
                }}>
                  {org.status}
                </span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>{org.created}</div>
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