import { ReactNode, useState, useEffect, useRef } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { AuthenticatedRoutesWrapper } from 'components/AuthenticatedRoutesWrapper';
import { LoadingScreen } from 'components/LoadingScreen';

import { useLocation } from 'react-router-dom';
import routes, { routeNames } from 'routes';

import { Navbar } from './components/Navbar';
import { BottomNav } from 'components/BottomNav';
import { TelegramBubble } from 'components/TelegramBubble';
import useGlobalData from 'hooks/useGlobalData';
import { usePreloadData } from 'hooks/usePreloadData';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { search } = useLocation();
  const account = useGetAccount();
  const address = account.address;
  
  // Track if initial data is loading - wait for data to actually be ready
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  // Pre-fetch all data at login for better UX
  useGlobalData();
  const { isLoading: preloaderLoading } = usePreloadData();

  // Check if all critical data is loaded
  useEffect(() => {
    if (!address || hasLoadedRef.current) return;
    
    const minShowTime = 4000; // Show for at least 4 seconds
    
    // After minimum time, check if preloader is done - if not, keep showing
    const checkDataReady = setTimeout(() => {
      if (preloaderLoading === false) {
        // Data loaded, hide loading screen
        hasLoadedRef.current = true;
        setIsInitialLoading(false);
      }
      // If preloader still loading, don't hide - keep showing until it finishes or timeout
    }, minShowTime);
    
    // Max wait time
    const timeoutFallback = setTimeout(() => {
      hasLoadedRef.current = true;
      setIsInitialLoading(false);
    }, 10000); // 10 second max
    
    // Also watch for preloader to finish after minimum time
    if (preloaderLoading === false && hasLoadedRef.current === false) {
      clearTimeout(checkDataReady);
      hasLoadedRef.current = true;
      setIsInitialLoading(false);
    }
    
    return () => {
      clearTimeout(checkDataReady);
      clearTimeout(timeoutFallback);
    };
  }, [address, preloaderLoading, isInitialLoading]);

  // Reset loading state on address change (new login)
  useEffect(() => {
    if (address) {
      hasLoadedRef.current = false;
      setIsInitialLoading(true);
    }
  }, [address]);

  // Show loading while any critical data is loading
  const showLoading = isInitialLoading && Boolean(address);

  return (
    <LoadingScreen isLoading={showLoading}>
      <div className='layout d-flex flex-column flex-fill wrapper'>
        {Boolean(address) && <Navbar />}

        <main className='d-flex flex-column flex-grow-1 align-items-center justify-content-center'>
          <AuthenticatedRoutesWrapper
            routes={routes}
            unlockRoute={`${routeNames.unlock}${search}`}
          >
            {children}
          </AuthenticatedRoutesWrapper>
        </main>

        {/* Bottom navigation for mobile devices */}
        <BottomNav />
        
        {/* Floating Telegram bubble */}
        {Boolean(address) && <TelegramBubble />}
      </div>
    </LoadingScreen>
  );
};