import { fetchWithBackup } from '../utils/resilientApi';

interface GetLatestTransactionsType {
  apiAddress: string;
  // Removed unused parameters
}

// Use query-string format for Colombia proxy
const PRIMARY_API = 'https://staking.colombia-staking.com/mvxproxy.php?service=api&endpoint=';
const BACKUP_API = 'https://api.multiversx.com';

const fetchTransactions = (url: string) =>
  async function getTransactions({
    apiAddress
  }: GetLatestTransactionsType) {
    const primaryUrl = `${apiAddress}${url}`;
    const backupUrl = primaryUrl.replace(PRIMARY_API, BACKUP_API);

    try {
      const data = await fetchWithBackup(primaryUrl, backupUrl, 3, 2000);

      return {
        data: data,
        success: data !== undefined && data !== null
      };
    } catch {
      return {
        success: false
      };
    }
  };

export const getTransactions = fetchTransactions('/transactions');
export const getTransactionsCount = fetchTransactions('/transactions/count');
