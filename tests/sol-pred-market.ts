import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

import { SolPredMarket } from "../target/types/sol_pred_market";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { NATIVE_MINT, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  createSyncNativeInstruction, 
  createAssociatedTokenAccountIdempotentInstruction
} from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { CreateMarketArgs, CreateMarketResult } from "./types";
import { assert, expect } from "chai";
import { SystemProgram } from "@solana/web3.js";

// pull the enum type from the IDL
type MarketAccount = anchor.IdlTypes<SolPredMarket>['market'];
type MarketResolution = anchor.IdlTypes<SolPredMarket>['marketResolution'];
type BetEscrowFundsStatus = anchor.IdlTypes<SolPredMarket>['betEscrowFundsStatus'];
type Bet = anchor.IdlTypes<SolPredMarket>['bet'];
type EscrowAuthority = anchor.IdlTypes<SolPredMarket>['escrowAuthority'];

// make values
const YES: MarketResolution = { yes: {} };
const NO:  MarketResolution = { no: {} };

const FUNDED : BetEscrowFundsStatus = { funded: {} };
const WITHDRAWN : BetEscrowFundsStatus = { withdrawn: {} };

// Much easier to do this then fight with chai-as-promised in this environment.
async function doesThrow<T>(fn : Promise<T>) {
  try {
    await fn;
    return false;
  } catch (e) {
    return true;
  }
}

async function createMarket(args: CreateMarketArgs) : Promise<CreateMarketResult> {

  const [marketPda, marketBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(args.marketId)], 
    args.program.programId);
  
  const [escrowAuthorityPDA, escrowAuthorityBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_authority"), marketPda.toBuffer()], 
    args.program.programId);
  
  const [escrowPda, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), marketPda.toBuffer()],
    args.program.programId);

  const tx = await args.program.methods.createMarket(args.marketId, args.feeBps, args.question).accounts({
    signer: args.wallet.publicKey,
    mint: NATIVE_MINT
  }).rpc();

  const bumps = {
    marketBump,
    escrowBump,
    escrowAuthorityBump
  }

  const marketAccount : MarketAccount = await args.program.account.market.fetch(marketPda);

  return {
    tx,
    marketAccount,
    bumps,
    marketPda,
    escrowAuthorityPDA,
    escrowPda
  };
}

// airdrop 1 SOl, put half in wrapped SOL
async function fundSOL(wallet : anchor.Wallet) {
  const connection = anchor.AnchorProvider.env().connection;
  const sig = await connection.requestAirdrop(
    wallet.publicKey,
    1 * anchor.web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(sig, "confirmed");

  // 2) Get/create owner's WSOL ATA (native mint)
  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    wallet.publicKey,
    true, // allow owner to be a PDA if needed
    TOKEN_PROGRAM_ID
  );

  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    wallet.publicKey, // payer for rent
    wsolAta,
    wallet.publicKey,
    NATIVE_MINT,
    TOKEN_PROGRAM_ID
  );

  // 3) Transfer lamports into the WSOL ATA (this “wraps” SOL)
  const transferIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: wsolAta,
    lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
  });

  // 4) Sync native so token amount == lamports
  const syncIx = createSyncNativeInstruction(wsolAta);

  const tx = new anchor.web3.Transaction().add(createAtaIx, transferIx, syncIx);
  await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet.payer], {
    commitment: "confirmed",
  });
}

