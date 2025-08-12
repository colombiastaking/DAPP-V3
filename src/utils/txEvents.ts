export const TX_COMPLETED = 'tx-completed';

export const notifyTxCompleted = () => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TX_COMPLETED));
    }
  } catch {
    // ignore in non-browser env
  }
};

export const onTxCompleted = (handler: () => void) => {
  const listener = () => handler();
  if (typeof window !== 'undefined') {
    window.addEventListener(TX_COMPLETED, listener as any);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(TX_COMPLETED, listener as any);
    }
  };
};
