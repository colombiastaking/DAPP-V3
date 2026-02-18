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
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: 80,
          height: 80,
          border: '4px solid rgba(255,255,255,0.1)',
          borderTop: '4px solid #6ee7b7',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: 24
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#6ee7b7' }}>
          Colombia Staking
        </h2>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
          Initializing network...
        </p>
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
