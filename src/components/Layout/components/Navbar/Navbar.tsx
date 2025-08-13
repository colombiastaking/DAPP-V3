import { ReactNode, useEffect, useState } from 'react';
import { faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { logout } from '@multiversx/sdk-dapp/utils/logout';
import axios from 'axios';
import classNames from 'classnames';

import { MultiversX } from 'assets/MultiversX';
import { network } from 'config';
import { denominated } from 'helpers/denominate';

import styles from './styles.module.scss';

const COLS_TOKEN_ID = 'COLS-9d91b7';

export const Navbar = () => {
  const { address, account } = useGetAccountInfo();
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

  const formattedBalance = Number(denominated(account?.balance ?? '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedColsBalance = Number(colsBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const buttons: { icon: ReactNode; label: string; onClick?: () => void }[] = [
    { icon: <FontAwesomeIcon icon={faPowerOff} />, label: '', onClick: () => logout(`${window.location.origin}/unlock`) }
  ];

  return (
    <nav className={`${styles.nav} delegation-nav`}>
      <div className={styles.heading} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'default' }}>
        <span className={styles.logo}>
          <MultiversX />
        </span>
        <span className={styles.title} style={{ flexShrink: 0, userSelect: 'text' }}>
          Colombia Staking Dashboard
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: '#6ee7c7', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', userSelect: 'text' }}>
          {formattedBalance} {network.egldLabel}
        </span>
        <span style={{ color: '#6ee7c7', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', userSelect: 'text' }}>
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
            <span className={styles.icon} style={{ color: '#6ee7c7' }}>
              {button.icon}
            </span>
            {button.label && <span>{button.label}</span>}
          </div>
        ))}
      </div>
    </nav>
  );
};
