use anchor_lang::prelude::*;
use crate::state::Market;
use crate::state::Bet;
use crate::state::Outcome;
use crate::state::BetEscrowFundsStatus;
use crate::state::MarketResolution;
use crate::state::EscrowAuthority;
use crate::errors::ErrorCode;
use anchor_spl::token::{self, Transfer};
use anchor_spl::token::{Token, TokenAccount, Mint};

pub fn handler(ctx: Context<ClaimReward>) -> Result<()> {
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
    // that way, the loser's funds are distributed fairly amongst the winners.
    // to avoid underflow with integer math, we do the division last 
    let numerator =  (bet.amount as u64).checked_mul(pot_for_winners as u64).unwrap();
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
    pub escrow_authority : Account<'info,EscrowAuthority>,    

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
