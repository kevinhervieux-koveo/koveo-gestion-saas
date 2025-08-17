import * as React from 'react';

declare module '@/components/layout/header' {
  export const Header: React.ComponentType<any>;
  export default Header;
}

declare module '@/components/layout/sidebar' {  
  export const Sidebar: React.ComponentType<any>;
  export default Sidebar;
}

declare module '@/pages/owner/dashboard' {
  const OwnerDashboard: React.ComponentType<any>;
  export default OwnerDashboard;
}