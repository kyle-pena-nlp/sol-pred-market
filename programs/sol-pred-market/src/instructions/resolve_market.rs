use anchor_lang::prelude::*;
use crate::state::{Market};
use crate::errors::ErrorCode;
use crate::state::MarketResolution;

pub fn handler(ctx : Context<ResolveMarket>, _market_id : String, resolution : MarketResolution) -> Result<()> {
    let market = &mut ctx.accounts.market;

    market.is_closed = true;
    market.outcome = Some(resolution.to_outcome());

    Ok(())
}


#[derive(Accounts)]
#[instruction(market_id: String)] 
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.as_bytes()],
        bump,
        constraint = market.authority == signer.key() @ ErrorCode::Unauthorized
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub signer: Signer<'info>,
}
