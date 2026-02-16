import { useState } from 'react';
import styles from './TelegramBubble.module.scss';

// Telegram channels
const TELEGRAM_CHANNELS = [
  {
    name: 'English',
    flag: '🇬🇧',
    url: 'https://t.me/ColombiaStakingChat'
  },
  {
    name: 'Español',
    flag: '🇪🇸',
    url: 'https://t.me/colombiastakingesp'
  },
  {
    name: 'Français',
    flag: '🇫🇷',
    url: 'https://t.me/colmbiastakingfr'
  }
];

export const TelegramBubble = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.bubbleContainer}>
      {/* Main bubble button */}
      <button 
        className={`${styles.bubble} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Join Telegram"
      >
        <svg viewBox="0 0 24 24" className={styles.telegramIcon}>
          <path fill="currentColor" d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.8c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.78.42l.38-1.99z"/>
        </svg>
        {isOpen && <span className={styles.closeIcon}>✕</span>}
      </button>

      {/* Popup menu */}
      {isOpen && (
        <div className={styles.popup}>
          <div className={styles.popupHeader}>
            <span className={styles.popupTitle}>💬 Join us on Telegram</span>
          </div>
          <div className={styles.channelsList}>
            {TELEGRAM_CHANNELS.map((channel) => (
              <a
                key={channel.url}
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.channelItem}
                onClick={() => setIsOpen(false)}
              >
                <span className={styles.channelFlag}>{channel.flag}</span>
                <div className={styles.channelInfo}>
                  <span className={styles.channelName}>{channel.name}</span>
                </div>
                <svg className={styles.arrowIcon} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </a>
            ))}
          </div>
          <div className={styles.popupFooter}>
            <span>Get updates, support & community</span>
          </div>
        </div>
      )}

      {/* Backdrop to close popup */}
      {isOpen && (
        <div 
          className={styles.backdrop}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
