import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { IDL, SolPredMarket } from './idl';

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || '8WAGVU5JeuxzMzC3BgV2EvT1i2UPP2QSi4ABQegfck7Z'
);

export function getProgram(provider: AnchorProvider): Program<SolPredMarket> {
  return new Program(IDL, provider);
}

export function getMarketPDA(marketId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('market'), Buffer.from(marketId)],
    PROGRAM_ID
  );
}

export function getBetPDA(marketId: string, bettor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), Buffer.from(marketId), bettor.toBuffer()],
    PROGRAM_ID
  );
}

export function getEscrowPDA(marketId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(marketId)],
    PROGRAM_ID
  );
}

export function getEscrowAuthorityPDA(marketId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_authority'), Buffer.from(marketId)],
    PROGRAM_ID
  );
}
