import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { routeNames } from 'routes';

import { MultiversX } from 'assets/MultiversX';

import styles from './styles.module.scss';

const STATS = [
  { value: '48', label: 'Nodes', icon: '🛡️' },
  { value: '830+', label: 'Delegators', icon: '👥' },
  { value: '178K+', label: 'eGLD', icon: '💎' },
  { value: '7%+', label: 'APY', icon: '📈' }
];

const STRENGTHS = [
  { icon: '🛡️', title: '48 Nodes', desc: 'Most secure agency' },
  { icon: '🇨🇴', title: 'Colombian', desc: 'Unique positioning' },
  { icon: '📈', title: 'Top 3 APY', desc: 'On MultiversX' },
  { icon: '💪', title: 'Proven', desc: '$10M+ staked' }
];

const SOCIAL_LINKS = {
  telegram: [
    { name: '📢 Announcements', url: 'https://t.me/ColombiaStakingAnn' },
    { name: '💬 English', url: 'https://t.me/ColombiaStakingChat' },
    { name: '🇪🇸 Spanish', url: 'https://t.me/colombiastakingesp' },
    { name: '🇫🇷 French', url: 'https://t.me/colmbiastakingfr' }
  ],
  x: 'https://x.com/ColombiaStaking',
  website: 'https://colombia-staking.com'
};

export const Unlock = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useGetLoginInfo();
  const [panelOpened, setPanelOpened] = useState(false);

  const unlockPanelManager = UnlockPanelManager.init({
    loginHandler: () => {
      navigate(routeNames.user);
    },
    onClose: async () => {
      setPanelOpened(false);
    }
  });

  useEffect(() => {
    if (isLoggedIn) {
      navigate(routeNames.user);
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
        
        {/* Stats Row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 40, flexWrap: 'wrap' }}>
          {STATS.map((stat, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '14px 18px', background: 'rgba(98, 219, 184, 0.08)', borderRadius: 14, border: '1px solid rgba(98, 219, 184, 0.2)', minWidth: 80 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#62dbb8' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
        
        {/* Why Colombia Staking - Strengths */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#a0a0a0', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            Why Choose Colombia Staking?
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', maxWidth: 500, margin: '0 auto' }}>
            {STRENGTHS.map((strength, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)', flex: '1 1 120px', maxWidth: 140 }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{strength.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{strength.title}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{strength.desc}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Social Links */}
        <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a href={SOCIAL_LINKS.x} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#000', color: '#fff', padding: '10px 18px', borderRadius: 25, textDecoration: 'none', fontSize: 13, fontWeight: 600, border: '1px solid #333' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X
          </a>
          <a href={SOCIAL_LINKS.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(98, 219, 184, 0.1)', color: '#62dbb8', padding: '10px 18px', borderRadius: 25, textDecoration: 'none', fontSize: 13, fontWeight: 600, border: '1px solid rgba(98, 219, 184, 0.3)' }}>
            🌐 Website
          </a>
          <a href="https://t.me/ColombiaStakingChat" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #0088cc, #00a8e8)', color: '#fff', padding: '10px 18px', borderRadius: 25, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            💬 Telegram
          </a>
        </div>
      </div>
    </div>
  );
};