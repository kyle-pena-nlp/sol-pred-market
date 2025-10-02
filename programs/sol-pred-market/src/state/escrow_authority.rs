use anchor_lang::prelude::*;

#[account]
pub struct EscrowAuthority {
    bump : u8
}

impl EscrowAuthority {
    pub const LEN : usize = 8;
}