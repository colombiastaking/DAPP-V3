import React, { useEffect, useState } from 'react';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './LoadingScreen.module.scss';

interface LoadingScreenProps {
  isLoading: boolean;
  children: React.ReactNode;
}

const MARKETING_POINTS = [
  {
    icon: '🛡️',
    title: '48 Nodes',
    description: 'Most secure delegation agency in the MultiversX ecosystem'
  },
  {
    icon: '🇨🇴',
    title: 'Colombian Operations',
    description: 'Based in Colombia with local support and community'
  },
  {
    icon: '💎',
    title: 'COLS Token',
    description: 'Earn bonus APR + DAO rewards with COLS token staking'
  },
  {
    icon: '🏆',
    title: 'Top Performance',
    description: 'Consistently competitive APR with proven track record'
  },
  {
    icon: '🔒',
    title: 'Secure & Transparent',
    description: 'On-chain verification with full transparency'
  },
  {
    icon: '🌍',
    title: 'Global Community',
    description: 'Join thousands of delegators worldwide'
  }
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading, children }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);

  // Rotate through marketing points
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % MARKETING_POINTS.length);
        setFadeIn(true);
      }, 400);
    }, 4000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Don't render anything if not loading
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className={styles.loadingOverlay}>
      {/* Animated background */}
      <div className={styles.backgroundAnimation}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.orb3}></div>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <div className={styles.logoGlow}>
            <span className={styles.logoIcon}>⚡</span>
          </div>
          <h1 className={styles.title}>Colombia Staking</h1>
          <p className={styles.subtitle}>Loading your dashboard...</p>
        </div>

        {/* Loading indicator */}
        <div className={styles.loadingIndicator}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
          <div className={styles.loadingText}>
            Fetching blockchain data <AnimatedDots />
          </div>
        </div>

        {/* Marketing carousel */}
        <div className={styles.marketingCarousel}>
          <div className={`${styles.marketingCard} ${fadeIn ? styles.fadeIn : styles.fadeOut}`} key={currentSlide}>
            <span className={styles.cardIcon}>{MARKETING_POINTS[currentSlide].icon}</span>
            <h3 className={styles.cardTitle}>{MARKETING_POINTS[currentSlide].title}</h3>
            <p className={styles.cardDescription}>{MARKETING_POINTS[currentSlide].description}</p>
          </div>
          
          {/* Dots indicator */}
          <div className={styles.dots}>
            {MARKETING_POINTS.map((_, index) => (
              <span 
                key={index} 
                className={`${styles.dot} ${index === currentSlide ? styles.dotActive : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Stats preview */}
        <div className={styles.statsPreview}>
          <div className={styles.stat}>
            <span className={styles.statValue}>48</span>
            <span className={styles.statLabel}>Nodes</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.stat}>
            <span className={styles.statValue}>20%+</span>
            <span className={styles.statLabel}>APR</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.stat}>
            <span className={styles.statValue}>10K+</span>
            <span className={styles.statLabel}>Delegators</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span>Secured by MultiversX Blockchain</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
