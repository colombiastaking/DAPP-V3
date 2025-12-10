import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useEffect, useState } from 'react';
import { decodeBigNumber, Query, ContractFunction, Address, AddressValue } from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';

import { RankingTable } from 'components/Stake/RankingTable';
import { useColsAprContext } from '../../context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';
import { HelpIcon } from 'components/HelpIcon';
import { ColsAprTable } from 'components/ColsAprTable';

import styles from './styles.module.scss';

const denomination = 1e18;

function formatNumber(amount: number | string, decimals = 6) {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export const Home = () => {
  const { address } = useGetAccountInfo();
  const { stakers, loading, egldPrice, colsPrice, baseApr } = useColsAprContext();

  const [additionalEgldDelegatedRaw, setAdditionalEgldDelegatedRaw] = useState<string | null>(null);
  const [loadingAdditionalEgld, setLoadingAdditionalEgld] = useState(false);

  // Find user row in stakers
  const userRow = stakers.find((s: any) => s.address === address) ?? null;

  // Current user delegated and staked amounts (raw numbers)
  const egldDelegatedFromApr = userRow?.egldStaked ?? 0;
  const colsStaked = userRow?.colsStaked ?? 0;

  // Convert raw value to eGLD decimals
  const additionalEgldDelegated = additionalEgldDelegatedRaw
    ? (Number(additionalEgldDelegatedRaw) / denomination).toString()
    : null;

  const totalUsd =
    (Number(egldDelegatedFromApr) * Number(egldPrice || 0)) +
    (Number(colsStaked) * Number(colsPrice || 0));

  const totalStakers = stakers.length;

  // Conditionally fetch delegated eGLD if no COLS staked
  useEffect(() => {
    let mounted = true;
    if (!address || colsStaked > 0) {
      setAdditionalEgldDelegatedRaw(null);
      setLoadingAdditionalEgld(false);
      return () => { mounted = false; };
    }

    setLoadingAdditionalEgld(true);

    async function fetchDelegatedEgld() {
      try {
        const provider = new ProxyNetworkProvider('https://gateway.multiversx.com');
        const q = new Query({
          address: new Address('erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf'), // delegation contract
          func: new ContractFunction('getUserActiveStake'),
          args: [new AddressValue(new Address(address))]
        });

        const response = await provider.queryContract(q);
        const parts = response.getReturnDataParts();

        if (parts.length > 0) {
          const delegatedRaw = decodeBigNumber(parts[0]).toFixed();
          if (mounted) setAdditionalEgldDelegatedRaw(delegatedRaw);
        } else {
          if (mounted) setAdditionalEgldDelegatedRaw('0');
        }
      } catch (e) {
        if (mounted) setAdditionalEgldDelegatedRaw('0');
      }
      if (mounted) setLoadingAdditionalEgld(false);
    }

    fetchDelegatedEgld();

    return () => { mounted = false; };
  }, [address, colsStaked]);

  const aprColor = '#1976d2';

  const totalAprHelpText = `Total APR represents your annual percentage rate based on your staking status:
- If you have eGLD delegated, the Total APR applies to your eGLD delegation.
- If you have no eGLD delegated, the Total APR applies to your COLS token stake.
This ensures the APR reflects your actual staking position.`;

  return (
    <div className={styles.landing}>
      <section className={styles.assetGrid}>
        <div className={styles.assetCard}>
          <div className={styles.assetLabel}>eGLD Delegated</div>
          <div className={styles.assetValue}>
            {
              loading || loadingAdditionalEgld
                ? <><AnimatedDots /> </>
                : (
                  +colsStaked === 0 && additionalEgldDelegated !== null
                    ? formatNumber(additionalEgldDelegated)
                    : formatNumber(egldDelegatedFromApr)
                )
            } EGLD
          </div>
          <div className={styles.assetUsd}>
            ≈ ${Math.floor(
              +colsStaked === 0 && additionalEgldDelegated !== null
                ? Number(additionalEgldDelegated) * Number(egldPrice || 0)
                : Number(egldDelegatedFromApr) * Number(egldPrice || 0)
            )}
          </div>
        </div>

        <div className={styles.assetCard}>
          <div className={styles.assetLabel}>COLS Staked</div>
          <div className={styles.assetValue}>
            {loading ? <><AnimatedDots /> </> : formatNumber(colsStaked)} COLS
          </div>
          <div className={styles.assetUsd}>
            ≈ ${(Number(colsStaked) * Number(colsPrice || 0)).toFixed(2)}
          </div>
        </div>

        <div className={styles.assetCard} style={{ minWidth: 260 }}>
          <div className={styles.assetLabel}>Total Value (USD)</div>
          <div className={styles.totalValue}>
            ${Number.isFinite(totalUsd) ? Math.floor(totalUsd).toLocaleString() : '0'}
          </div>
          <div className={styles.hint}>
            Prices: COLS ${Number(colsPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} • eGLD ${Number(egldPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      <section className={styles.aprPanel} style={{ textAlign: 'center' }}>
        <div className={styles.APRHeader} style={{ fontSize: 24, fontWeight: 700, background: aprColor, color: '#fff', borderRadius: 8, padding: '4px 12px', display: 'inline-block', marginBottom: 8 }}>
          <span>Total APR&nbsp;&nbsp;</span>
          <span className={styles.aprValue} style={{ fontSize: 28, fontWeight: 900 }}>
            {loading ? <><AnimatedDots /> </> : userRow?.aprTotal !== null && userRow?.aprTotal !== undefined ? Number(userRow.aprTotal).toFixed(2) : '—'}%
          </span>
          <HelpIcon text={totalAprHelpText} />
        </div>
        <div style={{ marginTop: 8, fontWeight: 600, fontSize: 18, color: '#6ee7c7' }}>
          Base APR: {loading ? <AnimatedDots /> : baseApr.toFixed(2)}%
          <HelpIcon text="Base APR is the standard annual percentage rate for all delegators, before any COLS bonus." />
        </div>
        <div className={styles.ranking} style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: '#fff', background: aprColor, padding: '4px 16px', borderRadius: 8, boxShadow: '0 2px 8px #fff8', display: 'inline-block', margin: '16px auto 0 auto' }}>
          <span>Your rank: </span>
          <span>
            {loading
              ? '...'
              : userRow?.rank !== null && userRow?.rank !== undefined
                ? `${userRow.rank} out of ${totalStakers} COLS stakers`
                : 'N/A'}
          </span>
          <HelpIcon text="Ranking is based on your total APR compared to other stakers. The more COLS you stake (relative to your eGLD), the higher your rank." />
        </div>
      </section>

      <RankingTable />
      <ColsAprTable />
    </div>
  );
};

export default Home;
