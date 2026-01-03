import React from 'react';
import { useColsAprContext } from '../../context/ColsAprContext';
import { AnimatedDots } from '../AnimatedDots';

const bannerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 32,
  background: 'linear-gradient(90deg, #222 0%, #333 100%)',
  color: '#fff',
  borderRadius: 12,
  padding: '18px 0',
  margin: '24px 0 32px 0',
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: 0.5,
  boxShadow: '0 2px 12px rgba(0,0,0,0.10)'
};

const priceBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: '#18191a',
  borderRadius: 8,
  padding: '10px 22px',
  fontSize: 20,
  fontWeight: 700,
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
};

const labelStyle: React.CSSProperties = {
  color: '#ff9800',
  fontWeight: 700,
  fontSize: 18,
  marginRight: 6
};

const valueStyle: React.CSSProperties = {
  color: '#fff',
  fontWeight: 700,
  fontSize: 22
};

export function PriceBanner() {
  const { colsPrice, egldPrice, loading } = useColsAprContext();

  return (
    <div style={bannerStyle}>
      <div style={priceBox}>
        <span style={labelStyle}>COLS Price:</span>
        <span style={valueStyle}>
          {loading ? <AnimatedDots /> : `$${Number(colsPrice).toLocaleString(undefined, { maximumFractionDigits: 6 })}`}
        </span>
      </div>
      <div style={priceBox}>
        <span style={labelStyle}>eGLD Price:</span>
        <span style={valueStyle}>
          {loading ? <AnimatedDots /> : `$${Number(egldPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        </span>
      </div>
    </div>
  );
}
