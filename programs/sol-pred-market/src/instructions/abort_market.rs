
use anchor_lang::prelude::*;
use crate::state::Market;
use crate::errors::ErrorCode;
use crate::state::Outcome;

pub fn handler(ctx: Context<AbortMarket>, _market_id: String) -> Result<()> {
    let market = &mut ctx.accounts.market;

    market.is_closed = true;
    market.outcome = Some(Outcome::Aborted);

    Ok(())
}

#[derive(Accounts)]
#[instruction(market_id: String)] 
pub struct AbortMarket<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        constraint = signer.key() == market.authority @ ErrorCode::Unauthorized,
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub signer: Signer<'info>,
}

