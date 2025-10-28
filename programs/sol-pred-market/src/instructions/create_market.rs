use anchor_lang::prelude::*;
use crate::state::{Market, EscrowAuthority};
use anchor_spl::token::{Token, TokenAccount, Mint};


pub fn handler(ctx : Context<CreateMarket>, 
    market_id: String,
    fee_bps: u16,
    question: String) -> Result<()> {
    
    let market = &mut ctx.accounts.market;
    let bumps = ctx.bumps;

    market.authority = ctx.accounts.signer.key();
    market.bump = bumps.market;
    market.escrow_bump = bumps.escrow_authority;
    market.escrow_authority_bump = bumps.escrow_authority;
    market.escrow_bump = bumps.escrow;

    market.fee_bps = fee_bps;
    market.market_id = market_id;
    market.question = question;

    market.is_closed = false;
    market.outcome = None;
    market.yes_wagered = 0;
    market.no_wagered = 0;
    
    let escrow_authority = &mut ctx.accounts.escrow_authority;
    escrow_authority.bump = bumps.escrow_authority;

    Ok(())
}


#[derive(Accounts)] 
#[instruction(market_id: String)] // might better read as: instruction parameter declaration
pub struct CreateMarket<'info> {

    // the market data account
    #[account(
        init,
        payer = signer,
        space = 8 + Market::LEN,
        seeds = [ b"market", market_id.as_bytes() ],
        bump
    )]
    pub market: Account<'info, Market>,

    // the signer of the transaction
    #[account(mut)]
    pub signer: Signer<'info>,    

    // the authority for the escrow - programatically derived as a PDA
    #[account(
        init,
        payer = signer,
        space = 8 + EscrowAuthority::LEN,
        seeds = [b"escrow_authority", market.key().as_ref()],
        bump
    )]
    pub escrow_authority : Account<'info, EscrowAuthority>,

    // PDA token account to hold escrow
    #[account(
        init,
        payer = signer,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = escrow_authority
    )]
    pub escrow: Account<'info, TokenAccount>,

    // the mint of the token to be wagered
    pub mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,
}
