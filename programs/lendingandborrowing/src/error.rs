use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Insufficient funds for the operation.")]
  InsufficientFunds,
  #[msg("Requested amount exceeds the maximum borrowable amount.")]
  OverBorrowableAmount,
  #[msg("Repay amount exceeds the borrowed amount.")]
  RepayAmountExceedsBorrowed,
}