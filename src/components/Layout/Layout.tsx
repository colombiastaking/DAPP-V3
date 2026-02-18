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
    
    // If preloader is still loading, keep showing loading screen
    // Only hide when: preloader finishes OR 10 seconds timeout
    if (preloaderLoading === true) {
      // Still loading - keep showing, will re-check
    }
    
    // Max wait time - always hide after 10 seconds
    const timeoutFallback = setTimeout(() => {
      hasLoadedRef.current = true;
      setIsInitialLoading(false);
    }, 10000);
    
    // Check if done - if so hide immediately
    if (preloaderLoading === false) {
      hasLoadedRef.current = true;
      clearTimeout(timeoutFallback);
      setIsInitialLoading(false);
    }
    
    return () => clearTimeout(timeoutFallback);
  }, [address, preloaderLoading, isInitialLoading]);

  // Show loading while preloader is still loading AND we have an address
  // Will auto-hide when preloader finishes OR 10s timeout
  const showLoading = isInitialLoading && preloaderLoading === true && Boolean(address);

  // Reset loading state on address change (new login)
  useEffect(() => {
    if (address) {
      hasLoadedRef.current = false;
      setIsInitialLoading(true);
    }
  }, [address]);

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