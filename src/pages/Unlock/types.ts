// Login button types are no longer needed in SDK v5
// The UnlockPanelManager handles all wallet connections
export interface ConnectionType {
  title: string;
  name: string;
  background: string;
  icon: () => JSX.Element;
  nativeAuth?: boolean;
}