export interface DelegationContractType {
  name: string;
  gasLimit: number;
  data: string;
}

interface NetworkType {
  id: 'devnet' | 'testnet' | 'mainnet';
  name: string;
  egldLabel: string;
  walletAddress: string;
  gatewayAddress: string;
  explorerAddress: string;
  delegationContract: string;
  apiAddress: string;
}

export const minDust = '5000000000000000'; // 0.005 EGLD
export const dAppName = 'Dapp';
export const decimals = 2;
export const denomination = 18;
export const genesisTokenSupply = 20000000;
export const feesInEpoch = 0;
export const stakePerNode = 2500;
export const protocolSustainabilityRewards = 0.1;
export const yearSettings = [
  { year: 1, maximumInflation: 0.1084513 },
  { year: 2, maximumInflation: 0.09703538 },
  { year: 3, maximumInflation: 0.08561945 },
  { year: 4, maximumInflation: 0.07420352 },
  { year: 5, maximumInflation: 0.0627876 },
  { year: 6, maximumInflation: 0.05137167 },
  { year: 7, maximumInflation: 0.03995574 },
  { year: 8, maximumInflation: 0.02853982 },
  { year: 9, maximumInflation: 0.01712389 },
  { year: 10, maximumInflation: 0.00570796 },
  { year: 11, maximumInflation: 0.0 }
];
export const auctionContract =
  'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqplllst77y4l';
export const stakingContract =
  'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqllls0lczs7';
export const delegationManagerContract =
  'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqylllslmq6y6';

const PRIMARY_API = 'https://staking.colombia-staking.com/mvx-api';
const SECONDARY_API = 'https://api.multiversx.com';

const PRIMARY_GATEWAY = 'https://staking.colombia-staking.com/gateway';
const SECONDARY_GATEWAY = 'https://gateway.multiversx.com';

// default network object
export const network: NetworkType = {
  id: 'mainnet',
  name: 'Mainnet',
  egldLabel: 'EGLD',
  walletAddress: 'https://wallet.multiversx.com/dapp/init',
  apiAddress: PRIMARY_API, // will be updated dynamically
  gatewayAddress: PRIMARY_GATEWAY, // will be updated dynamically
  explorerAddress: 'https://explorer.multiversx.com',
  delegationContract:
    'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf'
};

// Robust API health check
async function checkApiHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${url}/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7`
    );

    if (!res.ok) {
      console.warn(`API check failed: ${url} returned status ${res.status}`);
      return false;
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      console.warn(`API check failed: ${url} returned non-array data`);
      return false;
    }

    if (data.length === 0) {
      console.warn(`API check failed: ${url} returned empty array`);
      return false;
    }

    const price = data[0].price;

    if (typeof price !== 'number') {
      console.warn(`API check failed: ${url} returned price of type ${typeof price}`);
      return false;
    }

    if (price <= 0) {
      console.warn(`API check failed: ${url} returned invalid price ${price}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn(`API check error for ${url}:`, err);
    return false;
  }
}

// Robust Gateway health check
async function checkGatewayHealth(url: string): Promise<boolean> {
  try {
    // Simple GET to root or health endpoint
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
    // fallback: try GET root
    const res2 = await fetch(url);
    return res2.ok;
  } catch (err) {
    console.warn(`Gateway check error for ${url}:`, err);
    return false;
  }
}

// initialize network API and gateway on app startup
export async function initNetworkApi(): Promise<void> {
  const primaryApiOk = await checkApiHealth(PRIMARY_API);
  if (primaryApiOk) {
    network.apiAddress = PRIMARY_API;
    console.log(`Using primary API: ${PRIMARY_API}`);
  } else {
    network.apiAddress = SECONDARY_API;
    console.log(`Primary API failed, falling back to secondary API: ${SECONDARY_API}`);
  }

  const primaryGatewayOk = await checkGatewayHealth(PRIMARY_GATEWAY);
  if (primaryGatewayOk) {
    network.gatewayAddress = PRIMARY_GATEWAY;
    console.log(`Using primary Gateway: ${PRIMARY_GATEWAY}`);
  } else {
    network.gatewayAddress = SECONDARY_GATEWAY;
    console.log(`Primary Gateway failed, falling back to secondary Gateway: ${SECONDARY_GATEWAY}`);
  }
}

export const delegationContractData: DelegationContractType[] = [
  { name: 'createNewDelegationContract', gasLimit: 6000000, data: 'createNewDelegationContract@' },
  { name: 'setAutomaticActivation', gasLimit: 6000000, data: 'setAutomaticActivation@' },
  { name: 'setMetaData', gasLimit: 6000000, data: 'setMetaData@' },
  { name: 'setReDelegateCapActivation', gasLimit: 6000000, data: 'setCheckCapOnReDelegateRewards@' },
  { name: 'changeServiceFee', gasLimit: 6000000, data: 'changeServiceFee@' },
  { name: 'modifyTotalDelegationCap', gasLimit: 6000000, data: 'modifyTotalDelegationCap@' },
  { name: 'addNodes', gasLimit: 12000000, data: 'addNodes' },
  { name: 'removeNodes', gasLimit: 12000000, data: 'removeNodes@' },
  { name: 'stakeNodes', gasLimit: 12000000, data: 'stakeNodes@' },
  { name: 'reStakeUnStakedNodes', gasLimit: 120000000, data: 'reStakeUnStakedNodes@' },
  { name: 'unStakeNodes', gasLimit: 12000000, data: 'unStakeNodes@' },
  { name: 'unBondNodes', gasLimit: 12000000, data: 'unBondNodes@' },
  { name: 'unJailNodes', gasLimit: 12000000, data: 'unJailNodes@' },
  { name: 'delegate', gasLimit: 12000000, data: 'delegate' },
  { name: 'unDelegate', gasLimit: 12000000, data: 'unDelegate@' },
  { name: 'withdraw', gasLimit: 12000000, data: 'withdraw' },
  { name: 'claimRewards', gasLimit: 6000000, data: 'claimRewards' },
  { name: 'reDelegateRewards', gasLimit: 12000000, data: 'reDelegateRewards' }
];
