/**
 * Verify Distribution Results
 * 
 * Checks blockchain for actual ESDT transfers after distribution.
 * Important: Transaction "success" status doesn't mean tokens were transferred!
 * 
 * Usage:
 *   node verify_distribution.mjs [results_file]
 */

import fs from 'fs';

const CONFIG = {
  gatewayUrl: 'https://gateway.multiversx.com',
  apiUrl: 'https://api.multiversx.com',
  colsToken: 'COLS-9d91b7',
};

async function fetchWithRetry(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await fetch(url, { timeout: 15000 });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      if (i === 2) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function verifyTransaction(txHash) {
  const url = `${CONFIG.gatewayUrl}/transaction/${txHash}?withResults=true`;
  const data = await fetchWithRetry(url);
  const tx = data?.data?.transaction || {};
  
  const result = {
    hash: txHash,
    status: tx.status,
    hasLogs: !!tx.logs,
    hasESDTEvent: false,
    esdtAmount: null,
    recipient: tx.receiver,
  };
  
  // Check for ESDT transfer events
  if (tx.logs?.events) {
    for (const event of tx.logs.events) {
      if (event.identifier === 'ESDTTransfer' || event.identifier === 'ESDTLocalMint') {
        // Check if it's COLS
        const topics = event.topics || [];
        if (topics.length >= 1) {
          const tokenId = Buffer.from(topics[0], 'base64').toString();
          if (tokenId === CONFIG.colsToken) {
            result.hasESDTEvent = true;
            if (topics.length >= 2) {
              const amountBytes = Buffer.from(topics[1] || '', 'base64');
              result.esdtAmount = Number(BigInt('0x' + amountBytes.toString('hex'))) / 1e18;
            }
          }
        }
      }
    }
  }
  
  // Also check smartContractResults
  if (tx.smartContractResults) {
    for (const scr of tx.smartContractResults) {
      if (scr.data?.includes('ESDTTransfer') && scr.data?.includes('COLS')) {
        result.hasESDTEvent = true;
      }
    }
  }
  
  return result;
}

async function verifyRecipientBalance(address) {
  const url = `${CONFIG.apiUrl}/accounts/${address}/tokens/${CONFIG.colsToken}`;
  try {
    const data = await fetchWithRetry(url);
    if (data.balance) {
      return Number(data.balance) / 1e18;
    }
  } catch {}
  return null;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🔍 DISTRIBUTION VERIFICATION');
  console.log('═'.repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log();
  
  // Find the most recent results file
  const resultsDir = '/tmp/cols_distribution';
  const args = process.argv.slice(2);
  
  let resultsFile;
  if (args[0]) {
    resultsFile = args[0];
  } else {
    // Find latest results file
    if (!fs.existsSync(resultsDir)) {
      console.log('❌ No results directory found');
      process.exit(1);
    }
    
    const files = fs.readdirSync(resultsDir)
      .filter(f => f.startsWith('results_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.log('❌ No results files found');
      process.exit(1);
    }
    
    resultsFile = `${resultsDir}/${files[0]}`;
  }
  
  console.log(`Results file: ${resultsFile}`);
  
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  
  // Verify DAO transaction
  if (results.dao?.hash) {
    console.log('\n🏛️ DAO Distribution:');
    console.log(`  Hash: ${results.dao.hash}`);
    
    const daoVerification = await verifyTransaction(results.dao.hash);
    console.log(`  Status: ${daoVerification.status}`);
    console.log(`  Has ESDT Event: ${daoVerification.hasESDTEvent ? '✅ YES' : '❌ NO'}`);
    
    if (daoVerification.hasESDTEvent) {
      console.log(`  Amount: ${daoVerification.esdtAmount?.toFixed(6) || 'N/A'} COLS`);
    } else {
      console.log(`  ⚠️ WARNING: No ESDT events found! Tokens may not have been transferred.`);
    }
  }
  
  // Verify BONUS transactions
  if (results.bonus && results.bonus.length > 0) {
    console.log('\n💰 BONUS Distribution:');
    
    // Check a sample of transactions
    const sampleSize = Math.min(20, results.bonus.length);
    const sampleIndices = [
      0, 1, 2, 3, 4, 5, // First few
      Math.floor(results.bonus.length * 0.25),
      Math.floor(results.bonus.length * 0.5),
      Math.floor(results.bonus.length * 0.75),
      results.bonus.length - 1, // Last
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, sampleSize);
    
    let successCount = 0;
    let failCount = 0;
    
    console.log(`  Checking ${sampleIndices.length} sample transactions...`);
    
    for (const i of sampleIndices) {
      const tx = results.bonus[i];
      if (!tx.hash) {
        console.log(`  [${i}] No hash (preview mode?)`);
        continue;
      }
      
      const verification = await verifyTransaction(tx.hash);
      
      if (verification.hasESDTEvent) {
        successCount++;
        console.log(`  [${i}] ✅ ${tx.recipient?.slice(0, 20)}... → ${tx.amount?.toFixed(6)} COLS`);
      } else {
        failCount++;
        console.log(`  [${i}] ❌ ${tx.recipient?.slice(0, 20)}... → NO ESDT EVENT`);
      }
    }
    
    // Count total with hashes
    const withHash = results.bonus.filter(t => t.hash).length;
    console.log(`\n  Summary:`);
    console.log(`    Total transactions: ${results.bonus.length}`);
    console.log(`    With hash: ${withHash}`);
    console.log(`    Sample verified ✅: ${successCount}`);
    console.log(`    Sample failed ❌: ${failCount}`);
    
    if (failCount > 0) {
      console.log(`\n  ⚠️ Some transactions may have failed to transfer tokens!`);
      console.log(`  Run a full verification with: node verify_distribution.mjs --full`);
    }
  }
  
  // Full verification mode
  if (args.includes('--full') && results.bonus) {
    console.log('\n\n🔍 Full Verification Mode...');
    
    let verifiedTxs = [];
    for (let i = 0; i < results.bonus.length; i++) {
      const tx = results.bonus[i];
      if (!tx.hash) continue;
      
      const verification = await verifyTransaction(tx.hash);
      verifiedTxs.push({
        index: i,
        hash: tx.hash,
        recipient: tx.recipient,
        expected: tx.amount,
        hasESDT: verification.hasESDTEvent,
        actual: verification.esdtAmount,
      });
      
      if ((i + 1) % 20 === 0) {
        console.log(`  Progress: ${i + 1}/${results.bonus.length}`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Save verified results
    const verifiedFile = resultsFile.replace('.json', '_verified.json');
    fs.writeFileSync(verifiedFile, JSON.stringify(verifiedTxs, null, 2));
    console.log(`\n✅ Verified results saved to: ${verifiedFile}`);
    
    // Summary
    const successful = verifiedTxs.filter(t => t.hasESDT).length;
    const failed = verifiedTxs.filter(t => !t.hasESDT).length;
    const totalSent = verifiedTxs.filter(t => t.hasESDT).reduce((s, t) => s + (t.expected || 0), 0);
    
    console.log(`\n📊 Full Summary:`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total COLS confirmed: ${totalSent.toFixed(6)}`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed transactions:`);
      verifiedTxs.filter(t => !t.hasESDT).forEach(t => {
        console.log(`  [${t.index}] ${t.hash} → ${t.recipient?.slice(0, 20)}...`);
      });
    }
  }
  
  console.log('\n═'.repeat(70));
  console.log('Verification complete');
  console.log('═'.repeat(70));
}

main().catch(console.error);