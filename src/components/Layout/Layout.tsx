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
  
  // Comprehensive loading tracking - counts active data fetches
  const [fetchCount, setFetchCount] = useState(0);
  const hasLoadedRef = useRef(false);

  // Pre-fetch all data at login
  useGlobalData();
  const { isLoading: preloaderLoading } = usePreloadData();

  // Track when address changes - increment fetch count to show loading
  useEffect(() => {
    if (address) {
      // New login - show loading
      setFetchCount(1);
      hasLoadedRef.current = false;
    }
  }, [address]);

  // Show loading if:
  // 1. preloader is still loading, OR
  // 2. we just logged in and fetch count > 0
  const showLoading = Boolean(address) && (
    preloaderLoading === true || 
    fetchCount > 0
  );

  // When preloader finishes, decrement our counter
  useEffect(() => {
    if (address && preloaderLoading === false && fetchCount > 0 && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Keep loading screen a bit longer for other data to settle
      const settleTimer = setTimeout(() => {
        setFetchCount(0);
      }, 2000);
      
      return () => clearTimeout(settleTimer);
    }
  }, [address, preloaderLoading, fetchCount]);

  // Force hide after 10 seconds max (fallback)
  useEffect(() => {
    if (!address || hasLoadedRef.current) return;
    
    const timeoutFallback = setTimeout(() => {
      hasLoadedRef.current = true;
      setFetchCount(0);
    }, 10000);
    
    return () => clearTimeout(timeoutFallback);
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