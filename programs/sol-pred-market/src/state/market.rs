use anchor_lang::prelude::*;
use crate::state::Outcome;

#[account]
pub struct Market {
    // admin
    pub authority: Pubkey,
    pub bump: u8,
    pub fee_bps: u16,

    // market info
    pub market_id: String,
    pub question: String,

    // status
    pub is_closed: bool,
    pub outcome: Option<Outcome>,

    // totals
    pub yes_wagered: u64,
    pub no_wagered: u64,

    pub market_dump: u8,
    pub escrow_bump: u8,
    pub escrow_authority_bump: u8
}

impl Market {
    pub const LEN: usize = 8
        + 32 // authority
        + 1  // bump
        + 2  // fee_bps
        + 4 + 32 // market_id string (4-byte prefix + max 32 bytes)
        + 4 + 32 // question string (4-byte prefix + max 32 bytes)
        + 1  // is_closed
        + 1  // outcome
        + 8  // yes_wagered
        + 8  // no_wagered
        + 1  // market_dump
        + 1  // escrow_bump
        + 1; // escrow_authority_bump
}
