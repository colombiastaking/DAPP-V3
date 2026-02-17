import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useColsApr } from '../hooks/useColsApr';
import { onTxCompleted } from 'utils/txEvents';

const ColsAprContext = createContext<any>(null);

export function ColsAprProvider({ children }: { children: any }) {
  const [trigger, setTrigger] = useState(0);
  const { loading, stakers, egldPrice, colsPrice, baseApr, agencyLockedEgld, targetAvgAprBonus } = useColsApr({ trigger });

  // Track if we've already fetched data (don't refetch on tab clicks)
  const hasLoadedRef = useRef(false);
  const hasTxListenerRef = useRef(false);

  // Call this after user action to force recalc
  const refresh = useCallback(() => {
    hasLoadedRef.current = false; // Allow refetch after manual refresh
    setTrigger(t => t + 1);
  }, []);

  // Refresh only when a transaction completes (only set up listener once)
  useEffect(() => {
    if (hasTxListenerRef.current) return;
    hasTxListenerRef.current = true;
    
    const unsubscribe = onTxCompleted(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return (
    <ColsAprContext.Provider value={{
      loading, stakers, egldPrice, colsPrice, baseApr, agencyLockedEgld, targetAvgAprBonus, refresh
    }}>
      {children}
    </ColsAprContext.Provider>
  );
}

export function useColsAprContext() {
  return useContext(ColsAprContext);
}