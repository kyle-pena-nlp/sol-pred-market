use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

declare_id!("8WAGVU5JeuxzMzC3BgV2EvT1i2UPP2QSi4ABQegfck7Z");

#[program]
pub mod sol_pred_market {
    use anchor_spl::token::{self, Transfer};

    use super::*;

    
    pub fn create_market(ctx : Context<CreateMarket>, 
        market_id: String,
        fee_bps: u16,
        question: String) -> Result<()> {
        
        let market = &mut ctx.accounts.market;
        let bumps = ctx.bumps;

        market.authority = ctx.accounts.authority.key();
        market.bump = bumps.market;
        market.escrow_bump = bumps.escrow_authority;

        market.fee_bps = fee_bps;
        market.market_id = market_id;
        market.question = question;

        market.is_resolved = false;
        market.outcome = None;
        market.yes_wagered = 0;
        market.no_wagered = 0;
        
        
        Ok(())
    }

    pub fn abort_market(ctx: Context<AbortMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        if ctx.accounts.authority.key() != market.authority {
            return Err(ErrorCode::Unauthorized.into());
        }

        market.is_resolved = true;
        market.outcome = Some(Outcome::Aborted);

        Ok(())
    }

    pub fn resolve_market(ctx : Context<ResolveMarket>, resolution : MarketResolution) -> Result<()> {
        let market = &mut ctx.accounts.market;

        if ctx.accounts.authority.key() != market.authority {
            return Err(ErrorCode::Unauthorized.into());
        }

        market.is_resolved = true;
        market.outcome = Some(resolution.to_outcome());

        Ok(())
    }

    pub fn place_bet(ctx : Context<PlaceBet>, amount : u64, wagered_outcome: MarketResolution) -> Result<()> {
        let market = &mut ctx.accounts.market;
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bettor_token_account.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;
        
        match wagered_outcome {
            MarketResolution::Yes => market.yes_wagered += amount,
            MarketResolution::No => market.no_wagered += amount,
        }
        Ok(())
    }

    // user claims back their funds if the market is aborted
    pub fn withdraw_after_abort(ctx : Context<WithdrawAfterAbort>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;

        if market.outcome != Some(Outcome::Aborted) {
            return Err(ErrorCode::MarketIsNotAborted.into());
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.bettor_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            market.yes_wagered,
        )?;
        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        
    }
}

#[derive(Accounts)] 
#[instruction(market_id: String)] // might better read as: instruction parameter declaration
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Market::LEN,
        seeds = [ b"market", market_id.as_bytes() ],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub authority: Signer<'info>,    

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

    #[account(
        init,
        seeds = [b"bet", market_id.as_bytes(), authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + Bet::LEN
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub escrow : Account<'info, TokenAccount>,

    #[account(mut)]
    pub bettor_token_account : Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub token_program : Program<'info, Token>
}

#[account]
pub struct Bet {
    amount : u64,
    wagered_outcome : MarketResolution,
    bump : u8,
}

impl Bet {
    const LEN : usize = 8 + 8 + 1 + 1;
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
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"bet", market_id.as_bytes(), authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + Bet::LEN
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub escrow : Account<'info, TokenAccount>,

    #[account(mut)]
    pub bettor_token_account : Account<'info, TokenAccount>,

    pub system_program : Program<'info, System>,

    pub token_program : Program<'info, Token>
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
    pub authority: Signer<'info>,

    #[account(mut, constraint = token.owner == authority.key())]
    pub token : Account<'info, TokenAccount>,

    #[account(mut, has_one = mint)]
    pub escrow : Account<'info, TokenAccount>,

    pub mint : Account<'info, Mint>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,
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
    Aborted
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketResolution {
    Yes,
    No,
}

impl MarketResolution {
    fn to_outcome(&self) -> Outcome {
        match self {
            MarketResolution::Yes => Outcome::Yes,
            MarketResolution::No => Outcome::No,
        }
    }
}