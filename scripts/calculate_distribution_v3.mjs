import * as fs from "fs";

// Configuration
const DELEGATION_CONTRACT = "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf";
const PRIMARY_PROVIDER_API = `https://staking.colombia-staking.com/mvx-api/providers/${DELEGATION_CONTRACT}`;

// Constants (SAME AS DAPP)
const AGENCY_BUYBACK = 0.30;
const DAO_DISTRIBUTION_RATIO = 0.333;
const BONUS_BUYBACK_FACTOR = 0.66;
const APR_MIN = 0.5;

// COLS stakers data from the existing script (hardcoded but verified)
const COLS_STAKERS_DATA = [
  {"address":"erd1teku5t356ukdsac9mrk4fukz4z3z955fsrt47275hyfn94rytrzqkvrjq9","colsStaked":33851.039239100304},
  {"address":"erd1zuqtzncs7d5sjxe5g70tvqgyqpm93nrymy9la0zn9y2gv7nk8aasqqd8k6","colsStaked":24999.999999999996},
  {"address":"erd1xy0x0kc98y0mhd338t23hfy47fqfkzeg3v5km5cqsx5c2en8ql2qf5c5xz","colsStaked":5954.2154489015975},
  {"address":"erd1r0ae7tqh78cwlneh2dzgdqextng9tpwvchrdu0edp234zemkgq8svf5hfh","colsStaked":3001.0550790885845},
  {"address":"erd12qctql4x96xsp6j89yczmpqknh4jfeyw2yqdmeupz77729devl6qfagklr","colsStaked":2861.6214992597993},
  {"address":"erd1ug4zrpflclqeryzx7sg3de9petgc9mzucxgm9en05duwvqt60yhs48xgh4","colsStaked":2446},
  {"address":"erd1ww7wmxvae5nqetcc0u6774n64zugdnjhte365qxm456w9r6rs5nsg9ywdu","colsStaked":2363.4433495690264},
  {"address":"erd1eqwpvgc6hz7he8qdh4ja8nnm3azwd3ymstr05rjhpvx3dsz8tpkshxv4z0","colsStaked":2023.6657262453857},
  {"address":"erd1qsktzdg5nr9rlvhsn3quaql93wlken8cvl9hmc0wfft6hep2z9mqtcaf96","colsStaked":1873.301149691792},
  {"address":"erd17kru87ga07sk86uwc92unw9wrwe3kx23quz8uz8ld6uvday8zjfqyawaud","colsStaked":1307.7944476118762},
  {"address":"erd1qcvgvjdnzavg8qnan650lgwrzt5f7dklphy29mvhv3jjgwqxcaqqe9qa6z","colsStaked":1304},
  {"address":"erd1kjdumnwcgpvhv97pn9n8cfy446kjsmxfmnwzr5h46e5z2pkj2v2q4nc2pp","colsStaked":1300},
  {"address":"erd1rs2ahye4c05lh72dd9w5xfzgay0avvxhl6pay73ufa9g6pspe6fsus27uz","colsStaked":1217.5636868122008},
  {"address":"erd1cm6n2ne4xnkzymztfr96lzryq67a2h627nfmxzqr5uckhyt3x4nqpl7sh5","colsStaked":978.2209591000005},
  {"address":"erd15msctu035g0q60t5jeu68myx5m9f2tnw8ksvc3225d09dj4ztslqwxeava","colsStaked":758.9583220353496},
  {"address":"erd1vt2thtexcm6c0e6a3kyyanl6hf9p8jqfazafa3rghva0ymtv2t0smjgdaj","colsStaked":737.763269791813},
  {"address":"erd134ljhgasqxnej06xl82v538aa6tk58kkwj9vsrwnxghrvyjwup3qad4fxx","colsStaked":736.3679042983293},
  {"address":"erd1hf75vlhed7awww20n0k6qdr9kmnqrtpmqay3ufccfmngdr2zn2kqpkml7d","colsStaked":629.0388387522991},
  {"address":"erd1gkd6f8wm79v3fsyyklp2qkhq0eek28cnr4jhj9h87zwqxwdz7uwstdzj3m","colsStaked":628.8700000000001},
  {"address":"erd1m0xca8u0jdla2rnlup0uqsqqryq4m78fnnd2h44sp8gne3mxr4sqm9dwpt","colsStaked":610},
  {"address":"erd1n2pdcvens5dsp2nlasx2sxz8saxhsethj9al8l87mvtxxvxex8fs70heqp","colsStaked":567.8546549801622},
  {"address":"erd1lrs7clh7u8jg5lraj6xg84qmk8ydzq55k5mk86mmwrg5dykyt8vqzv02fg","colsStaked":564.1124310479894},
  {"address":"erd1l69xx4nm8fhe5fsct89yz67dkdct4z2h93trefrfqq2gh8z3djgs6jwpvm","colsStaked":507.36658162999413},
  {"address":"erd1fek0dys3d3hkj5j6dvzwx2n4l74h66zqyhs5dglhdy7yutxtms5qlpt9tj","colsStaked":489.8414320493208},
  {"address":"erd1fgyymxlvfl9mtfxcu6rgf426getp2ygul80aysf8tg8mm58l0kls7memzv","colsStaked":477.9695115308805},
  {"address":"erd1mkqvhjtvw5rctshy5wltlg9gdxu0ux93n4ay99lvlz34nx29ynrq78mt6a","colsStaked":459.3499194480713},
  {"address":"erd1tmnvgsyv9ug7kvv5xz5w4m3yu3enh9gzga4wucant34vpvjsdyssn87mvx","colsStaked":435.3172411236241},
  {"address":"erd1z0xfyc5vyp84z4382s7se982z6dn4myyc2p6kumh90kww0w49vwssjh6uk","colsStaked":405.20475805718434},
  {"address":"erd1kddd2d2mjjamrk8q3xmcwpcklr55p6apxrt594nj99nk6arkepcq38hjz8","colsStaked":396.7673751938819},
  {"address":"erd1yw4wnufuq20lwu3uule7ftcjdvvt7sw6547fuf858kp33667muuswa5gem","colsStaked":372.9146960825707},
  {"address":"erd1mpg8tw0y8jx2eh5ek7qs48y7xp4skkp6z2xee2aej52uacz2uues6zf0d8","colsStaked":372.3036429979424},
  {"address":"erd1r57nmcgqywylaqfmttu9v0uup4766psugrsgy3twtqpyre3ftcgqy46def","colsStaked":358.3286184788477},
  {"address":"erd1eycnj39mcs3xvhq8d94qhh5xyrsaawh8hlr2nez6sjs5j5wpmn6s52g4rz","colsStaked":350},
  {"address":"erd14z2t2adpdd67yrxsfr078qptfn7t9gxdewvh45gejeeehyd22fds7t6uvn","colsStaked":343.02812546286077},
  {"address":"erd1ve3fp87vj0skvfxx042clvuydu4xxw2v5g7zwssc2ccvkyqdh26q9ls6va","colsStaked":337},
  {"address":"erd14ztdjd5a3gyn7f5l0jn6m2yuqsxlkr8w4z0jrfjtcygjm2k8w9wsec8xcs","colsStaked":59.12},
  {"address":"erd1xhg2fwxvg96ntjqlr233scfrwcgmrqsd7l8u3maymke5dectkn7slsmkw3","colsStaked":59.008559553030395}
];

