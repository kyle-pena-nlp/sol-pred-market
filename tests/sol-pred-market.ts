import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";
import { BN } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { fetchBetAccount, getAllTokenBalances as printAllTokenBalances, getEscrowATA, placeBet } from "./utils";
import { createMarket, doesThrow, fundSOL } from "./utils";
import { YES, NO, FUNDED, WITHDRAWN, NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "./consts";

describe("sol-pred-market", () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const wallet = anchor.AnchorProvider.env().wallet as anchor.Wallet;
  const wallet2 = new anchor.Wallet(anchor.web3.Keypair.generate());

  const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;
  const question = "Will BTC > $100k by 2027?";
  const feeBps = 200; // 2%

  before(async function () {
    // Airdrop some SOL to the wallet.
    await fundSOL(wallet);
    await fundSOL(wallet2);
  });

  it("Can create a market", async () => {
    const marketId = "mkt:created-market";
    
    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

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

  it("can abort a market", async () => {
    const marketId = "mkt:aborted-market";

    // create market
    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    // abort market
    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();

    const marketAccount = await program.account.market.fetch(result.marketPda);
    assert.equal(marketAccount.isClosed, true);
    assert.ok("aborted" in marketAccount.outcome);
  });

  it("cannot abort a market that is already aborted", async () => {
    const marketId = "mkt:abort-twice";

    // create market
    await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    // abort market once
    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();

    // abort market a second time, should throw
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

  it("can place a bet", async () => {

    const marketId = "mkt:bet";

    // create a market
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    const betLamports = 10;

    // place a bet
    const { escrowAta } = await placeBet(marketId, wallet, betLamports, YES);

    // confirm the funds of the bet are in the escrow account
    const escrowAtaBalance = await program.provider.connection.getTokenAccountBalance(escrowAta, 'confirmed');
    const escrowAtaValue : anchor.web3.TokenAmount = escrowAtaBalance.value;
    assert.equal(parseInt(escrowAtaValue.amount, 10), betLamports);
    
    // test that the bet PDA exists and has proper status
    /*const { betAccount, betBump } = await fetchBetAccount(marketInfo.marketPda, wallet);
    assert.deepStrictEqual(betAccount.authority.toBytes(), wallet.publicKey.toBytes());
    assert.equal(betAccount.bump, betBump);
    assert.equal(betAccount.amount.eq(new anchor.BN(betLamports)), true);
    assert.deepStrictEqual(betAccount.wageredOutcome, YES);
    assert.deepStrictEqual(betAccount.escrowFundsStatus, FUNDED);*/
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
