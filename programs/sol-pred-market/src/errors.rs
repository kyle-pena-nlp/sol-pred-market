use anchor_lang::prelude::*;

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
