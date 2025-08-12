import { useColsAprContext } from '../../context/ColsAprContext';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import type { ColsStakerRow } from '../../hooks/useColsApr';
import { useState } from 'react';

const TARGET_USER = 'erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm';

export function ColsAprTable() {
  const { address } = useGetAccountInfo();
  const { loading, stakers, egldPrice, colsPrice } = useColsAprContext();
  const [copied, setCopied] = useState(false);

  // Only show table if the logged-in user is the target user
  if (address !== TARGET_USER) return null;
  if (loading) return <div>Loading COLS-DIST table...</div>;

  // Include all addresses with COLS staked and eGLD delegated
  const filtered = stakers.filter(
    (row: ColsStakerRow) => row.colsStaked > 0 && row.egldStaked > 0
  );

  // Calculate COLS-DIST(i) for each eligible user
  type RowType = { address: string; colsDist: number };
  const rows: RowType[] = filtered.map((row: ColsStakerRow) => {
    // COLS-DIST(i) = APR-BONUS(i)/100 * eGLD-staked(i) * eGLDprice / 365 / COLSprice
    const colsDist =
      row.aprBonus && row.egldStaked && egldPrice && colsPrice
        ? (row.aprBonus / 100) * row.egldStaked * egldPrice / 365 / colsPrice
        : 0;
    return {
      address: row.address,
      colsDist
    };
  });

  if (rows.length === 0) {
    return <div>No eligible data for COLS-DIST table.</div>;
  }

  // Prepare the text to copy (no header, just address;COLS distributed)
  const tableText = rows.map((r: RowType) =>
    [
      r.address,
      r.colsDist.toLocaleString(undefined, { maximumFractionDigits: 8 })
    ].join(';')
  ).join('\n');

  // Copy handler
  const handleCopy = () => {
    navigator.clipboard.writeText(tableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // Render as a copy-paste ready table (plain text, semicolon-separated, no header)
  return (
    <div style={{ margin: 16 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        COLS-DIST Table
        <button
          onClick={handleCopy}
          style={{
            marginLeft: 8,
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            background: copied ? '#4caf50' : '#1976d2',
            color: '#fff',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </h3>
      <pre style={{
        background: '#222',
        color: '#fff',
        padding: 16,
        borderRadius: 8,
        fontSize: 16,
        userSelect: 'all'
      }}>
{tableText}
      </pre>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        <b>eGLD Price:</b> ${egldPrice} &nbsp; <b>COLS Price:</b> ${colsPrice}
      </div>
    </div>
  );
}
