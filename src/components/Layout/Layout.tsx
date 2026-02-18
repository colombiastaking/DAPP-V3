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
import { useGlobalContext } from 'context';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { search } = useLocation();
  const account = useGetAccount();
  const address = account.address;
  
  const { delegatorCount, claimableCols, userActiveStake } = useGlobalContext();
  
  // Track if initial data is loading
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasCheckedRef = useRef(false);

  // Pre-fetch all data at login for better UX
  useGlobalData();
  const { isLoading: preloaderLoading } = usePreloadData();

  // Check if all critical data is loaded
  useEffect(() => {
    if (!address || hasCheckedRef.current) return;
    
    // Wait for all data to be loaded
    const dataLoaded = 
      delegatorCount.status === 'loaded' ||
      claimableCols.status === 'loaded' ||
      userActiveStake.status === 'loaded' ||
      preloaderLoading === false;
    
    if (dataLoaded) {
      hasCheckedRef.current = true;
      // Add a small delay for smooth transition
      const timer = setTimeout(() => {
        setIsInitialLoading(false);
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [address, delegatorCount.status, claimableCols.status, userActiveStake.status, preloaderLoading]);

  // Reset loading state on address change (new login)
  useEffect(() => {
    if (address) {
      hasCheckedRef.current = false;
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