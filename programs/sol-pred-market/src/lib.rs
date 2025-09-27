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

        market.authority = ctx.accounts.signer.key();
        market.bump = bumps.market;
        market.escrow_bump = bumps.escrow_authority;

        market.fee_bps = fee_bps;
        market.market_id = market_id;
        market.question = question;

        market.is_closed = false;
        market.outcome = None;
        market.yes_wagered = 0;
        market.no_wagered = 0;
        
        
        Ok(())
    }

    pub fn abort_market(ctx: Context<AbortMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        if ctx.accounts.signer.key() != market.authority {
            return Err(ErrorCode::Unauthorized.into());
        }

        market.is_closed = true;
        market.outcome = Some(Outcome::Aborted);

        Ok(())
    }

    pub fn resolve_market(ctx : Context<ResolveMarket>, resolution : MarketResolution) -> Result<()> {
        let market = &mut ctx.accounts.market;

        if ctx.accounts.signer.key() != market.authority {
            return Err(ErrorCode::Unauthorized.into());
        }

        market.is_closed = true;
        market.outcome = Some(resolution.to_outcome());

        Ok(())
    }

    pub fn place_bet(ctx : Context<PlaceBet>, amount : u64, wagered_outcome: MarketResolution) -> Result<()> {
        let market = &mut ctx.accounts.market;


        // cannot place a bet on a market that is closed due to being aborted, resolved, etc.
        if market.is_closed {
            return Err(ErrorCode::MarketIsClosed.into());
        }

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

    // user claims back their funds if the market is aborted
    pub fn withdraw_after_abort(ctx : Context<WithdrawAfterAbort>) -> Result<()> {
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

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let market = &mut ctx.accounts.market;

        // can't claim your reward if the market is not resolved to yes or no
        if market.outcome != Some(Outcome::Yes) && market.outcome != Some(Outcome::No) {
            return Err(ErrorCode::MarketIsNotResolved.into());
        }

        // can't claim your reward if the winnings are not funded in escrow (i.e.; has already been claimed)
        let bet = &mut ctx.accounts.bet;
        if bet.escrow_funds_status != BetEscrowFundsStatus::Funded {
            return Err(ErrorCode::BetIsNotFunded.into());
        }

        // can't claim your reward if your wagered outcome is different than the market outcome
        let wager_and_outcome = (bet.wagered_outcome, market.outcome.unwrap());
        if wager_and_outcome != (MarketResolution::Yes, Outcome::Yes) && wager_and_outcome != (MarketResolution::No, Outcome::No) {
            return Err(ErrorCode::WagerAndOutcomeDoNotMatch.into());
        }

        // calculation of reward
        
        // how much of the market did others wager in the same outcome?
        let winner_wagers: u64 = match wager_and_outcome {
            (MarketResolution::Yes, Outcome::Yes) => market.yes_wagered,
            (MarketResolution::No, Outcome::No) => market.no_wagered,
            _ => 0,
        };

        // how much of the market did others wager in the opposite outcome?
        let pot_for_winners: u64 = match wager_and_outcome {
            (MarketResolution::Yes, Outcome::No) => market.yes_wagered,
            (MarketResolution::No, Outcome::Yes) => market.no_wagered,
            _ => 0,
        };

        // calculate the reward: 
        // as a bettor, you are entitled to a fraction of the loser's pot
        // which is proportional to the amount of your bet compared to all winner's bets
        // (your bet / all winner bets) * [loser's bets]
        // to avoid underflow with integer math, we do the division last 
        let numerator =  (bet.amount as u64) * (pot_for_winners as u64);
        let denominator = winner_wagers as u64;
        let reward = numerator.checked_div(denominator).unwrap();

        // transfer the reward from escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.bettor_token_account.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                },
            ),
            reward,
        )?;

        bet.escrow_funds_status = BetEscrowFundsStatus::Withdrawn;

        Ok(())
    }
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
    pub is_closed: bool,
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
        + 1 // is_closed
        + 1 // outcome
        + 8 // yes_wagered
        + 8 // no_wagered
        + 1 // market_dump
        + 1; // escrow_bump
}

#[account]
pub struct Bet {
    authority: Pubkey,
    bump : u8,
    amount : u64,
    wagered_outcome : MarketResolution,
    escrow_funds_status : BetEscrowFundsStatus,
}

impl Bet {
    const LEN : usize = 32 // authority
        + 1 // bump
        + 8 // amount
        + 1 // wagered_outcome
        + 1; // escrow_funds_status
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BetEscrowFundsStatus {
    Funded,
    Withdrawn,
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
        seeds = [b"escrow_authority", market.key().as_ref()],
        bump
    )]
    pub escrow_authority : UncheckedAccount<'info>,

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


#[derive(Accounts)]
#[instruction(market_id: String)] 
pub struct ResolveMarket<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub signer: Signer<'info>,
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
    pub escrow_authority : UncheckedAccount<'info>,    

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
    pub escrow_authority : UncheckedAccount<'info>,    

    // PDA token account to hold escrow
    #[account(
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


#[derive(Accounts)]
#[instruction(market_id : String)]
pub struct ClaimReward<'info> {
    #[account(
        seeds = [b"market", market_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bet", market.key().as_ref(), signer.key().as_ref()],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    // the authority for the escrow - programatically derived as a PDA
    #[account(
        seeds = [b"escrow_authority", market.key().as_ref()],
        bump
    )]
    pub escrow_authority : UncheckedAccount<'info>,    

    // PDA token account to hold escrow
    #[account(
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Yes,
    No,
    Aborted
}


#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("The market is closed")]
    MarketIsClosed,
    #[msg("The market is not aborted")]
    MarketIsNotAborted,
    #[msg("The market is aborted")]
    MarketIsAborted,
    #[msg("Overflow while calculating payout")]
    MathOverflow, 
    #[msg("Bet is not funded")]
    BetIsNotFunded,
    #[msg("The market is not resolved")]
    MarketIsNotResolved,
    #[msg("Wagered outcome does not match market outcome")]
    WagerAndOutcomeDoNotMatch,
}