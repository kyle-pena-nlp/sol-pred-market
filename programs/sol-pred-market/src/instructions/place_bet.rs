use anchor_lang::prelude::*;
use crate::state::{Market, Bet};
use crate::errors::ErrorCode;
use crate::state::MarketResolution;
use crate::state::BetEscrowFundsStatus;
use crate::state::EscrowAuthority;
use anchor_spl::token::{self, Transfer};
use anchor_spl::token::{Token, TokenAccount, Mint};


pub fn handler(ctx : Context<PlaceBet>, _market_id : String, amount : u64, wagered_outcome: MarketResolution) -> Result<()> {
    
    let market = &mut ctx.accounts.market;

    // cannot place a bet on a market that is closed due to being aborted, resolved, etc.
    if market.is_closed {
        return Err(ErrorCode::MarketIsClosed.into());
    }

    msg!("here");

    // transfer appropriate funds into escrow
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.bettor_token_account.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        ),
        amount,
    )?;

    msg!("here again");

    // initialize the bet - `init` attribute prevents double initialization
    let bet = &mut ctx.accounts.bet;

    bet.authority = ctx.accounts.signer.key();
    bet.bump = ctx.bumps.bet;
    bet.amount = amount;
    bet.wagered_outcome = wagered_outcome;
    bet.escrow_funds_status = BetEscrowFundsStatus::Funded;
    
    // update the market totals
    match wagered_outcome {
        MarketResolution::Yes => market.yes_wagered += amount,
        MarketResolution::No => market.no_wagered += amount,
    }
    Ok(())
}


#[derive(Accounts)]
#[instruction(market_id : String)]
pub struct PlaceBet<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    // the bettor
    #[account(mut)]
    pub signer: Signer<'info>,

    // the authority for the escrow - programatically derived as a PDA
    #[account(
        seeds = [b"escrow_authority", market.key().as_ref()],
        bump
    )]
    pub escrow_authority : Account<'info, EscrowAuthority>,    

    // PDA token account to hold escrow
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow_authority
    )]
    pub escrow: Account<'info, TokenAccount>,    

    #[account(
        mut, 
        constraint = bettor_token_account.owner == signer.key() @ ErrorCode::Unauthorized,
        constraint = bettor_token_account.mint == escrow.mint @ ErrorCode::InvalidToken,
    )]
    pub bettor_token_account : Account<'info, TokenAccount>,

    #[account(
        init,
        payer = signer,
        seeds = [b"bet", market.key().as_ref(), signer.key().as_ref()],
        bump,
        space = 8 + Bet::LEN
    )]
    pub bet : Account<'info, Bet>,

    // the mint of the token to be wagered
    pub mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
}
