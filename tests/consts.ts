import { BetEscrowFundsStatus, MarketResolution } from "./types";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { NATIVE_MINT, 
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";

export const YES: MarketResolution = { yes: {} };
export const NO:  MarketResolution = { no: {} };

export const FUNDED : BetEscrowFundsStatus = { funded: {} };
export const WITHDRAWN : BetEscrowFundsStatus = { withdrawn: {} };

export { TOKEN_PROGRAM_ID, NATIVE_MINT, ASSOCIATED_TOKEN_PROGRAM_ID };