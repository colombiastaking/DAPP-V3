import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';
import './assets/sass/theme.scss';

import { NetworkApiProvider, useNetworkApi } from './context/NetworkApiContext';

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

(() => {
  const container = document.getElementById('root');
  const root = createRoot(container as HTMLElement);

  root.render(
    <NetworkApiProvider>
      <Root />
    </NetworkApiProvider>
  );
})();
