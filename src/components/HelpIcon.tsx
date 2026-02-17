import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function HelpIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number }>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const iconRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Theme colors
  const theme = {
    primary: '#62dbb8',
    primaryDark: '#4bc9a1',
    accent: '#d33682',
    background: '#1a1a1a',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    border: 'rgba(98, 219, 184, 0.3)',
  };

  useEffect(() => {
    if (show && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [show]);

  // Tooltip style
  let tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    background: theme.background,
    color: theme.textPrimary,
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.6,
    boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${theme.border}`,
    border: `1px solid ${theme.border}`,
    zIndex: 9999,
    minWidth: 200,
    maxWidth: 340,
    whiteSpace: 'pre-line',
    pointerEvents: 'auto',
  };

  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth <= 600;
    if (isMobile) {
      tooltipStyle.left = 16;
      tooltipStyle.right = 16;
      tooltipStyle.top = coords.top + coords.height + 12;
      tooltipStyle.maxWidth = 'calc(100vw - 32px)';
      tooltipStyle.minWidth = 0;
      tooltipStyle.width = 'auto';
      tooltipStyle.transform = 'none';
    } else {
      // Desktop: show to the right or fallback left
      let left = coords.left + 28;
      let top = coords.top;
      tooltipStyle.left = left;
      tooltipStyle.top = top;
      tooltipStyle.transform = 'translateY(-50%)';
      if (left + 360 > window.scrollX + window.innerWidth) {
        tooltipStyle.left = Math.max(16, coords.left - 360);
      }
      if (top + 100 > window.scrollY + window.innerHeight) {
        tooltipStyle.top = window.scrollY + window.innerHeight - 120;
      }
      if (top - 100 < window.scrollY) {
        tooltipStyle.top = window.scrollY + 16;
      }
    }
  }

  // Tooltip content including the link
  const tooltipContent = (
    <div
      ref={tooltipRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div style={{ marginBottom: 12 }}>{text}</div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
        <a
          href="/cols-info.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: theme.primary,
            fontSize: 13,
            textDecoration: 'none',
            fontWeight: 600,
            background: `rgba(98, 219, 184, 0.1)`,
            padding: '6px 12px',
            borderRadius: 6,
            transition: 'background 0.2s ease',
          }}
        >
          <span>Learn more about COLS</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 17L17 7M17 7H7M17 7V17"/>
          </svg>
        </a>
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={iconRef}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 6,
          cursor: 'pointer',
          verticalAlign: 'middle',
          zIndex: 100,
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => {
          setTimeout(() => {
            if (
              !tooltipRef.current?.matches(':hover') &&
              !iconRef.current?.matches(':hover')
            ) {
              setShow(false);
            }
          }, 50);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          setShow((v) => !v);
        }}
        tabIndex={0}
        aria-label="Help"
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
            color: theme.background,
            borderRadius: '50%',
            fontWeight: 800,
            fontSize: 12,
            boxShadow: `0 2px 8px rgba(98, 219, 184, 0.4)`,
            userSelect: 'none',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          ?
        </span>
      </span>
      {show &&
        createPortal(
          <div style={tooltipStyle}>{tooltipContent}</div>,
          document.body
        )}
    </>
  );
}