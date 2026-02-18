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
  
  // Track if initial data is loading
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  // Pre-fetch all data at login for better UX
  useGlobalData();
  const { isLoading: preloaderLoading } = usePreloadData();

  // Check if data has been loaded at least once (allow transition after first load)
  useEffect(() => {
    if (!address) return;
    
    // Also allow transition after a timeout even if loading state is uncertain
    // This prevents getting stuck forever
    const timeoutFallback = setTimeout(() => {
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }, 5000); // 5 second max wait
    
    if (!hasLoadedRef.current && preloaderLoading === false) {
      hasLoadedRef.current = true;
      clearTimeout(timeoutFallback);
      // Add a small delay for smooth transition
      const timer = setTimeout(() => {
        setIsInitialLoading(false);
      }, 500);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(timeoutFallback);
      };
    }
    
    return () => clearTimeout(timeoutFallback);
  }, [address, preloaderLoading, isInitialLoading]);

  // Reset loading state on address change (new login)
  useEffect(() => {
    if (address) {
      hasLoadedRef.current = false;
      setIsInitialLoading(true);
    }
  }, [address]);

  return (
    <LoadingScreen isLoading={isInitialLoading && Boolean(address)}>
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