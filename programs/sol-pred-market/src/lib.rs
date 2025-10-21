use anchor_lang::prelude::*;

declare_id!("8WAGVU5JeuxzMzC3BgV2EvT1i2UPP2QSi4ABQegfck7Z");

pub mod errors;
pub use errors::ErrorCode;

pub mod state;
pub use state::*;

pub mod instructions;
use instructions::*;


#[program]
pub mod sol_pred_market {

    use super::*;

    pub fn abort_market(context: Context<AbortMarket>, market_id : String) -> Result<()> {
        instructions::abort_market::handler(context, market_id)
    }

    pub fn claim_reward(context: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(context)
    }

    pub fn create_market(context: Context<CreateMarket>, market_id: String, fee_bps: u16, question: String) -> Result<()> {
        instructions::create_market::handler(context, market_id, fee_bps, question)
    }

    pub fn place_bet(context: Context<PlaceBet>, amount: u64, wagered_outcome: MarketResolution) -> Result<()> {
        instructions::place_bet::handler(context, amount, wagered_outcome)
    }

    pub fn resolve_market(context: Context<ResolveMarket>, market_id : String, resolution: MarketResolution) -> Result<()> {
        instructions::resolve_market::handler(context, market_id, resolution)
    }

    pub fn withdraw_after_abort(context: Context<WithdrawAfterAbort>) -> Result<()> {
        instructions::withdraw_after_abort::handler(context)
    }


}