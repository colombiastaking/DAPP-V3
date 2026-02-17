import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faHandshake,
  faUser,
  faBolt,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import { emitNavTabChange } from 'utils/navEvents';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';

import styles from './BottomNav.module.scss';

// Colombia Staking theme colors
const themeColors = {
  primary: '#62dbb8',
  primaryDark: '#4bc9a1',
  accent: '#d33682',
  activeBg: 'rgba(98, 219, 184, 0.15)',
  activeColor: '#62dbb8',
  inactiveColor: '#a0a0a0'
};

type TabType = {
  key: string;
  label: string;
  path: string;
  icon: ReactNode;
};

const TABS: TabType[] = [
  {
    key: 'stake',
    label: 'Stake',
    path: '/stake',
    icon: (
      <FontAwesomeIcon
        icon={faChartLine}
        style={{ color: themeColors.inactiveColor }}
      />
    )
  },
  {
    key: 'delegate',
    label: 'Delegate',
    path: '/delegate',
    icon: (
      <FontAwesomeIcon
        icon={faHandshake}
        style={{ color: themeColors.inactiveColor }}
      />
    )
  },
  {
    key: 'user',
    label: 'User',
    path: '/user',
    icon: (
      <FontAwesomeIcon
        icon={faUser}
        style={{ color: themeColors.inactiveColor }}
      />
    )
  },
  {
    key: 'simulation',
    label: 'Simulation',
    path: '/simulation',
    icon: (
      <FontAwesomeIcon
        icon={faBolt}
        style={{ color: themeColors.inactiveColor }}
      />
    )
  },
  {
    key: 'info',
    label: 'Info',
    path: '/info',
    icon: (
      <FontAwesomeIcon
        icon={faInfoCircle}
        style={{ color: themeColors.inactiveColor }}
      />
    )
  }
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const account = useGetAccount();
  const address = account.address;

  // Hide tabs on unlock page if user not logged in
  if (!address && currentPath === '/unlock') {
    return null;
  }

  const isActive = (p: string) => currentPath === p || currentPath.startsWith(p);

  return (
    <nav className={styles.bottomNav} aria-label="Bottom navigation">
      {TABS.map((tab) => {
        const active = isActive(tab.path);
        const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
          if (tab.key === 'user' && currentPath.startsWith('/user')) {
            e.preventDefault();
            return;
          }
          emitNavTabChange(tab.path);
        };

        return (
          <Link
            key={tab.key}
            to={tab.path}
            onClick={onClick}
            className={classNames(styles.tab, { [styles.active]: active })}
            aria-label={tab.label}
            style={{
              backgroundColor: active ? themeColors.activeBg : 'transparent',
              borderRadius: 12,
              transition: 'background-color 0.3s ease'
            }}
          >
            <span
              className={styles.icon}
              style={{
                color: active ? themeColors.activeColor : themeColors.inactiveColor,
                filter: active ? 'drop-shadow(0 0 6px rgba(98, 219, 184, 0.5))' : 'none',
                transition: 'color 0.3s ease, filter 0.3s ease'
              }}
            >
              {tab.icon}
            </span>
            <span className={styles.label}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
