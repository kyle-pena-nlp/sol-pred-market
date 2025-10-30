import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import {
  getProgram,
  getMarketPDA,
  getBetPDA,
  getEscrowPDA,
  getEscrowAuthorityPDA,
} from '../anchor/program';

export async function createMarket(
  provider: AnchorProvider,
  marketId: string,
  question: string,
  feeBps: number,
  mint: PublicKey
) {
  const program = getProgram(provider);
  const [marketPDA] = getMarketPDA(marketId);
  const [escrowPDA] = getEscrowPDA(marketId);
  const [escrowAuthorityPDA] = getEscrowAuthorityPDA(marketId);

  const tx = await program.methods
    .createMarket(marketId, feeBps, question)
    .accounts({
      market: marketPDA,
      escrow: escrowPDA,
      escrowAuthority: escrowAuthorityPDA,
      mint: mint,
      authority: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { signature: tx, marketPDA };
}

export async function placeBet(
  provider: AnchorProvider,
  marketId: string,
  amount: number,
  wageredOutcome: 'Yes' | 'No',
  mint: PublicKey
) {
  const program = getProgram(provider);
  const [marketPDA] = getMarketPDA(marketId);
  const [betPDA] = getBetPDA(marketId, provider.wallet.publicKey);
  const [escrowPDA] = getEscrowPDA(marketId);
  const [escrowAuthorityPDA] = getEscrowAuthorityPDA(marketId);

  const userAta = await getAssociatedTokenAddress(mint, provider.wallet.publicKey);

  const outcome = wageredOutcome === 'Yes' ? { yes: {} } : { no: {} };

  const tx = await program.methods
    .placeBet(marketId, new BN(amount), outcome)
    .accounts({
      market: marketPDA,
      bet: betPDA,
      escrow: escrowPDA,
      escrowAuthority: escrowAuthorityPDA,
      mint: mint,
      userAta: userAta,
      bettor: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { signature: tx, betPDA };
}

export async function claimReward(
  provider: AnchorProvider,
  marketId: string,
  mint: PublicKey
) {
  const program = getProgram(provider);
  const [marketPDA] = getMarketPDA(marketId);
  const [betPDA] = getBetPDA(marketId, provider.wallet.publicKey);
  const [escrowPDA] = getEscrowPDA(marketId);
  const [escrowAuthorityPDA] = getEscrowAuthorityPDA(marketId);

  const userAta = await getAssociatedTokenAddress(mint, provider.wallet.publicKey);

  const tx = await program.methods
    .claimReward(marketId)
    .accounts({
      market: marketPDA,
      bet: betPDA,
      escrow: escrowPDA,
      escrowAuthority: escrowAuthorityPDA,
      mint: mint,
      userAta: userAta,
      bettor: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { signature: tx };
}

export async function resolveMarket(
  provider: AnchorProvider,
  marketId: string,
  resolution: 'Yes' | 'No'
) {
  const program = getProgram(provider);
  const [marketPDA] = getMarketPDA(marketId);

  const outcome = resolution === 'Yes' ? { yes: {} } : { no: {} };

  const tx = await program.methods
    .resolveMarket(marketId, outcome)
    .accounts({
      market: marketPDA,
      authority: provider.wallet.publicKey,
    })
    .rpc();

  return { signature: tx };
}

export async function abortMarket(provider: AnchorProvider, marketId: string) {
  const program = getProgram(provider);
  const [marketPDA] = getMarketPDA(marketId);

  const tx = await program.methods
    .abortMarket(marketId)
    .accounts({
      market: marketPDA,
      authority: provider.wallet.publicKey,
    })
    .rpc();

  return { signature: tx };
}

export async function fetchMarket(provider: AnchorProvider, marketId: string) {
  const program = getProgram(provider);
  const [marketPDA] = getMarketPDA(marketId);

  const marketAccount = await program.account.market.fetch(marketPDA);
  return { ...marketAccount, publicKey: marketPDA };
}

export async function fetchAllMarkets(provider: AnchorProvider) {
  const program = getProgram(provider);
  const markets = await program.account.market.all();
  return markets;
}
