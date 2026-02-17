import { createRoot } from 'react-dom/client';
import { initApp } from '@multiversx/sdk-dapp/out/methods/initApp/initApp';
import type { InitAppType } from '@multiversx/sdk-dapp/out/methods/initApp/initApp.types';
import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';

import { App } from './App';
import './index.css';
import './assets/sass/theme.scss';

import { NetworkApiProvider, useNetworkApi } from './context/NetworkApiContext';
import { network } from './config';

const Root = () => {
  const { ready } = useNetworkApi();

  if (!ready) {
    return (
      <div style={{ color: '#6ee7c7', fontSize: 24, textAlign: 'center', marginTop: 100 }}>
        Initializing network...
      </div>
    );
  }

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
  const container = document.getElementById('root');
  const root = createRoot(container as HTMLElement);

  root.render(
    <NetworkApiProvider>
      <Root />
    </NetworkApiProvider>
  );
});
