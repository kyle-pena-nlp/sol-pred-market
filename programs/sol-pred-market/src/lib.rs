use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

declare_id!("8WAGVU5JeuxzMzC3BgV2EvT1i2UPP2QSi4ABQegfck7Z");

#[program]
pub mod sol_pred_market {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn create_market(ctx : Context<CreateMarket>, market_id: String) -> Result<()> {
        Ok(())
    }

    pub fn abort_market(ctx: Context<AbortMarket>) -> Result<()> {
        Ok(())
    }

    pub fn resolve_market(ctx : Context<ResolveMarket>) -> Result<()> {
        Ok(())
    }

    pub fn place_bet(ctx: Context<PlaceBet>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)] 
#[instruction(market_id: String)] // might better read as: instruction parameter declaration
pub struct CreateMarket<'info> {
    #[account(
        init,
        seeds = [ b"market", market_id.as_bytes() ],
        bump,
        payer = authority,
        space = 8 + Market::LEN
    )]
    pub market: Account<'info, Market>,

    // is an empty account used for a PDA signer
    #[account(
        seeds = [b"escrow_authority", market.key().as_ref()],
        bump
    )]
    pub escrow_authority : UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = escrow_authority
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub rent: Sysvar<'info, Rent>,
}


#[derive(Accounts)]
#[instruction(market_id: String)] 
pub struct ResolveMarket<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub authority: Signer<'info>,
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
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(market_id: String)] 
pub struct PlaceBet<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
pub struct Market {
    // admin
    pub authority : Pubkey,
    pub bump : u8,
    pub fee_bps : u16,

    // market info
    pub market_id : String,
    pub question: String,

    // status
    pub is_resolved: bool,
    pub outcome: Option<Outcome>,

    // totals
    pub yes_wagered : u64,
    pub no_wagered : u64,

    pub market_dump: u8,
    pub escrow_bump: u8,
}

impl Market {
    const LEN: usize = 8 
        + 32 // authority
        + 1 // bump
        + 2 // fee_bps
        + 4 + 32 // market_id string (4-byte + max 32 bytes)
        + 4 + 32 // question string (4-byte + max 32 bytes)
        + 1 // is_resolved
        + 1 // outcome
        + 8 // yes_wagered
        + 8 // no_wagered
        + 1 // market_dump
        + 1; // escrow_bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Yes,
    No,
    Invalid
}

