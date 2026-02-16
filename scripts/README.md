# COLS Distribution Scripts

## Scripts Overview

### Main Scripts (Daily Use)

| Script | Purpose | Usage |
|--------|---------|-------|
| `run_distribution.sh` | **Main entry point** | `./run_distribution.sh [command]` |
| `fetch_cols_stakers.mjs` | Fetch COLS stakers from contract | `node fetch_cols_stakers.mjs` |
| `daily_distribution.mjs` | Calculate BONUS distribution | `node daily_distribution.mjs` |
| `verify_distribution.mjs` | Verify blockchain transactions | `node verify_distribution.mjs` |

### Helper Scripts

| Script | Purpose |
|--------|---------|
| `calculate_bonus_distribution.mjs` | BONUS calculation with DAPP formula |
| `execute_distribution.mjs` | Execute transactions on blockchain |
| `execute_bonus_distribution.mjs` | Execute BONUS transfers only |

## Daily Workflow

```bash
# 1. Fetch latest COLS stakers data
./run_distribution.sh fetch

# 2. Preview today's distribution
./run_distribution.sh

# 3. Execute on blockchain (requires confirmation)
./run_distribution.sh execute

# 4. Verify transactions
./run_distribution.sh verify
```

## Distribution Formula (Matches DAPP)

```
AGENCY_BUYBACK = 0.30
DAO_DISTRIBUTION_RATIO = 0.333 (of service fee)
BONUS_BUYBACK_FACTOR = 0.66 (of buyback)

Bonus Pool = Total × 30% × 10% × 66% / 365

Individual Bonus:
  ratio = (COLS × COLS_price) / (EGLD × EGLD_price)
  normalized = (ratio - min) / (max - min)
  aprBonus = APRmin + (APRmax - APRmin) × √normalized
  bonus = (aprBonus/100) × EGLD × EGLD_price / 365 / COLS_price
```

## Files Generated

All files are stored in `/tmp/cols_distribution/`:

| File | Description |
|------|-------------|
| `cols_stakers_latest.json` | Cached COLS stakers data |
| `bonus_distribution_YYYY-MM-DD.json` | Calculated distribution |
| `distribution_YYYY-MM-DD.json` | Full distribution data |
| `results_YYYY-MM-DD.json` | Execution results |

## Configuration

Edit constants in `daily_distribution.mjs`:

```javascript
CONFIG.contracts.delegation = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf'
CONFIG.paths.privateKey = '/home/raspberry/.openclaw/alice-backup/private_key.txt'
```

## Gas Limits

| Transaction Type | Gas Limit |
|------------------|-----------|
| ESDT Transfer | 510,000 |
| Contract Call (DAO) | 20,000,000 |

## Notes

1. **Hex Padding**: COLS amounts are padded to EVEN length for valid bytecode
2. **Match Rate**: Current implementation matches DAPP values at 99% (104/105 addresses)
3. **Outlier**: `erd1rs2ah...` shows ~8% difference due to stake data timing

## Troubleshooting

### No COLS stakers found
```bash
node fetch_cols_stakers.mjs
```

### Prices not fetching
Check API endpoints:
- https://api.multiversx.com/economics
- https://api.multiversx.com/tokens/COLS-9d91b7

### Transaction fails
- Check wallet has enough EGLD for gas
- Check wallet has enough COLS for distribution
- Verify recipient address is valid