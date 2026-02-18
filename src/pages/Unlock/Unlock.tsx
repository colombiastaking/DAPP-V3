import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { routeNames } from 'routes';

import styles from './styles.module.scss';

const SOCIAL_LINKS = {
  telegram: [
    { name: '📢 Announcements', url: 'https://t.me/ColombiaStakingAnn' },
    { name: '💬 English Chat', url: 'https://t.me/ColombiaStakingChat' },
    { name: '🇪🇸 Spanish', url: 'https://t.me/colombiastakingesp' },
    { name: '🇫🇷 French', url: 'https://t.me/colmbiastakingfr' }
  ],
  x: 'https://x.com/ColombiaStaking',
  website: 'https://colombia-staking.com'
};

const STATS = [
  { value: '48', label: 'Validator Nodes' },
  { value: '830+', label: 'Delegators' },
  { value: '178K+', label: 'eGLD Staked' },
  { value: '7%+', label: 'APY' }
];

const FEATURES = [
  { icon: '🛡️', title: 'Secure Staking', desc: 'Professional infrastructure with 99.9% uptime' },
  { icon: '💎', title: 'COLS Token', desc: 'Earn bonus rewards with COLS token holding' },
  { icon: '🌱', title: 'Green Energy', desc: '100% renewable energy powered nodes' },
  { icon: '🎁', title: 'DAO Rewards', desc: 'Share in agency revenue through buybacks' }
];

export const Unlock = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useGetLoginInfo();
  const [panelOpened, setPanelOpened] = useState(false);
  const [showSocials, setShowSocials] = useState(false);

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
    <div className={styles.landing}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          {/* Logo */}
          <div className={styles.logoContainer}>
            <img 
              src="/colombia-staking-logo.svg" 
              alt="Colombia Staking" 
              className={styles.logoImg}
            />
          </div>
          
          {/* Tagline */}
          <h1 className={styles.heroTitle}>
            Stake eGLD with<span className={styles.highlight}> Colombia Staking</span>
          </h1>
          
          <p className={styles.heroSubtitle}>
            Colombia's premier MultiversX staking agency. 
            Secure, reliable, and powered by 100% green energy. 🇨🇴
          </p>
          
          {/* Stats */}
          <div className={styles.stats}>
            {STATS.map((stat, i) => (
              <div key={i} className={styles.stat}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <button
            onClick={handleConnect}
            disabled={panelOpened}
            className={styles.ctaButton}
          >
            {panelOpened ? 'Connecting...' : '🚀 Start Staking Now'}
          </button>
          
          <p className={styles.ctaNote}>
            No lock period • Instant rewards • 24/7 monitoring
          </p>
        </div>
        
        {/* Background decoration */}
        <div className={styles.bgGlow}></div>
        <div className={styles.bgGlow2}></div>
      </div>
      
      {/* Features Section */}
      <div className={styles.features}>
        {FEATURES.map((feature, i) => (
          <div key={i} className={styles.featureCard}>
            <span className={styles.featureIcon}>{feature.icon}</span>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDesc}>{feature.desc}</p>
          </div>
        ))}
      </div>
      
      {/* Social Links */}
      <div className={styles.socialSection}>
        <div className={styles.socialTitle}>Join the Community</div>
        <div className={styles.socialLinks}>
          {/* X (Twitter) */}
          <a 
            href={SOCIAL_LINKS.x} 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.socialX}
            title="Follow us on X"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>X / Twitter</span>
          </a>
          
          {/* Telegram */}
          <div className={styles.telegramDropdown}>
            <button 
              className={styles.socialTelegram}
              onClick={() => setShowSocials(!showSocials)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.8c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.78.42l.38-1.99z"/>
              </svg>
              <span>Telegram</span>
              <span className={styles.dropdownArrow}>▼</span>
            </button>
            
            {showSocials && (
              <div className={styles.telegramMenu}>
                {SOCIAL_LINKS.telegram.map((channel, i) => (
                  <a 
                    key={i}
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.telegramChannel}
                  >
                    {channel.name}
                  </a>
                ))}
              </div>
            )}
          </div>
          
          {/* Website */}
          <a 
            href={SOCIAL_LINKS.website}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialWeb}
            title="Visit our website"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            <span>Website</span>
          </a>
        </div>
      </div>
      
      {/* Footer */}
      <div className={styles.footer}>
        <p>Don't have a wallet? {' '}
          <a 
            href="https://xportal.app.link/referral?code=00kcpys24e" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.walletLink}
          >
            Get xPortal Wallet
          </a>
        </p>
      </div>
    </div>
  );
};