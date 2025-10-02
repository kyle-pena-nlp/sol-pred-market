use anchor_lang::prelude::*;
use crate::state::{Market, Bet};
use crate::errors::ErrorCode;
use crate::state::BetEscrowFundsStatus;
use crate::state::EscrowAuthority;
use anchor_spl::token::{self, Transfer};
use anchor_spl::token::{Token, TokenAccount, Mint};
use crate::state::Outcome;

// user claims back their funds if the market is aborted
pub fn handler(ctx : Context<WithdrawAfterAbort>) -> Result<()> {
    let market = &mut ctx.accounts.market;


    // can't reclaim your bet if the market is not aborted
    if market.outcome != Some(Outcome::Aborted) {
        return Err(ErrorCode::MarketIsNotAborted.into());
    }

    // inspect the bet PDA associated with the player's bet for this market
    // can't withdraw if the funds associated with the bet are not backed with escrow
    let bet = &mut ctx.accounts.bet;
    if bet.escrow_funds_status != BetEscrowFundsStatus::Funded {
        return Err(ErrorCode::BetIsNotFunded.into());
    }

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.bettor_token_account.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        ),
        market.yes_wagered,
    )?;
    Ok(())
}


#[derive(Accounts)]
#[instruction(market_id : String)]
pub struct WithdrawAfterAbort<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bet", market_id.as_bytes(), signer.key().as_ref()],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    // the authority for the escrow - programatically derived as a PDA
    #[account(
        seeds = [b"escrow_authority", market.key().as_ref()],
        bump
    )]
    pub escrow_authority : Account<'info,EscrowAuthority>,    

    // PDA token account to hold escrow
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow_authority
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(mut, 
        constraint = bettor_token_account.owner == signer.key()
    )]
    pub bettor_token_account : Account<'info, TokenAccount>,
    
    // the mint of the token to be wagered
    pub mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}
