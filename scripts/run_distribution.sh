#!/bin/bash
#
# COLS Daily Distribution Runner
# 
# Usage:
#   ./run_distribution.sh           # Preview today's distribution
#   ./run_distribution.sh calc      # Calculate fresh distribution
#   ./run_distribution.sh execute   # Execute on blockchain
#   ./run_distribution.sh verify    # Verify last distribution
#

set -e

SCRIPTS_DIR="/home/raspberry/.openclaw/workspace/colombia-staking-dapp/scripts"
OUTPUT_DIR="/tmp/cols_distribution"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}══════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   COLS Daily Distribution System${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════════════${NC}"
echo ""

case "$1" in
  calc|calculate|--calc|-c)
    echo -e "${GREEN}Calculating fresh BONUS distribution...${NC}"
    node "$SCRIPTS_DIR/daily_distribution.mjs" --recalc
    ;;
  
  fetch|--fetch|-f)
    echo -e "${GREEN}Fetching COLS stakers...${NC}"
    node "$SCRIPTS_DIR/fetch_cols_stakers.mjs"
    ;;
  
  execute|--execute|-e)
    echo -e "${YELLOW}⚠️  EXECUTION MODE - Transactions will be sent!${NC}"
    echo ""
    echo "This will:"
    echo "  1. DAO Pool: Send COLS to PeerMe contract (distribute function)"
    echo "  2. BONUS Pool: Individual transfers to eligible addresses"
    echo ""
    echo -n "Type 'yes' to confirm: "
    read confirm
    if [ "$confirm" != "yes" ]; then
      echo "Cancelled."
      exit 0
    fi
    echo ""
    echo -e "${GREEN}Executing distribution...${NC}"
    node "$SCRIPTS_DIR/execute_distribution.cjs" --all
    ;;
  
  dao|--dao)
    echo -e "${YELLOW}⚠️  DAO DISTRIBUTION ONLY${NC}"
    echo ""
    echo -n "Type 'yes' to confirm: "
    read confirm
    if [ "$confirm" != "yes" ]; then
      echo "Cancelled."
      exit 0
    fi
    echo ""
    echo -e "${GREEN}Sending DAO pool to PeerMe contract...${NC}"
    node "$SCRIPTS_DIR/execute_distribution.cjs" --dao
    ;;
  
  bonus|--bonus)
    echo -e "${YELLOW}⚠️  BONUS DISTRIBUTION ONLY${NC}"
    echo ""
    echo -n "Type 'yes' to confirm: "
    read confirm
    if [ "$confirm" != "yes" ]; then
      echo "Cancelled."
      exit 0
    fi
    echo ""
    echo -e "${GREEN}Sending BONUS transfers...${NC}"
    node "$SCRIPTS_DIR/execute_distribution.cjs" --bonus
    ;;
  
  verify|--verify|-v)
    echo -e "${BLUE}Verifying distribution...${NC}"
    node "$SCRIPTS_DIR/verify_distribution.mjs"
    ;;
  
  gold|--gold|-g)
    echo -e "${GREEN}Calculating GOLD member distribution...${NC}"
    node "$SCRIPTS_DIR/calculate_gold_distribution.mjs"
    ;;
  
  all|--all|-a)
    echo -e "${GREEN}Calculating ALL distributions (BONUS + GOLD)...${NC}"
    echo ""
    echo -e "${GREEN}1. BONUS Distribution${NC}"
    node "$SCRIPTS_DIR/daily_distribution.mjs" --recalc
    echo ""
    echo -e "${GREEN}2. GOLD Distribution${NC}"
    node "$SCRIPTS_DIR/calculate_gold_distribution.mjs"
    echo ""
    echo -e "${GREEN}✅ All distributions calculated!${NC}"
    ;;
  
  status|--status|-s)
    echo -e "${BLUE}Checking status...${NC}"
    echo ""
    
    # Check for today's distribution
    TODAY=$(date +%Y-%m-%d)
    BONUS_FILE="$OUTPUT_DIR/bonus_distribution_$TODAY.json"
    
    if [ -f "$BONUS_FILE" ]; then
      echo -e "${GREEN}✅ BONUS distribution calculated for today${NC}"
      cat "$BONUS_FILE" | node -e "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
        console.log('   Total BONUS:', d.bonus.totalBonus.toFixed(6), 'COLS');
        console.log('   Recipients:', d.bonus.recipients.length);
        console.log('   Prices: EGLD $' + d.prices.egldPrice + ' | COLS $' + d.prices.colsPrice.toFixed(4));
      "
    else
      echo -e "${YELLOW}❌ No distribution calculated for today${NC}"
      echo "   Run: ./run_distribution.sh calc"
    fi
    
    echo ""
    
    # Check GOLD distribution
    GOLD_FILE="$OUTPUT_DIR/gold_distribution_$TODAY.json"
    if [ -f "$GOLD_FILE" ]; then
      echo -e "${GREEN}✅ GOLD distribution calculated for today${NC}"
      cat "$GOLD_FILE" | node -e "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
        console.log('   Total GOLD:', d.totalCols.toFixed(6), 'COLS');
        console.log('   Recipients:', d.recipients.length);
      "
    else
      echo -e "${YELLOW}❌ No GOLD distribution for today${NC}"
      echo "   Run: ./run_distribution.sh gold"
    fi
    
    echo ""
    
    # Check COLS stakers cache
    STAKERS_FILE="$OUTPUT_DIR/cols_stakers_latest.json"
    if [ -f "$STAKERS_FILE" ]; then
      echo -e "${GREEN}✅ COLS stakers cache exists${NC}"
      cat "$STAKERS_FILE" | node -e "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
        const count = d.count || d.totalStakers || d.stakers?.length || 0;
        const total = d.stakers ? d.stakers.reduce((s, u) => s + u.colsStake, 0) : (d.totalStaked || 0);
        console.log('   Total stakers:', count);
        console.log('   Total staked:', total.toFixed(2), 'COLS');
        console.log('   Cache time:', d.timestamp);
      "
    else
      echo -e "${YELLOW}❌ No COLS stakers cache${NC}"
      echo "   Run: ./run_distribution.sh fetch"
    fi
    
    echo ""
    
    # Check wallet balance
    echo "Wallet balances:"
    ALICE_COLS=$(curl -s "https://api.multiversx.com/accounts/erd1a7e9dyqcffasu9d4vu45s6cuv25g6qfeqy2r7m6gqyle7vpdkgqqazpyuy/tokens/COLS-9d91b7" 2>/dev/null | node -e "
      try {
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
        console.log((parseFloat(d.balance) / 1e18).toFixed(2));
      } catch(e) { console.log('error'); }
    " || echo "error")
    ALICE_EGLD=$(curl -s "https://api.multiversx.com/accounts/erd1a7e9dyqcffasu9d4vu45s6cuv25g6qfeqy2r7m6gqyle7vpdkgqqazpyuy" 2>/dev/null | node -e "
      try {
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
        console.log((parseFloat(d.balance) / 1e18).toFixed(4));
      } catch(e) { console.log('error'); }
    " || echo "error")
    echo "   Alice: $ALICE_COLS COLS, $ALICE_EGLD EGLD"
    ;;
  
  table|--table|-t)
    echo -e "${BLUE}COLS-DIST Table:${NC}"
    TODAY=$(date +%Y-%m-%d)
    BONUS_FILE="$OUTPUT_DIR/bonus_distribution_$TODAY.json"
    
    if [ -f "$BONUS_FILE" ]; then
      cat "$BONUS_FILE" | node -e "
        const d = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
        const sorted = [...d.bonus.recipients].sort((a,b) => b.amount - a.amount);
        console.log('Rank | Address | Amount (COLS)');
        console.log('-----|---------|-------------');
        sorted.forEach((r, i) => {
          console.log((i+1).toString().padStart(4) + ' | ' + r.address.slice(0, 30) + '... | ' + r.amount.toFixed(8));
        });
        console.log('-----|---------|-------------');
        console.log('TOTAL: ' + d.bonus.totalBonus.toFixed(8) + ' COLS');
        console.log('Recipients: ' + sorted.length);
      "
    else
      echo "No distribution found. Run: ./run_distribution.sh calc"
    fi
    ;;
  
  help|--help|-h|*)
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  (none)        Show this help"
    echo "  calc          Calculate fresh BONUS distribution"
    echo "  fetch         Fetch COLS stakers data (SC query)"
    echo "  gold          Calculate GOLD member distribution"
    echo "  all           Calculate ALL distributions (BONUS + GOLD)"
    echo "  execute       Execute BOTH distributions (DAO + BONUS)"
    echo "  dao           Execute DAO distribution only (PeerMe contract)"
    echo "  bonus         Execute BONUS distribution only (individual transfers)"
    echo "  gold-exec     Execute GOLD distribution (individual transfers)"
    echo "  verify        Verify last distribution"
    echo "  status        Show distribution status and wallet balances"
    echo "  table         Show COLS-DIST table"
    echo "  help          Show this help"
    echo ""
    echo "Distribution explanation:"
    echo "  DAO Pool (1/3): Single tx to PeerMe contract → distributes to ALL COLS stakers"
    echo "  BONUS Pool (2/3): Individual transfers → addresses with BOTH EGLD + COLS"
    echo "  GOLD Pool: Service fee rebate → Gold NFT holders with EGLD delegation"
    echo ""
    echo "Typical daily workflow:"
    echo "  1. $0 fetch      # Update COLS stakers cache (SC query)"
    echo "  2. $0 all       # Calculate BONUS + GOLD distributions"
    echo "  3. $0 status    # Review status and amounts"
    echo "  4. $0 execute   # Send DAO + BONUS to blockchain"
    echo "  5. $0 gold-exec # Send GOLD to blockchain"
    echo "  6. $0 verify   # Verify transactions"
    ;;
esac