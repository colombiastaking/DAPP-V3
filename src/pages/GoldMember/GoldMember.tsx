import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useEffect, useState } from 'react';
import { useGoldMember, calculateEffectiveApr } from 'hooks/useGoldMember';
import { useColsAprContext } from 'context/ColsAprContext';
import { useGlobalContext } from 'context';
import { HelpIcon } from 'components/HelpIcon';
import { AnimatedDots } from 'components/AnimatedDots';

import styles from './styles.module.scss';

function formatNumber(amount: number | string, decimals = 2) {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export const GoldMember = () => {
  const account = useGetAccount();
  const address = account.address;
  const { baseApr } = useColsAprContext();
  const { userActiveStake, claimableCols, stakers: stakersFromContext } = useGlobalContext();
  const { stakers } = useColsAprContext();
  
  // Get stakers from both sources to ensure we have the data
  const allStakers = stakers?.length > 0 ? stakers : stakersFromContext?.data;
  const userRow = allStakers?.find((s: any) => s.address === address);
  const delegatedEgldFromStakers = userRow?.egldStaked ? Number(userRow.egldStaked) : 0;
  
  const { isGoldMember, goldNftCount, goldCapacityEgld, isLoading: goldLoading } = useGoldMember(address);
  
  const [egldPrice, setEgldPrice] = useState<number>(0);
  const [colsPrice, setColsPrice] = useState<number>(0);
  
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch('https://api.multiversx.com/tokens/EGLD');
        const data = await res.json();
        setEgldPrice(data.price || 0);
      } catch (e) { console.error('EGLD price error', e); }
    };
    const fetchColsPrice = async () => {
      try {
        const res = await fetch('https://api.multiversx.com/tokens/COLS-d8c0fe');
        const data = await res.json();
        setColsPrice(data.price || 0);
      } catch (e) { console.error('COLS price error', e); }
    };
    fetchPrices();
    fetchColsPrice();
  }, []);
  
  // Use stakers data first if available, otherwise use SC query result
  const delegatedEgld = delegatedEgldFromStakers > 0 
    ? delegatedEgldFromStakers 
    : (userActiveStake.status === 'loaded' ? Number(userActiveStake.data || '0') / 1e18 : 0);
    
  const { effectiveApr, goldBonusApr, goldEligibleEgld, regularEligibleEgld } = 
    calculateEffectiveApr(baseApr, delegatedEgld, goldCapacityEgld);
  
  const claimable = claimableCols.status === 'loaded' 
    ? Number(claimableCols.data?.claimableCols || '0') / 1e18 
    : 0;
  
  const totalUsd = (delegatedEgld * egldPrice) + (claimable * colsPrice);
  
  if (goldLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <AnimatedDots />
          <p>Loading your Gold Member status...</p>
        </div>
      </div>
    );
  }
  
  if (!isGoldMember) {
    return (
      <div className={styles.container}>
        <div className={styles.notGoldMember}>
          <h2>Gold Member Access Required</h2>
          <p>You need a Colombia Staking Gold NFT to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.goldHeader}>
        <div className={styles.goldBadge}>
          <span className={styles.goldIcon}>👑</span>
          <span className={styles.goldText}>GOLD MEMBER</span>
        </div>
        <h1>Welcome, Gold Member!</h1>
        <p className={styles.goldSubtitle}>
          You have <strong>{goldNftCount} Gold NFT{goldNftCount > 1 ? 's' : ''}</strong> • 
          Capacity: <strong>{goldCapacityEgld.toLocaleString()} eGLD</strong> at 0% fee
        </p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statValue}>{formatNumber(delegatedEgld)} eGLD</div>
          <div className={styles.statLabel}>Your Delegation</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📈</div>
          <div className={styles.statValue}>{effectiveApr.toFixed(2)}%</div>
          <div className={styles.statLabel}>Your Effective APR</div>
          <HelpIcon text={`Base APR: ${baseApr.toFixed(2)}%\nGold Bonus: +${goldBonusApr.toFixed(2)}% on ${goldEligibleEgld.toFixed(0)} eGLD`} />
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💎</div>
          <div className={styles.statValue}>{formatNumber(claimable)} COLS</div>
          <div className={styles.statLabel}>Claimable Rewards</div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💵</div>
          <div className={styles.statValue}>${formatNumber(totalUsd)}</div>
          <div className={styles.statLabel}>Total Value</div>
        </div>
      </div>

      <div className={styles.benefitsSection}>
        <h2>Your Gold Member Benefits</h2>
        
        <div className={styles.benefitsList}>
          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>🎯</span>
            <div className={styles.benefitContent}>
              <h3>0% Service Fee</h3>
              <p>
                Up to <strong>{goldCapacityEgld.toLocaleString()} eGLD</strong> delegated earns rewards without any service fee deduction.
                {regularEligibleEgld > 0 && (
                  <span className={styles.partialGold}>
                    <br />• {goldEligibleEgld.toFixed(0)} eGLD at 0% fee
                    <br />• {regularEligibleEgld.toFixed(0)} eGLD at 10% fee
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>➕</span>
            <div className={styles.benefitContent}>
              <h3>Gold Member APR Bonus</h3>
              <p>
                Extra <strong>+{goldBonusApr.toFixed(2)}%</strong> APR on your Gold-eligible eGLD (Base APR × Service Fee)
              </p>
            </div>
          </div>
          
          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>💎</span>
            <div className={styles.benefitContent}>
              <h3>COLS Token Rewards</h3>
              <p>Earn bonus COLS tokens and DAO rewards on your staked position.</p>
            </div>
          </div>
          
          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>📅</span>
            <div className={styles.benefitContent}>
              <h3>Daily Distributions</h3>
              <p>Rewards are distributed <strong>daily</strong> (previously weekly). Check your dashboard for daily COLS earnings!</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.howItWorks}>
        <h2>How Your APR Is Calculated</h2>
        <div className={styles.formulaBox}>
          <div className={styles.formula}>
            <span className={styles.formulaLabel}>Gold-eligible eGLD:</span>
            <span className={styles.formulaValue}>min(Your Delegation, {goldCapacityEgld} eGLD) = {goldEligibleEgld.toFixed(0)} eGLD</span>
          </div>
          <div className={styles.formula}>
            <span className={styles.formulaLabel}>Gold APR:</span>
            <span className={styles.formulaValue}>{baseApr.toFixed(2)}% (full base APR, no fee)</span>
          </div>
          {regularEligibleEgld > 0 && (
            <div className={styles.formula}>
              <span className={styles.formulaLabel}>Regular APR:</span>
              <span className={styles.formulaValue}>{baseApr.toFixed(2)}% × 0.9 = {(baseApr * 0.9).toFixed(2)}%</span>
            </div>
          )}
          <div className={styles.formulaHighlight}>
            <span className={styles.formulaLabel}>Your Effective APR:</span>
            <span className={styles.formulaValue}>{effectiveApr.toFixed(2)}%</span>
          </div>
        </div>
        <p className={styles.formulaNote}>
          The 10% service fee is waived for your Gold-eligible eGLD, giving you the full Base APR on that portion.
        </p>
      </div>
    </div>
  );
};
