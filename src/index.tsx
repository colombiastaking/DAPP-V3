import { createRoot } from 'react-dom/client';
import { initApp } from '@multiversx/sdk-dapp/out/methods/initApp/initApp';
import type { InitAppType } from '@multiversx/sdk-dapp/out/methods/initApp/initApp.types';
import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';
import { defineCustomElements } from '@multiversx/sdk-dapp/out/lib/sdkDappUi';

import { App } from './App';
import './index.css';
import './assets/sass/theme.scss';

import { NetworkApiProvider } from './context/NetworkApiContext';
import { network } from './config';

const Root = () => {
  // Skip waiting for network - LoadingScreen will handle loading state
  return <App />;
};

// Configure initApp with walletConnectV2ProjectId and nativeAuth
const config: InitAppType = {
  storage: { getStorageCallback: () => sessionStorage },
  dAppConfig: {
    environment: network.id as unknown as EnvironmentsEnum,
    nativeAuth: true,
    providers: {
      walletConnect: {
        walletConnectV2ProjectId: '9b1a9564f91cb659ffe21b73d5c4e2d8'
      }
    }
  }
};

initApp(config).then(() => {
  // Register web components (wallet unlock panel) after init
  defineCustomElements();
  
  const container = document.getElementById('root');
  const root = createRoot(container as HTMLElement);

  root.render(
    <NetworkApiProvider>
      <Root />
    </NetworkApiProvider>
  );
});
