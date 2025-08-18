import { useState } from 'react';
import { StyledStatsCard, StyledCard } from '@/components/common';
import { Header } from '@/components/layout/header';
import { typography, colors } from '@/styles/inline-styles';

export default function OrganizationsStyled() {
  const [refreshCommand] = useState('npm run validate:quick');

  // Mock data for now - in real app this would come from API
  const stats = {
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 4,
    propertyAdmins: 4
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title="Admin Dashboard"
        subtitle="Property management overview and insights"
      />
      <div style={{padding: '1.5rem'}}>

      {/* Refresh Command */}
      <StyledCard>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ color: colors.gray[500] }}>⚡ Refresh Command:</span>
          <code style={{
            background: colors.gray[200],
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            color: colors.gray[800]
          }}>
            {refreshCommand}
          </code>
        </div>
      </StyledCard>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
        marginTop: '2rem'
      }}>
        <StyledStatsCard 
          label="Total Organizations" 
          value={stats.totalOrganizations} 
          icon="🏢"
          color={colors.primary}
        />
        <StyledStatsCard 
          label="Active Organizations" 
          value={stats.activeOrganizations} 
          icon="💰"
          color={colors.secondary}
        />
        <StyledStatsCard 
          label="Total Users" 
          value={stats.totalUsers} 
          icon="👥"
          color={colors.gray[500]}
        />
        <StyledStatsCard 
          label="Property Admins" 
          value={stats.propertyAdmins} 
          icon="👨‍💼"
          color={colors.primary}
        />
      </div>

      {/* Organizations Section */}
      <StyledCard>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🏢</span>
          <h2 style={typography.heading3}>
            Organizations
          </h2>
        </div>
        
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: colors.gray[500]
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            opacity: 0.3
          }}>
            🏢
          </div>
          <p style={{
            fontSize: '1.125rem',
            marginBottom: '1rem'
          }}>
            No organizations found
          </p>
          <p style={typography.small}>
            Create your first organization to get started with property management.
          </p>
        </div>
      </StyledCard>
      </div>
    </div>
  );
}