import { ReactNode, useState, useEffect } from 'react';
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
import { useColsAprContext } from 'context/ColsAprContext';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { search } = useLocation();
  const account = useGetAccount();
  const address = account.address;
  
  // Track if user is logged in and data loading state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastAddress, setLastAddress] = useState('');

  // Pre-fetch all data at login
  useGlobalData();
  const { isLoading: preloaderLoading } = usePreloadData();
  const { loading: colsLoading } = useColsAprContext();

  // Check for new login
  useEffect(() => {
    if (address && address !== lastAddress) {
      setLastAddress(address);
      setIsLoggedIn(true);
      setDataLoaded(false);
    }
  }, [address, lastAddress]);

  // Track when data is done loading - include COLS stakers data
  useEffect(() => {
    if (isLoggedIn && preloaderLoading === false && colsLoading === false) {
      // Give extra time for other data to load
      const settleTimer = setTimeout(() => {
        setDataLoaded(true);
      }, 3000);
      
      return () => clearTimeout(settleTimer);
    }
  }, [isLoggedIn, preloaderLoading, colsLoading]);

  // Force complete after 10 seconds
  useEffect(() => {
    if (isLoggedIn && !dataLoaded) {
      const timeout = setTimeout(() => {
        setDataLoaded(true);
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [isLoggedIn, dataLoaded]);

  // Show loading screen while logged in but data not yet loaded
  const showLoading = isLoggedIn && !dataLoaded;

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