import { useEffect } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { ExtensionLoginButton } from '@multiversx/sdk-dapp/UI/extension/ExtensionLoginButton';
import { LedgerLoginButton } from '@multiversx/sdk-dapp/UI/ledger/LedgerLoginButton';
import { WalletConnectLoginButton } from '@multiversx/sdk-dapp/UI/walletConnect/WalletConnectLoginButton';
import { WebWalletLoginButton } from '@multiversx/sdk-dapp/UI/webWallet/WebWalletLoginButton';
import { useNavigate } from 'react-router-dom';

import { Extension } from 'assets/Extension';
import { Ledger } from 'assets/Ledger';
import { MultiversX } from 'assets/MultiversX';
import { Wallet } from 'assets/Wallet';
import { xPortal } from 'assets/xPortal';

import styles from './styles.module.scss';

import type { ConnectionType } from './types';

export const Unlock = () => {
  const { address } = useGetAccountInfo();

  const navigate = useNavigate();
  const connects: ConnectionType[] = [
    {
      title: 'Desktop',
      name: 'MultiversX Web Wallet',
      background: '#1a1a1a',
      icon: Wallet,
      component: WebWalletLoginButton,
      nativeAuth: true
    },
    {
      title: 'Hardware',
      name: 'Ledger',
      nativeAuth: true,
      background: '#1a1a1a',
      icon: Ledger,
      component: LedgerLoginButton,
      innerLedgerComponentsClasses: {
        ledgerScamPhishingAlertClassName: styles.phishing,
        ledgerProgressBarClassNames: {},
        ledgerConnectClassNames: {
          ledgerModalTitleClassName: styles.title,
          ledgerModalSubtitleClassName: styles.subtitle,
          ledgerModalIconClassName: styles.icon
        },
        confirmAddressClassNames: {
          ledgerModalTitleClassName: styles.title,
          ledgerModalConfirmDescriptionClassName: styles.description,
          ledgerModalConfirmFooterClassName: styles.footer
        },
        addressTableClassNames: {
          ledgerModalTitleClassName: styles.title,
          ledgerModalSubtitleClassName: styles.subtitle,
          ledgerModalTableHeadClassName: styles.head,
          ledgerModalTableNavigationButtonClassName: styles.navigation,
          ledgerModalTableSelectedItemClassName: styles.selected
        },
        ledgerLoadingClassNames: {
          ledgerModalTitleClassName: styles.title,
          ledgerModalSubtitleClassName: styles.subtitle
        }
      }
    },
    {
      title: 'Mobile',
      name: 'xPortal Mobile Wallet',
      background: 'linear-gradient(135deg, #62dbb8 0%, #d33682 100%)',
      nativeAuth: true,
      icon: xPortal,
      isWalletConnectV2: true,
      component: WalletConnectLoginButton,
      innerWalletConnectComponentsClasses: {
        containerContentClassName: styles.content,
        containerTitleClassName: styles.title,
        containerButtonClassName: styles.button,
        containerSubtitleClassName: styles.subtitle,
        containerScamPhishingAlertClassName: styles.phishing,
        walletConnectPairingListClassNames: {
          leadClassName: styles.lead,
          buttonClassName: styles.pairing
        }
      }
    },
    {
      title: 'Browser',
      name: 'MultiversX DeFi Wallet',
      background: 'linear-gradient(135deg, #62dbb8 0%, #4bc9a1 100%)',
      nativeAuth: true,
      icon: Extension,
      component: ExtensionLoginButton
    }
  ];

  const redirectConditionally = () => {
    if (address) {
      navigate('/user');
    }
  };

  useEffect(redirectConditionally, [address]);

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
        <div className={styles.connects} style={{ justifyContent: 'center', width: '100%' }}>
          {connects.map((connect) => (
            <connect.component
              key={connect.name}
              callbackRoute='/unlock'
              logoutRoute='/unlock'
              {...connect}
            >
              <span className={styles.connect}>
                <span className={styles.title}>{connect.title}</span>
                <span
                  className={styles.icon}
                  style={{ background: connect.background }}
                >
                  <connect.icon />
                </span>
                <span className={styles.name}>{connect.name}</span>
              </span>
            </connect.component>
          ))}
        </div>
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
