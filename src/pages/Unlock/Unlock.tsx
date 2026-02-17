import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { ProviderFactory } from '@multiversx/sdk-dapp/out/providers/ProviderFactory';
import { routeNames } from 'routes';

import { MultiversX } from 'assets/MultiversX';

import styles from './styles.module.scss';

// Provider type for WalletConnect
const WALLET_CONNECT_TYPE = 'walletConnect';

export const Unlock = () => {
  const navigate = useNavigate();
  const { isLoggedIn, isWalletConnectV2Initialized } = useGetLoginInfo();
  const [panelOpened, setPanelOpened] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const unlockPanelManager = UnlockPanelManager.init({
    loginHandler: async ({ type, anchor }) => {
      try {
        const provider = await ProviderFactory.create({ type, anchor });
        await provider.login();
        navigate(routeNames.dashboard);
      } catch (error) {
        console.error('Login failed:', error);
        setPanelOpened(true);
        unlockPanelManager.openUnlockPanel();
      }
    },
    onClose: async () => {
      setPanelOpened(false);
    }
  });

  // Try to auto-login if coming from xPortal Hub
  useEffect(() => {
    if (isLoggedIn || autoLoginAttempted) return;

    const tryAutoLogin = async () => {
      setAutoLoginAttempted(true);
      
      // Check if WalletConnect is initialized and try to login
      if (isWalletConnectV2Initialized) {
        try {
          // Try WalletConnect login first (xPortal)
          const provider = await ProviderFactory.create({ 
            type: WALLET_CONNECT_TYPE
          });
          const account = await provider.login();
          if (account) {
            navigate(routeNames.dashboard);
            return;
          }
        } catch (error) {
          console.log('Auto-login via WalletConnect failed, showing panel');
        }
      }
      
      // If auto-login failed, show the panel
      setPanelOpened(true);
      unlockPanelManager.openUnlockPanel();
    };

    // Small delay to let SDK initialize
    const timer = setTimeout(tryAutoLogin, 1500);
    return () => clearTimeout(timer);
  }, [isWalletConnectV2Initialized]);

  useEffect(() => {
    if (isLoggedIn) {
      navigate(routeNames.dashboard);
    }
  }, [isLoggedIn, navigate]);

  const handleConnect = () => {
    setPanelOpened(true);
    unlockPanelManager.openUnlockPanel();
  };

  return (
    <div className={styles.unlock} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className={styles.wrapper} style={{ maxWidth: 520, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.logo} style={{ marginBottom: 28 }}>
          <MultiversX />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <strong className={styles.heading} style={{ fontSize: 28, color: '#62dbb8', display: 'block', marginBottom: 14, fontFamily: 'Lustria, serif' }}>
            Colombia Staking
          </strong>
          <div className={styles.description} style={{ fontSize: 17, color: '#a0a0a0', lineHeight: 1.5 }}>
            Delegate your eGLD and stake your COLS tokens<br />to the decentralized staking agency
          </div>
        </div>
        
        <button
          onClick={handleConnect}
          disabled={panelOpened}
          style={{
            background: 'linear-gradient(135deg, #62dbb8 0%, #4bc9a1 100%)',
            border: 'none',
            borderRadius: 12,
            padding: '16px 48px',
            fontSize: 18,
            fontWeight: 600,
            color: '#1a1a1a',
            cursor: panelOpened ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: panelOpened ? 0.7 : 1
          }}
        >
          {panelOpened ? 'Connecting...' : 'Connect Wallet'}
        </button>
        
        <div style={{ marginTop: 36, textAlign: 'center', color: '#a0a0a0', fontWeight: 500, fontSize: 15, maxWidth: 420, lineHeight: 1.6 }}>
          Don't have a MultiversX wallet yet?{' '}
          <a
            href="https://xportal.app.link/referral?code=00kcpys24e"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#62dbb8', textDecoration: 'underline', fontWeight: 600 }}
          >
            Get the xPortal Wallet here
          </a>
          {' '}and start staking today!
        </div>
      </div>
    </div>
  );
};