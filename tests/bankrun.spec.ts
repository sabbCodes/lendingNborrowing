import { describe, it } from "node:test";
import IDL from "../target/idl/lendingandborrowing.json"
import { Lendingandborrowing } from "../target/types/lendingandborrowing";
import { BanksClient, ProgramTestContext, startAnchor } from "solana-bankrun";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { BankrunContextWrapper } from "../bankrun-utils/bankrunConnection";
import { BN, Program } from "@coral-xyz/anchor";
import { createMint, mintTo, createAccount } from "spl-token-bankrun";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Lending and Borrowing program", async () => {
  let context: ProgramTestContext;
  let provider: BankrunProvider;
  let bankrunContextWrapper: BankrunContextWrapper;
  let program: Program<Lendingandborrowing>;
  let banksClient: BanksClient;
  let signer: Keypair;
  let usdcBankAccount: PublicKey;
  let solBankAccount: PublicKey;
  let userAccount: PublicKey;

  const pyth = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");

  const devnetConnection = new Connection("https://api.devnet.solana.com");
  const accountInfo = await devnetConnection.getAccountInfo(pyth);

  context = await startAnchor(
    '',
    [{ name: 'lendingandborrowing', programId: new PublicKey(IDL.address)  }],
    [{address: pyth,  info: accountInfo}]
  );

  provider = new BankrunProvider(context);

  const SOL_PRICE_FEED_ID =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

  bankrunContextWrapper = new BankrunContextWrapper(context);

  const connection = bankrunContextWrapper.connection.toConnection();

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: provider.wallet,
  });

  const solUsdPriceFeedAccount = pythSolanaReceiver.getPriceFeedAccountAddress(0, SOL_PRICE_FEED_ID);

  const feedAccountInfo = await devnetConnection.getAccountInfo(solUsdPriceFeedAccount);

  context.setAccount(solUsdPriceFeedAccount, feedAccountInfo);

  program = new Program<Lendingandborrowing>(IDL as Lendingandborrowing, provider);

  banksClient = context.banksClient;
  signer = provider.wallet.payer;

  const mintUSDC = await createMint(
    banksClient,
    signer,
    signer.publicKey,
    null,
    2
  );

  const mintSOL = await createMint(
    banksClient,
    signer,
    signer.publicKey,
    null,
    9
  );

  [usdcBankAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), mintUSDC.toBuffer()],
    program.programId
  );

  [solBankAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), mintSOL.toBuffer()],
    program.programId
  );

  it("Initialize and fund Bank", async () => {
    const initUSDCBankTx = await program.methods
      .initBank(new BN(1), new BN(1))
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Initialized USDC Bank Account: ", initUSDCBankTx);

    const amount = 10_000 * 10 ** 9;

    const mintTx = await mintTo(
      banksClient,
      signer,
      mintUSDC,
      usdcBankAccount,
      amount
    );

    console.log("Minted USDC to Bank Account: ", mintTx);
  });

  it("Initialize User Account", async () => {
    const initUserTx = await program.methods
      .initUser(mintUSDC)
      .accounts({
        signer: signer.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Initialized User Account: ", initUserTx);
  });

  it("Initialize and fund SOL Bank", async () => {
    const initSOLBankTx = await program.methods
      .initBank(new BN(1), new BN(1))
      .accounts({
        signer: signer.publicKey,
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Initialized SOL Bank Account: ", initSOLBankTx);

    const amount = 10_000 * 10 ** 9;

    const mintTx = await mintTo(
      banksClient,
      signer,
      mintSOL,
      solBankAccount,
      amount
    );

    console.log("Minted SOL to Bank Account: ", mintTx);
  });

  it("Create and fund token accounts", async () => {
    const USDCTokenAccount = await createAccount(
      banksClient,
      mintUSDC,
      signer.publicKey,
      signer
    );

    console.log("Created USDC Token Account: ", USDCTokenAccount.toBase58());

    const amount = 1_000 * 10 ** 9;

    const mintTx = await mintTo(
      banksClient,
      signer,
      mintUSDC,
      USDCTokenAccount,
      amount
    );

    console.log("Minted USDC to User Account: ", mintTx);
  });

  it("Deposit Collateral", async () => {
    const depositTx = await program.methods
      .deposit(new BN(1000000000000000))
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Deposited Collateral: ", depositTx);
  });

  it("Borrow against Collateral", async () => {
    const borrowTx = await program.methods
      .borrow(new BN(2))
      .accounts({
        signer: signer.publicKey,
        mint: mintSOL,
        priceUpdate: solUsdPriceFeedAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Borrowed against Collateral: ", borrowTx);
  });

  it("Repay Loan", async () => {
    const repayTx = await program.methods
      .repay(new BN(2))
      .accounts({
        signer: signer.publicKey,
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Repaid Loan: ", repayTx);
  });

  it("Withdraw Collateral", async () => {
    const withdrawTx = await program.methods
      .withdraw(new BN(100))
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Withdrew Collateral: ", withdrawTx);
  });
});