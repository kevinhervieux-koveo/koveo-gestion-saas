interface StyledLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export function StyledLayout({ children, currentPath }: StyledLayoutProps) {
  // This layout is now just a content wrapper that works with the main App.tsx sidebar
  return (
    <div style={{
      padding: '1.5rem',
      maxWidth: '100%',
      background: '#f8fafc',
      minHeight: '100vh'
    }}>
      {children}
    </div>
  );
}