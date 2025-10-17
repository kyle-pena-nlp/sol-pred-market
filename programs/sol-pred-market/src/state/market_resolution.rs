use anchor_lang::prelude::*;
use crate::state::Outcome;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketResolution {
    Yes,
    No,
}

impl MarketResolution {
    pub fn to_outcome(&self) -> Outcome {
        match self {
            MarketResolution::Yes => Outcome::Yes,
            MarketResolution::No => Outcome::No,
        }
    }
}