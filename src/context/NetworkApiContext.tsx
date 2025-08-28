import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initNetworkApi } from 'config';

interface NetworkApiContextType {
  ready: boolean;
}

const NetworkApiContext = createContext<NetworkApiContextType | undefined>(undefined);

export const NetworkApiProvider = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      await initNetworkApi();
      if (mounted) setReady(true);
    }
    initialize();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <NetworkApiContext.Provider value={{ ready }}>
      {children}
    </NetworkApiContext.Provider>
  );
};

export const useNetworkApi = (): NetworkApiContextType => {
  const context = useContext(NetworkApiContext);
  if (context === undefined) {
    throw new Error('useNetworkApi must be used within a NetworkApiProvider');
  }
  return context;
};
