/**
 * Simple AuthenticatedRoutesWrapper replacement for SDK v5
 * Redirects to unlock route if user is not authenticated
 */
import { ReactNode } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useNavigate, useLocation } from 'react-router-dom';

interface RouteType {
  path: string;
  title?: string;
  authenticated?: boolean;
  authenticatedRoute?: boolean;
  component?: () => ReactNode;
  children?: ReactNode;
}

interface AuthenticatedRoutesWrapperProps {
  routes: RouteType[];
  unlockRoute: string;
  children: ReactNode;
}

export const AuthenticatedRoutesWrapper = ({
  routes,
  unlockRoute,
  children
}: AuthenticatedRoutesWrapperProps) => {
  const account = useGetAccount();
  const address = account.address;
  const navigate = useNavigate();
  const location = useLocation();

  // If user is not logged in and tries to access a protected route, redirect to unlock
  if (!address) {
    // Check if we're already on the unlock route - don't redirect again
    if (location.pathname === '/unlock' || location.pathname === '/') {
      return <>{children}</>;
    }

    // Check if current path requires authentication
    const currentRoute = routes.find(route => 
      location.pathname === route.path || location.pathname.startsWith(route.path + '/')
    );
    
    if (currentRoute?.authenticatedRoute !== false) {
      // Redirect to unlock with return path
      navigate(unlockRoute, { replace: true });
      return null;
    }
  }

  return <>{children}</>;
};

export default AuthenticatedRoutesWrapper;