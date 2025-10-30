import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js';

const commitment: Commitment = 'confirmed';

export function getConnection(): Connection {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(endpoint, commitment);
}

export const connection = getConnection();
