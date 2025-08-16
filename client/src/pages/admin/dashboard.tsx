import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, DollarSign, Users, FileText, AlertCircle, Terminal, Plus } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery } from '@tanstack/react-query';
// import { OrganizationForm } from '@/components/forms'; // Temporarily disabled
import type { Organization, User } from '@shared/schema';

/**
 *
 */
export default function Dashboard() {
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false);

  // Force show that this component is loading
  React.useEffect(() => {
    console.log('🔥 NEW ADMIN DASHBOARD COMPONENT LOADED! 🔥');
  }, []);

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='🔥 TEST MODE - ADMIN DASHBOARD 🔥' subtitle='🚨 IF YOU SEE THIS THE PAGE IS WORKING 🚨' />
      
      {/* SIMPLE TEST - Just text */}
      <div style={{background: 'red', color: 'white', padding: '20px', fontSize: '24px', textAlign: 'center'}}>
        🔴 ADMIN DASHBOARD TEST - CAN YOU SEE THIS? 🔴
      </div>
      
      {/* TEST BUTTON */}
      <div style={{background: 'blue', padding: '20px', textAlign: 'center'}}>
        <Button
          onClick={() => setIsOrganizationDialogOpen(true)}
          style={{background: 'green', color: 'white', padding: '20px', fontSize: '20px'}}
        >
          🏢 CREATE ORGANIZATION BUTTON 🏢
        </Button>
      </div>
    </div>
  );
}
