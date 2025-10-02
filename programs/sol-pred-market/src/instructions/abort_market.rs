
use anchor_lang::prelude::*;
use crate::state::Market;
use crate::errors::ErrorCode;
use crate::state::Outcome;

pub fn handler(ctx: Context<AbortMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    if ctx.accounts.signer.key() != market.authority {
        return Err(ErrorCode::Unauthorized.into());
    }

    market.is_closed = true;
    market.outcome = Some(Outcome::Aborted);

    Ok(())
}

#[derive(Accounts)]
#[instruction(market_id: String)] 
pub struct AbortMarket<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub signer: Signer<'info>,
}

