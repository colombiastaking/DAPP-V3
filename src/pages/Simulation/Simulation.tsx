import { useState } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useColsAprContext } from '../../context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './Simulation.module.scss';

function simulateAprAndRank({
  stakers,
  address,
  simulatedColsStaked,
  simulatedEgldStaked,
  colsPrice,
  egldPrice,
  baseApr,
  serviceFee,
  agencyLockedEgld
}: {
  stakers: any[];
  address: string;
  simulatedColsStaked: number;
  simulatedEgldStaked: number;
  colsPrice: number;
  egldPrice: number;
  baseApr: number;
  serviceFee: number;
  agencyLockedEgld: number;
}) {
  const APRmin = 0.3;
  let APRmax = 15;
  const AGENCY_BUYBACK = 0.30;
  const DAO_DISTRIBUTION_RATIO = 0.333;
  const BONUS_BUYBACK_FACTOR = 0.66;

  let found = stakers.find((s: any) => s.address === address);
  let newStakers = [...stakers];
  if (!found) {
    newStakers.push({
      address,
      colsStaked: simulatedColsStaked,
      egldStaked: simulatedEgldStaked,
      ratio: null,
      normalized: null,
      aprBonus: null,
      dao: null,
      aprTotal: null,
      rank: null,
      aprColsOnly: null
    });
  } else {
    newStakers = newStakers.map((s: any) =>
      s.address === address
        ? { ...s, colsStaked: simulatedColsStaked, egldStaked: simulatedEgldStaked }
        : s
    );
  }

  const targetAvgAprBonus =
    (
      agencyLockedEgld *
      baseApr /
      (1 - serviceFee) /
      100 *
      serviceFee *
      AGENCY_BUYBACK *
      BONUS_BUYBACK_FACTOR *
      egldPrice / colsPrice
    ) / 365;

  let step = 0.01;
  let bestAprMax = APRmax;
  let bestDiff = Infinity;
  let maxIter = 200;
  let iter = 0;
  let lastSum = 0;

  function calcAprBonusTableSum({
    stakers,
    egldPrice,
    colsPrice,
    aprMax,
    aprMin
  }: {
    stakers: any[];
    egldPrice: number;
    colsPrice: number;
    aprMax: number;
    aprMin: number;
  }) {
    const filtered = stakers.filter(
      (row: any) => row.colsStaked > 0 && row.egldStaked > 0
    );
    let minRatio = Infinity, maxRatio = -Infinity;
    for (const row of filtered) {
      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
      if (row.ratio < minRatio) minRatio = row.ratio;
      if (row.ratio > maxRatio) maxRatio = row.ratio;
    }
    for (const row of filtered) {
      row.normalized = (maxRatio !== minRatio && row.ratio !== null)
        ? (row.ratio - minRatio) / (maxRatio - minRatio)
        : 0;
      row.aprBonus = aprMin + (aprMax - aprMin) * Math.sqrt(row.normalized);
    }
    let sum = 0;
    for (const row of filtered) {
      if (row.aprBonus !== null) {
        const dist = (row.aprBonus / 100) * row.egldStaked * egldPrice / 365 / colsPrice;
        sum += dist;
      }
    }
    return sum;
  }

  while (iter < maxIter) {
    if (APRmax > 25) APRmax = 50;
    if (APRmax < APRmin) APRmax = APRmin;
    const sum = calcAprBonusTableSum({
      stakers: newStakers.map(r => ({ ...r })),
      egldPrice,
      colsPrice,
      aprMax: APRmax,
      aprMin: APRmin
    });
    const diff = Math.abs(sum - targetAvgAprBonus);
    if (diff < 0.01) {
      bestAprMax = APRmax;
      break;
    }
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAprMax = APRmax;
    }
    if (sum < targetAvgAprBonus) {
      APRmax += step;
    } else {
      APRmax -= step;
    }
    if ((lastSum < targetAvgAprBonus && sum > targetAvgAprBonus) ||
        (lastSum > targetAvgAprBonus && sum < targetAvgAprBonus)) {
      step = Math.max(0.01, step / 2);
    }
    lastSum = sum;
    iter++;
  }

  for (const row of newStakers) {
    if (row.egldStaked > 0 && colsPrice > 0 && egldPrice > 0) {
      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
    } else {
      row.ratio = null;
    }
  }

  const validRatios = newStakers.filter((r: any) => r.ratio !== null).map((r: any) => r.ratio);
  const minRatio = validRatios.length > 0 ? Math.min(...validRatios) : 0;
  const maxRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;
  for (const row of newStakers) {
    if (row.ratio !== null && maxRatio !== minRatio) {
      row.normalized = (row.ratio - minRatio) / (maxRatio - minRatio);
    } else {
      row.normalized = null;
    }
  }

  for (const row of newStakers) {
    if (row.normalized !== null) {
      row.aprBonus = APRmin + (bestAprMax - APRmin) * Math.sqrt(row.normalized);
    } else {
      row.aprBonus = null;
    }
  }

  const totalEgldStaked = agencyLockedEgld;
  const sumColsStaked = newStakers.reduce((sum: number, r: any) => sum + (r.colsStaked || 0), 0);
  for (const row of newStakers) {
    if (row.egldStaked > 0 && row.colsStaked > 0 && sumColsStaked > 0) {
      const baseAprCorrected = baseApr / (1 - serviceFee) / 100;
      const dao = (
        (
          (
            totalEgldStaked *
            baseAprCorrected *
            AGENCY_BUYBACK *
            serviceFee *
            DAO_DISTRIBUTION_RATIO *
            row.colsStaked
          ) / sumColsStaked
        ) / row.egldStaked
      ) * 100;
      row.dao = dao;
    } else {
      row.dao = null;
    }
  }

  for (const row of newStakers) {
    if (row.colsStaked > 0) {
      const baseAprCorrected = baseApr / (1 - serviceFee) / 100;
      const numerator =
        agencyLockedEgld *
        baseAprCorrected *
        AGENCY_BUYBACK *
        serviceFee *
        DAO_DISTRIBUTION_RATIO *
        egldPrice;
      const denominator = colsPrice * sumColsStaked;
      row.aprColsOnly = denominator === 0 ? 0 : (numerator / denominator) * 100;
    } else {
      row.aprColsOnly = null;
    }
  }

  for (const row of newStakers) {
    if (row.egldStaked > 0) {
      row.aprTotal = baseApr + (row.aprBonus || 0) + (row.dao || 0);
    } else if (row.colsStaked > 0) {
      row.aprTotal = row.aprColsOnly !== null ? row.aprColsOnly : baseApr;
    } else {
      row.aprTotal = baseApr;
    }
  }

  const sorted = [...newStakers].sort((a: any, b: any) => (b.aprTotal || 0) - (a.aprTotal || 0));
  for (let i = 0; i < sorted.length; ++i) {
    sorted[i].rank = i + 1;
  }
  for (const row of newStakers) {
    const found = sorted.find((r: any) => r.address === row.address);
    row.rank = found ? found.rank : null;
  }

  const user = newStakers.find((s: any) => s.address === address);
  return {
    newApr: user && user.aprTotal !== undefined && user.aprTotal !== null ? user.aprTotal : null,
    newRank: user && user.rank !== undefined && user.rank !== null ? user.rank : null
  };
}

