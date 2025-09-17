import axios, { AxiosResponse } from 'axios';

/**
 * Fetch data from a primary API with retry and fallback to backup API.
 */
export async function fetchWithBackup<T = any>(
  primaryUrl: string,
  backupUrl: string,
  retries = 2,
  delayMs = 2000
): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const { data }: AxiosResponse<T> = await axios.get(primaryUrl);

      // Detect "rate limit" error in body
      if (data && typeof data === 'object' && 'error' in (data as any)) {
        const errStr = String((data as any).error).toLowerCase();
        if (errStr.includes('rate limit')) {
          if (i < retries - 1) {
            await new Promise(res => setTimeout(res, delayMs));
            continue;
          }
          break;
        }
      }
      return data;
    } catch {
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delayMs));
        continue;
      }
      break;
    }
  }

  // Backup API
  try {
    const { data: backupData }: AxiosResponse<T> = await axios.get(backupUrl);
    return backupData;
  } catch (err) {
    console.error('Both primary and backup API failed', err);
    return null;
  }
}
