import * as anchor from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";


// anchor IDL derived types
export type MarketAccount = anchor.IdlTypes<SolPredMarket>['market'];
export type MarketResolution = anchor.IdlTypes<SolPredMarket>['marketResolution'];
export type BetEscrowFundsStatus = anchor.IdlTypes<SolPredMarket>['betEscrowFundsStatus'];
export type Bet = anchor.IdlTypes<SolPredMarket>['bet'];
export type EscrowAuthority = anchor.IdlTypes<SolPredMarket>['escrowAuthority'];

// custom types just for the tests

export type CreateMarketArgs = {
  wallet: anchor.Wallet,
  program: anchor.Program<SolPredMarket>,
  marketId: string,
  feeBps: number,
  question: string
};

export type CreateMarketResult = {
  tx: string,
  marketAccount: MarketAccount,
  bumps: {
    marketBump: number,
    escrowBump: number,
    escrowAuthorityBump: number
  },
  marketPda: anchor.web3.PublicKey,
  escrowAuthorityPDA: anchor.web3.PublicKey,
  escrowPda: anchor.web3.PublicKey
}