export const Simulation = () => {
  const { address } = useGetAccountInfo();
  const { stakers, baseApr, egldPrice, colsPrice, agencyLockedEgld, loading: aprLoading } = useColsAprContext();

  const [simulatedCols, setSimulatedCols] = useState('1');
  const [simulatedEgld, setSimulatedEgld] = useState('1');
  const [simResult, setSimResult] = useState<{ newApr: number | null; newRank: number | null } | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const handleSimulate = async () => {
    setSimError(null);
    setSimResult(null);
    setSimLoading(true);
    if (!address) {
      setSimError("Not logged in");
      setSimLoading(false);
      return;
    }
    let valCols = 0;
    let valEgld = 0;
    try {
      valCols = parseFloat(simulatedCols);
      valEgld = parseFloat(simulatedEgld);
      if (isNaN(valCols) || valCols < 0) throw new Error();
      if (isNaN(valEgld) || valEgld < 0) throw new Error();
      if (valCols > 40000) {
        setSimError("Maximum COLS to simulate is 40,000");
        setSimLoading(false);
        return;
      }
      if (valEgld > 1000000) {
        setSimError("Maximum eGLD to simulate is 1,000,000");
        setSimLoading(false);
        return;
      }
    } catch {
      setSimError("Invalid COLS or eGLD value");
      setSimLoading(false);
      return;
    }

    if (
      aprLoading ||
      !Array.isArray(stakers) ||
      stakers.length === 0
    ) {
      setSimError("Please wait for all data to load before simulating.");
      setSimLoading(false);
      return;
    }

    const result = simulateAprAndRank({
      stakers,
      address,
      simulatedColsStaked: valCols,
      simulatedEgldStaked: valEgld,
      colsPrice,
      egldPrice,
      baseApr,
      serviceFee: 0.12,
      agencyLockedEgld
    });
    setSimResult(result);
    setSimLoading(false);
  };

  return (
    <div className={styles.simulation}>
      <h2 style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: '6px 12px', display: 'inline-block', marginBottom: 24 }}>
        Simulate Your Stake
      </h2>
      <div className={styles.inputs}>
        <label>
          COLS Amount:
          <input
            type="number"
            min={0}
            max={40000}
            step="any"
            value={simulatedCols}
            onChange={e => setSimulatedCols(e.target.value)}
            placeholder="COLS"
          />
        </label>
        <label>
          eGLD Amount:
          <input
            type="number"
            min={0}
            max={1000000}
            step="any"
            value={simulatedEgld}
            onChange={e => setSimulatedEgld(e.target.value)}
            placeholder="eGLD"
          />
        </label>
        <button onClick={handleSimulate} disabled={simLoading}>
          {simLoading ? <><AnimatedDots /> Calculating...</> : "Apply"}
        </button>
      </div>
      {simError && <div className={styles.error}>{simError}</div>}
      {simResult && (
        <div className={styles.results}>
          <div style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: '6px 12px', display: 'inline-block' }}>
            <strong>Simulated Total APR:</strong>{' '}
            {simResult.newApr !== null ? simResult.newApr.toFixed(2) + '%' : 'N/A'}
          </div>
          <div>
            <strong>Simulated Ranking:</strong>{' '}
            {simResult.newRank !== null ? `#${simResult.newRank} of ${stakers.length} COLS stakers` : 'N/A'}
          </div>
        </div>
      )}
    </div>
  );
};
