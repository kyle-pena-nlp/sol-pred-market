import * as anchor from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";

export type CreateMarketArgs = {
  wallet: anchor.Wallet,
  program: anchor.Program<SolPredMarket>,
  marketId: string,
  feeBps: number,
  question: string
};

export type CreateMarketResult = {
  tx: string,
  marketAccount: Market,
  bumps: {
    marketBump: number,
    escrowBump: number,
    escrowAuthorityBump: number
  },
  marketPda: anchor.web3.PublicKey,
  escrowAuthorityPDA: anchor.web3.PublicKey,
  escrowPda: anchor.web3.PublicKey
}