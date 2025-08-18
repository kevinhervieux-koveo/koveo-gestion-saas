interface StyledLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export function StyledLayout({ children, currentPath }: StyledLayoutProps) {
  // Just return children - no custom layout needed
  return <>{children}</>;
}