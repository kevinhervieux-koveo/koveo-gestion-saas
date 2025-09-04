import * as React from 'react';

declare module '@/components/layout/header' {
  export const Header: React.ComponentType<Record<string, unknown>>;
  export default Header;
}

declare module '@/components/layout/sidebar' {
  export const Sidebar: React.ComponentType<Record<string, unknown>>;
  export default Sidebar;
}

declare module '@/pages/owner/dashboard' {
  const OwnerDashboard: React.ComponentType<Record<string, unknown>>;
  export default OwnerDashboard;
}
