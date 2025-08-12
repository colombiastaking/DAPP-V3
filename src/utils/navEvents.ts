export const NAV_TAB_CHANGED = 'nav-tab-changed';

export const emitNavTabChange = (path: string) => {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NAV_TAB_CHANGED, { detail: { path } }));
    }
  } catch {
    // no-op in non-browser environments
  }
};

export const onNavTabChanged = (handler: (path: string) => void) => {
  const listener = (e: Event) => {
    const ce = e as CustomEvent;
    handler(ce?.detail?.path);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(NAV_TAB_CHANGED, listener as any);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(NAV_TAB_CHANGED, listener as any);
    }
  };
};
