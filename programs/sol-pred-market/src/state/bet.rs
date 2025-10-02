use anchor_lang::prelude::*;
use crate::state::MarketResolution;

#[account]
pub struct Bet {
    pub authority: Pubkey,
    pub bump: u8,
    pub amount: u64,
    pub wagered_outcome: MarketResolution,
    pub escrow_funds_status: BetEscrowFundsStatus,
}

impl Bet {
    pub const LEN: usize = 32 // authority
        + 1 // bump
        + 8 // amount
        + 1 // wagered_outcome
        + 1; // escrow_funds_status
}

// =====================
// Enums
// =====================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BetEscrowFundsStatus {
    Funded,
    Withdrawn,
}
