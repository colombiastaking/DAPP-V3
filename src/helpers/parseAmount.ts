/**
 * Parse amount string to a format suitable for transactions
 * Replacement for removed @multiversx/sdk-dapp/utils/operations/parseAmount
 */

/**
 * Parses a human-readable amount string to the format required by the blockchain
 * @param amount - The amount string (e.g., "1.5")
 * @param decimals - Number of decimals for the token (default 18)
 * @returns The amount as a string in smallest units
 */
export function parseAmount(amount: string, decimals: number = 18): string {
  if (!amount || amount === '') return '0';
  
  // Remove any commas and whitespace
  const cleanAmount = amount.replace(/[,\s]/g, '');
  
  // Split by decimal point
  const parts = cleanAmount.split('.');
  const wholePart = parts[0] || '0';
  let fractionalPart = parts[1] || '';
  
  // Pad or trim fractional part to match decimals
  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.substring(0, decimals);
  } else {
    fractionalPart = fractionalPart.padEnd(decimals, '0');
  }
  
  // Combine and remove leading zeros
  const result = (wholePart + fractionalPart).replace(/^0+/, '') || '0';
  
  return result;
}

/**
 * Converts denominated amount back to human-readable format
 * @param amount - The amount in smallest units
 * @param decimals - Number of decimals for the token (default 18)
 * @returns The human-readable amount string
 */
export function denominateAmount(amount: string, decimals: number = 18): string {
  if (!amount || amount === '0') return '0';
  
  // Pad with leading zeros if necessary
  const paddedAmount = amount.padStart(decimals + 1, '0');
  
  // Insert decimal point
  const wholePart = paddedAmount.slice(0, -decimals) || '0';
  const fractionalPart = paddedAmount.slice(-decimals).replace(/0+$/, '');
  
  if (fractionalPart) {
    return `${wholePart}.${fractionalPart}`;
  }
  return wholePart;
}

export default parseAmount;