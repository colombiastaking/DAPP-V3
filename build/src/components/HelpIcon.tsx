import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function HelpIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{top: number, left: number, width: number, height: number}>({top: 0, left: 0, width: 0, height: 0});
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height
      });
    }
  }, [show]);

  // Responsive positioning
  let tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    background: '#23272a',
    color: '#ffe082',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 2px 8px #000a',
    zIndex: 9999,
    minWidth: 180,
    maxWidth: 320,
    whiteSpace: 'pre-line',
    pointerEvents: 'none'
  };

  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth <= 600;
    if (isMobile) {
      tooltipStyle.left = 8;
      tooltipStyle.right = 8;
      tooltipStyle.top = coords.top + coords.height + 8;
      tooltipStyle.maxWidth = '90vw';
      tooltipStyle.minWidth = 0;
      tooltipStyle.width = 'calc(100vw - 32px)';
      tooltipStyle.transform = 'none';
    } else {
      // Desktop: try to show right, but if overflow, show left
      let left = coords.left + 24;
      let top = coords.top;
      tooltipStyle.left = left;
      tooltipStyle.top = top;
      tooltipStyle.transform = 'translateY(-50%)';
      // Check for right overflow
      if (left + 340 > window.scrollX + window.innerWidth) {
        tooltipStyle.left = Math.max(8, coords.left - 340);
      }
      // Check for bottom overflow
      if (top + 60 > window.scrollY + window.innerHeight) {
        tooltipStyle.top = window.scrollY + window.innerHeight - 70;
      }
      // Check for top overflow
      if (top - 60 < window.scrollY) {
        tooltipStyle.top = window.scrollY + 8;
      }
    }
  }

  return (
    <>
      <span
        ref={iconRef}
        style={{
          display: 'inline-block',
          position: 'relative',
          marginLeft: 4,
          cursor: 'pointer',
          verticalAlign: 'middle',
          zIndex: 100
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={e => {
          e.preventDefault();
          setShow((v) => !v);
        }}
        tabIndex={0}
        aria-label="Help"
      >
        <span style={{
          display: 'inline-block',
          width: 18,
          height: 18,
          background: '#6ee7c7',
          color: '#181a1b',
          borderRadius: '50%',
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 14,
          lineHeight: '18px',
          boxShadow: '0 1px 4px #6ee7c7aa',
          userSelect: 'none'
        }}>?</span>
      </span>
      {show && createPortal(
        <span style={tooltipStyle}>{text}</span>,
        document.body
      )}
    </>
  );
}