// Fill in remaining stakers by loading from file
const COLS_STAKERS_FILE = '/tmp/cols_stakers.json';

async function loadColsStakers() {
  try {
    const data = fs.readFileSync(COLS_STAKERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    console.log("Using hardcoded COLS stakers data...");
    return COLS_STAKERS_DATA;
  }
}

async function fetchPrices() {
  const [egldRes, colsRes, providerRes] = await Promise.all([
    fetch("https://api.multiversx.com/economics"),
    fetch("https://api.multiversx.com/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7"),
    fetch(`${PRIMARY_PROVIDER_API}`)
  ]);
  
  const egldData = await egldRes.json();
  const colsData = await colsRes.json();
  const providerData = await providerRes.json();
  
  return {
    egldPrice: Number(egldData.price) || 0,
    colsPrice: Number(colsData?.[0]?.price) || 0,
    apr: providerData?.apr || 0,
    locked: providerData?.locked ? Number(providerData.locked) / 1e18 : 0
  };
}

async function fetchEgldStakes(addresses) {
  const url = `${PRIMARY_PROVIDER_API}/accounts?size=10000`;
  const res = await fetch(url);
  const data = await res.json();
  
  const map = {};
  const accounts = Array.isArray(data) ? data : (data.accounts || []);
  for (const a of accounts) {
    const v = Number(a.activeStake || a.stake || 0);
    map[a.address] = v > 1e12 ? v / 1e18 : v;
  }
  
  const found = addresses.filter(a => map[a] > 0).length;
  console.log(`Found EGLD stakes for ${found}/${addresses.length} COLS stakers`);
  
  return map;
}

async function main() {
  console.log("=".repeat(70));
  console.log("📊 COLS DAILY DISTRIBUTION CALCULATOR (Matching Dapp Logic)");
  console.log("=".repeat(70));
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log();

  // Load COLS stakers
  const colsStakers = await loadColsStakers();
  console.log(`COLS Stakers: ${colsStakers.length}`);
  
  // Fetch prices and provider data
  console.log("Fetching prices and provider data...");
  const { egldPrice, colsPrice, apr, locked } = await fetchPrices();
  
  console.log(`EGLD Price: $${egldPrice.toFixed(4)}`);
  console.log(`COLS Price: $${colsPrice.toFixed(6)}`);
  console.log(`Base APR: ${apr.toFixed(2)}%`);
  console.log(`Agency Locked EGLD: ${locked.toLocaleString()}`);
  console.log();
  
  // Fetch EGLD stakes for COLS stakers
  console.log("Fetching EGLD stakes for COLS stakers...");
  const egldMap = await fetchEgldStakes(colsStakers.map(s => s.address));
  
  // Build table
  const table = colsStakers.map(s => ({
    address: s.address,
    colsStaked: s.colsStaked,
    egldStaked: egldMap[s.address] || 0
  }));
  
  // Filter to eligible (both COLS and EGLD)
  const eligible = table.filter(r => r.colsStaked > 0 && r.egldStaked > 0);
  console.log(`\nEligible for BONUS APR (COLS + EGLD): ${eligible.length}`);
  
  if (eligible.length === 0) {
    console.error("ERROR: No eligible recipients found!");
    return;
  }
  console.log();

  // Constants
  const pE = egldPrice;
  const pC = colsPrice;
  const serviceFee = 0.10;
  const baseCorrected = apr / (1 - serviceFee) / 100;
  
  // Target daily bonus (same formula as dapp)
  const targetAvgDaily = (locked * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * pE) / pC / 365;
  console.log(`Target daily bonus pool: ${targetAvgDaily.toFixed(6)} COLS`);
  
  // Calculate ratios (same as dapp)
  let minRatio = Infinity, maxRatio = -Infinity;
  for (const r of eligible) {
    r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE);
    if (r.ratio < minRatio) minRatio = r.ratio;
    if (r.ratio > maxRatio) maxRatio = r.ratio;
  }
  console.log(`Ratio range: ${minRatio.toFixed(4)} - ${maxRatio.toFixed(4)}`);
  
  // Binary search for aprMax (same as dapp)
  let L = 0.5, R = 50, best = 15;
  const calc = (mx) => {
    let sum = 0;
    for (const r of eligible) {
      r.normalized = maxRatio !== minRatio ? (r.ratio - minRatio) / (maxRatio - minRatio) : 0;
      r.aprBonus = APR_MIN + (mx - APR_MIN) * Math.sqrt(r.normalized);
      sum += ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC;
    }
    return sum;
  };
  
  for (let i = 0; i < 30; i++) {
    const mid = (L + R) / 2;
    const sum = calc(mid);
    if (Math.abs(sum - targetAvgDaily) < 0.001) { best = mid; break; }
    sum < targetAvgDaily ? (L = mid) : (R = mid);
    best = mid;
  }
  
  calc(best);
  console.log(`Calculated APR max: ${best.toFixed(2)}%`);
  console.log();
  
  // Calculate daily COLS
  for (const r of eligible) {
    r.dailyCols = ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC;
  }
  
  // Sort by daily COLS
  eligible.sort((a, b) => b.dailyCols - a.dailyCols);
  
  // Calculate totals
  const totalDaily = eligible.reduce((s, r) => s + r.dailyCols, 0);
  
  // DAO pool (same formula as dapp)
  const sumCols = eligible.reduce((s, r) => s + r.colsStaked, 0);
  for (const r of eligible) {
    r.daoCols = ((locked * baseCorrected * AGENCY_BUYBACK * serviceFee * DAO_DISTRIBUTION_RATIO * r.colsStaked) 
      / sumCols / r.egldStaked) * pE / 365 / pC;
  }
  
  const totalDao = eligible.reduce((s, r) => s + r.daoCols, 0);
  
  console.log("-".repeat(70));
  console.log("📋 TOP 20 BONUS RECIPIENTS:");
  console.log("-".repeat(70));
  
  for (let i = 0; i < Math.min(20, eligible.length); i++) {
    const r = eligible[i];
    console.log(`${(i+1).toString().padStart(3)}. ${r.address}`);
    console.log(`     EGLD: ${r.egldStaked.toFixed(2).padStart(12)} | COLS: ${r.colsStaked.toFixed(2).padStart(12)} | Ratio: ${r.ratio.toFixed(3)}`);
    console.log(`     APR Bonus: ${r.aprBonus.toFixed(1)}% | Daily: ${r.dailyCols.toFixed(6)} COLS (bonus) + ${r.daoCols.toFixed(6)} COLS (dao)`);
  }
  
  console.log();
  console.log("-".repeat(70));
  console.log("SUMMARY:");
  console.log("-".repeat(70));
  console.log(`COLS Stakers (total): ${colsStakers.length}`);
  console.log(`COLS Stakers with EGLD: ${eligible.length}`);
  console.log();
  console.log(`Total Daily BONUS Pool: ${totalDaily.toFixed(6)} COLS`);
  console.log(`Total Daily DAO Pool: ${totalDao.toFixed(6)} COLS`);
  console.log(`Total Daily Distribution: ${(totalDaily + totalDao).toFixed(6)} COLS`);
  console.log();
  console.log(`COLS Price: $${colsPrice.toFixed(6)}`);
  console.log(`EGLD Price: $${egldPrice.toFixed(4)}`);
  console.log(`Base APR: ${apr.toFixed(2)}%`);
  console.log(`APR Max: ${best.toFixed(2)}%`);
  
  // Save
  const outputPath = '/tmp/distribution_list_v3.txt';
  fs.writeFileSync(outputPath, eligible.map(r => 
    `${r.address};${r.dailyCols.toFixed(6)};${r.daoCols.toFixed(6)}`
  ).join('\n'));
  console.log(`\n✅ Saved ${eligible.length} recipients to ${outputPath}`);
  
  const jsonPath = '/tmp/distribution_full_v3.json';
  fs.writeFileSync(jsonPath, JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    colsPrice, egldPrice, apr, aprMax: best, locked,
    totalDailyBonus: totalDaily, totalDailyDao: totalDao,
    totalDaily: totalDaily + totalDao,
    colsStakersTotal: colsStakers.length, bonusEligible: eligible.length,
    stakers: eligible
  }, null, 2));
  console.log(`✅ Saved full data to ${jsonPath}`);
}

main().catch(console.error);
