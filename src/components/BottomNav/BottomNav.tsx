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
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';

import styles from './BottomNav.module.scss';

// Softer mint/teal colors for icons to reduce brightness
const iconColors = {
  default: '#4fd1c5',
  hover: '#3bb3a9',
  activeBg: 'rgba(79, 209, 197, 0.12)',
  activeColor: '#23f7dd'
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
        style={{ color: iconColors.default, filter: 'drop-shadow(0 0 1.5px #3bb3a9)' }}
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
        style={{ color: iconColors.default, filter: 'drop-shadow(0 0 1.5px #3bb3a9)' }}
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
        style={{ color: iconColors.default, filter: 'drop-shadow(0 0 1.5px #3bb3a9)' }}
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
        style={{ color: iconColors.default, filter: 'drop-shadow(0 0 1.5px #3bb3a9)' }}
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
        style={{ color: iconColors.default, filter: 'drop-shadow(0 0 1.5px #3bb3a9)' }}
      />
    )
  }
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { address } = useGetAccountInfo();

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
              backgroundColor: active ? iconColors.activeBg : 'transparent',
              borderRadius: 8,
              transition: 'background-color 0.3s ease'
            }}
          >
            <span
              className={styles.icon}
              style={{
                color: active ? iconColors.activeColor : iconColors.default,
                filter: active ? 'drop-shadow(0 0 4px #23f7dd)' : 'none',
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
