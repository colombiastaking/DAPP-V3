import { ReactNode, useEffect, useState } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import axios from 'axios';
import classNames from 'classnames';

import NewLogo from 'assets/NewLogo';
import { network } from 'config';
import { denominated } from 'helpers/denominate';

import styles from './styles.module.scss';

const COLS_TOKEN_ID = 'COLS-9d91b7';

export const Navbar = () => {
  const account = useGetAccount();
  const address = account.address;
  const [colsBalance, setColsBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchCols = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${network.apiAddress}/accounts/${address}/tokens?identifier=${COLS_TOKEN_ID}`
        );
        if (Array.isArray(data) && data.length > 0 && data[0].identifier === COLS_TOKEN_ID) {
          let raw = data[0].balance.padStart(19, '0');
          const intPart = raw.slice(0, -18) || '0';
          let decPart = raw.slice(-18).replace(/0+$/, '');
          const formattedCols = decPart ? `${intPart}.${decPart}` : intPart;
          setColsBalance(formattedCols);
        } else {
          setColsBalance('0');
        }
      } catch {
        setColsBalance('0');
      }
      setLoading(false);
    };

    if (address) fetchCols();
  }, [address]);

  // Get delegated eGLD from account?.balance or fallback to 0
  const delegatedEgldRaw = account?.balance ?? '0';
  const delegatedEgldNum = Number(denominated(delegatedEgldRaw));
  // Format delegated eGLD with min 2 decimals if > 0, else '0.00'
  const formattedBalance = delegatedEgldNum > 0
    ? delegatedEgldNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  // Format COLS balance number for display
  const colsBalanceNum = Number(colsBalance);
  const formattedColsBalance = colsBalanceNum > 0
    ? colsBalanceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';

  // No disconnect button
  const buttons: { icon: ReactNode; label: string; onClick?: () => void }[] = [];

  return (
    <nav className={`${styles.nav} delegation-nav`}>
      <div className={styles.heading} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'default' }}>
        <span className={styles.logo}>
          <NewLogo width={64} height={64} />
        </span>
        <span className={styles.title} style={{ flexShrink: 0, userSelect: 'text' }}>
          Colombia Staking
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          style={{
            color: '#62dbb8',
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            userSelect: 'text',
            background: 'rgba(98, 219, 184, 0.1)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(98, 219, 184, 0.2)'
          }}
          aria-label="Delegated eGLD balance"
          title="Your delegated eGLD balance"
        >
          {formattedBalance} {network.egldLabel}
        </span>

        { /* Show COLS staked balance or ... while loading */ }
        <span
          style={{
            color: '#d33682',
            fontWeight: 600,
            fontSize: 14,
            whiteSpace: 'nowrap',
            userSelect: 'text',
            background: 'rgba(211, 54, 130, 0.1)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid rgba(211, 54, 130, 0.2)'
          }}
          aria-label="COLS staked balance"
          title="Your COLS staked balance"
        >
          {loading ? '...' : formattedColsBalance} COLS
        </span>
      </div>

      <div className={styles.buttons} style={{ gap: 8 }}>
        {buttons.map((button, idx) => (
          <div
            key={button.label + idx}
            onClick={button.onClick}
            className={classNames(styles.button, { [styles.clickable]: Boolean(button.onClick) })}
            style={{ minWidth: button.label === '' ? 36 : undefined, justifyContent: 'center' }}
            aria-label="Disconnect"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') button.onClick && button.onClick(); }}
          >
            <span className={styles.icon} style={{ color: '#62dbb8' }}>
              {button.icon}
            </span>
            {button.label && <span>{button.label}</span>}
          </div>
        ))}
      </div>
    </nav>
  );
};
