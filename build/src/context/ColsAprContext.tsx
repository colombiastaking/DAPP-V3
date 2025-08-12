import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useColsApr } from '../hooks/useColsApr';
import { onTxCompleted } from 'utils/txEvents';

const ColsAprContext = createContext<any>(null);

export function ColsAprProvider({ children }: { children: any }) {
  const [trigger, setTrigger] = useState(0);
  const { loading, stakers, egldPrice, colsPrice, baseApr, agencyLockedEgld } = useColsApr({ trigger });

  // Call this after user action to force recalc
  const refresh = useCallback(() => setTrigger(t => t + 1), []);

  // Refresh only when a transaction completes
  useEffect(() => {
    const unsubscribe = onTxCompleted(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return (
    <ColsAprContext.Provider value={{
      loading, stakers, egldPrice, colsPrice, baseApr, agencyLockedEgld, refresh
    }}>
      {children}
    </ColsAprContext.Provider>
  );
}

export function useColsAprContext() {
  return useContext(ColsAprContext);
}
