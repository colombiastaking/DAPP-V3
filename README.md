# 🇨🇴 Colombia Staking DApp  
## APR & Ranking Calculation Overview

Welcome to the technical overview of APR and staker ranking logic used in the **Colombia Staking DApp**. This system is built to reward users who actively stake both **eGLD** and **COLS** tokens by calculating fair and dynamic APR bonuses based on staking ratios and DAO contributions.

---

## 📊 1. Data Sources

- **Staker Data**: From PeerMe COLS contract and Colombia Staking delegation smart contract.
- **Token Prices**: Real-time prices for eGLD and COLS from the MultiversX API.
- **Base APR & Service Fee**: From the MultiversX provider API and smart contract config.

---

## 💰 2. APR Calculation

### 🔹 2.1 Base APR
- Pulled directly from the MultiversX API.
- Standard annual yield for all delegators, **before** any bonuses.

### 🔹 2.2 COLS Bonus APR

Users are rewarded for higher **COLS/eGLD staking ratios**.

#### Step 1: Ratio Calculation
```math
ratio = (COLS_staked × COLS_price) / (eGLD_staked × eGLD_price)
```

#### Step 2: Normalization
```math
normalized = (ratio - minRatio) / (maxRatio - minRatio)
```

#### Step 3: Bonus APR Assignment
```math
APR_BONUS = APRmin + (APRmax - APRmin) × √normalized
```
- `APRmin` typically = 0.4%
- `APRmax` is dynamically adjusted

#### Step 4: Dynamic APRmax Targeting
Ensures system balance:
```math
targetAvgAprBonus = 
((agencyLockedEgld × baseApr / (1 - serviceFee) / 100 × serviceFee × AGENCY_BUYBACK × BONUS_BUYBACK_FACTOR × eGLD_price) / COLS_price) / 365
```

System loops to adjust `APRmax` until all user bonuses match this target.

---

### 🔹 2.3 DAO Reward APR

Portion of agency buybacks redistributed to COLS stakers:
```math
DAO(i) = (((Total_eGLD × baseApr / (1 - serviceFee) / 100 × 
AgencyBuyback × serviceFee × DAO_DISTRIBUTION_RATIO × COLS_staked(i)) 
/ SUM(COLS_staked)) / eGLD_staked(i)) × 100
```

> **Note**: Only users staking both COLS and eGLD receive DAO rewards.

---

### 🔹 2.4 COLS-Only APR

For users staking only COLS (no eGLD):
```math
APR_COLS_ONLY = 
(((Total_eGLD × baseApr / (1 - serviceFee) / 100 × AgencyBuyback × serviceFee × DAO_DISTRIBUTION_RATIO × eGLD_price) 
/ (COLS_price × SUM(COLS_staked))) × 100
```

---

### 🔹 2.5 Total APR Summary

| User Staking | Formula |
|--------------|---------|
| COLS + eGLD  | `baseApr + APR_BONUS + DAO` |
| COLS only    | `APR_COLS_ONLY` |
| Neither      | `baseApr` |

---

## 🏅 3. Ranking Calculation

### 🔸 3.1 Sorting
Stakers are ranked in **descending order** of `APR_TOTAL`.

### 🔸 3.2 Rank Assignment
```math
rank = index + 1
```

### 🔸 3.3 League Gamification

- 🥇 **Gold**: Top third
- 🥈 **Silver**: Middle third
- 🥉 **Bronze**: Bottom third

Leagues are visually represented in the DApp.

### 🔸 3.4 User Insights
- UI highlights **your rank, league**, and required APR to reach the next league.
- Top 5 stakers are always shown.
- Window around your position also displayed.

---

## 🧪 4. Simulation Feature

- Users can simulate their APR and rank by inputting **hypothetical eGLD and COLS** amounts.
- Simulation uses live price and APR values for accurate forecasting.

---

## ⚙️ 5. Constants & Parameters

| Parameter | Value | Description |
|----------|-------|-------------|
| `AGENCY_BUYBACK` | 0.35 | 35% of agency rewards used for buybacks |
| `DAO_DISTRIBUTION_RATIO` | 0.333 | 33.3% of buybacks to DAO rewards |
| `BONUS_BUYBACK_FACTOR` | 0.66 | Used in bonus average APR targeting |
| `APRmin` | 0.4% | Minimum COLS bonus APR |
| `APRmax` | Up to 50% | Dynamically adjusted |

---

## 🛡️ 6. Security & Fairness

- All computations use **real-time and on-chain data**.
- **Dynamic APRmax** prevents over-rewarding or under-rewarding users.
- Square root normalization ensures fair bonus distribution, even for large holders.

---

## 📘 7. Example Calculation

**User A stakes:**
- 1000 eGLD  
- 1000 COLS  
- COLS price = $1  
- eGLD price = $40  
- Base APR = 8%  
- Service fee = 10%

#### Step-by-step:
1. `ratio = (1000×1)/(1000×40) = 0.025`
2. Normalize ratio across all users
3. Calculate `APR_BONUS` using normalized sqrt curve
4. Compute DAO reward
5. `APR_TOTAL = baseApr + APR_BONUS + DAO`
6. Sort users → assign ranks → place in leagues

---

## 🧬 8. Code References

| File | Description |
|------|-------------|
| `src/hooks/useColsApr.ts` | Main APR calculation logic |
| `src/components/Stake/RankingTable.tsx` | UI for ranking & leagues |
| `src/components/Stake/Stake.tsx` | APR display and simulation |

---

## ✅ 9. Conclusion

The **Colombia Staking DApp** uses a transparent, dynamic, and fair algorithm to calculate APR and rankings. By incentivizing dual staking and rewarding participation through a gamified structure, it encourages users to contribute actively to the ecosystem and COLS token economy.
