use anchor_lang::prelude::*;

declare_id!("9GENDEWDVn6iUHuEbHZDUbWojXMX4J9gri7BUmvuzES9");

#[program]
pub mod lendingandborrowing {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