describe("sol-pred-market", () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const wallet = anchor.AnchorProvider.env().wallet as anchor.Wallet;
  const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;
  const question = "Will BTC > $100k by 2027?";
  const feeBps = 200; // 2%

  before(async function () {
    // Airdrop some SOL to the wallet.
    await fundSOL(wallet);
  });


  it("Creates a market", async () => {
    const marketId = "mkt:created-market";
    
    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    console.log("Market account:", result.marketAccount);
    assert.ok(result.marketAccount.authority.equals(wallet.publicKey));
    assert.equal(result.marketAccount.bump, result.bumps.marketBump);
    assert.equal(result.marketAccount.escrowBump, result.bumps.escrowBump);
    assert.equal(result.marketAccount.escrowAuthorityBump, result.bumps.escrowAuthorityBump);
    assert.equal(result.marketAccount.feeBps, feeBps);
    assert.equal(result.marketAccount.marketId, marketId);
    assert.equal(result.marketAccount.question, question);
    assert.equal(result.marketAccount.isClosed, false);
    assert.equal(result.marketAccount.outcome, null);
    assert.ok(result.marketAccount.yesWagered.eq(new BN(0)));
    assert.ok(result.marketAccount.noWagered.eq(new BN(0)));

  });

  it("cannot create a market with same market_id if already created", async () => {
    const marketId = "mkt:created-market-dupped";
    
    // create market once
    await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    // create market again
    expect(await doesThrow(createMarket({
        marketId,
        question : question + "-dedup",
        feeBps : feeBps + 1,
        program,
        wallet
    }))).to.be.true;

  });

  // aborting a market

  it("can abort a market", async () => {
    const marketId = "mkt:aborted-market";

    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();

    const marketAccount = await program.account.market.fetch(result.marketPda);
    assert.equal(marketAccount.isClosed, true);
    assert.ok("aborted" in marketAccount.outcome);
  });

  it("cannot abort a market that is already aborted", async () => {
    const marketId = "mkt:abort-twice";

    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();

    expect(await doesThrow(program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc())).to.be.true;
  });

  it("cannot abort a market that is already resolved", async () => {
    const marketId = "mkt:abort-resolved";

    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();
    
    expect(await doesThrow(program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc())).to.be.true;
    

  });

  it("cannot abort a non-existent market", async () => {
    const marketId = "mkt:abort-DNE";

    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    
    expect(await doesThrow(program.methods.abortMarket("wrong-market-id").accounts({
      signer: wallet.publicKey,
    }).rpc())).to.be.true;
  });

  // placing a bet

  it("can place a bet", async () => {
    const marketId = "mkt:bet";

    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    const ata = getAssociatedTokenAddressSync(
      NATIVE_MINT,    
      wallet.publicKey,
      false,                
      TOKEN_PROGRAM_ID,          
      ASSOCIATED_TOKEN_PROGRAM_ID
    
    );

    const betLamports = 10;

    await (program.methods.placeBet(marketId, new anchor.BN(betLamports), YES).accounts({
      signer: wallet.publicKey,
      mint: NATIVE_MINT,
      bettorTokenAccount : ata
    }).rpc());

    

    
    // test that the bet PDA exists and has proper status
    const [betPda, betBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), result.marketPda.toBuffer(), wallet.publicKey.toBuffer()],
      program.programId);
    const betAccount = await program.account.bet.fetch(betPda);
    assert.deepStrictEqual(betAccount.authority.toBytes(), wallet.publicKey.toBytes());
    assert.equal(betAccount.bump, betBump);
    assert.equal(betAccount.amount.eq(new anchor.BN(betLamports)), true);
    assert.deepStrictEqual(betAccount.wageredOutcome, YES);
    assert.deepStrictEqual(betAccount.escrowFundsStatus, FUNDED);
    
    const escrowAta = getAssociatedTokenAddressSync(
      NATIVE_MINT,    
      result.escrowPda,
      false,                
      TOKEN_PROGRAM_ID,          
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const bal = await program.provider.connection.getTokenAccountBalance(escrowAta, 'confirmed');
    const balValue : anchor.web3.TokenAmount = bal.value;
    assert.equal(parseInt(balValue.amount, 10), 10);
    
    assert.deepStrictEqual(betAccount.escrowFundsStatus, FUNDED);
    
  });

  it("can place another bet as a different user", async () => {

  });

  it("cannot place a second bet as same user", async () => {

  });

  it("cannot place bet after market is aborted", async () => {

  });


  it("cannot place a bet after market is resolved", async () => {

  });

  it("cannot abort market if market already resolved", async () => {

  });

  // resolve a market

  it("can resolve a market", async () => {

  });

  it("cannot resolve market if market if aborted", async () => {

  });

  it("cannot resolve market if market is already resolved", async () => {

  });

  // claim a reward

  it("can claim reward if bet was correct and market is resolved", async () => {

  });

  it("cannot claim reward twice", async () => {

  });

  it("cannot claim reward if bet was incorrect and market is resolved", async () => {

  });

  it("cannot claim reward if market was aborted", async () => {

  });

  it("users do not claim more rewards than exists in pot", async () => {

  });

  it("pot is empty after users claim rewards", async () => {

  });

  // withdraw after abort

  it("can withdraw bet and fee after abort", () => {

  });

  it("cannot withdraw bet and fee if market is not aborted", () => {

  });
});
