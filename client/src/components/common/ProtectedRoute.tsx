import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { hasRoleOrHigher } from '@/config/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
  requiredRole: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const hasAccess = hasRoleOrHigher(user?.role, requiredRole);

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      setLocation('/dashboard/overview');
    }
  }, [isLoading, user, hasAccess, setLocation]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!hasAccess) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
