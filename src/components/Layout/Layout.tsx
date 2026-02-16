import { ReactNode } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { AuthenticatedRoutesWrapper } from '@multiversx/sdk-dapp/wrappers';

import { useLocation } from 'react-router-dom';
import routes, { routeNames } from 'routes';

import { Navbar } from './components/Navbar';
import { BottomNav } from 'components/BottomNav';
import { TelegramBubble } from 'components/TelegramBubble';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { search } = useLocation();
  const { address } = useGetAccountInfo();

  return (
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
  );
};
