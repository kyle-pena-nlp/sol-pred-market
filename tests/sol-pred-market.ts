import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";
import { BN } from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { fetchBetAccount, getAllTokenBalances as printAllTokenBalances, getEscrowATA, placeBet, claimReward, fetchEscrowATAAccountAmount, fetchWalletATAAccountAmount, getWalletATA } from "./utils";
import { createMarket, doesThrow, fundSOL } from "./utils";
import { YES, NO, FUNDED, WITHDRAWN, NATIVE_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "./consts";

describe("sol-pred-market", () => {

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  provider.opts.commitment = 'confirmed';
  anchor.setProvider(provider);

  const wallet = anchor.AnchorProvider.env().wallet as anchor.Wallet;
  const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;
  
  const wallet2 = new anchor.Wallet(anchor.web3.Keypair.generate());
  const provider2 = new anchor.AnchorProvider(provider.connection, wallet2, { commitment: 'confirmed' });
  const program2 = new anchor.Program(
    program.idl,
    provider2
  ) as Program<SolPredMarket>;

  const wallet3 = new anchor.Wallet(anchor.web3.Keypair.generate());
  const provider3 = new anchor.AnchorProvider(provider.connection, wallet3, { commitment: 'confirmed' });
  const program3 = new anchor.Program(
    program.idl,
    provider3
  ) as Program<SolPredMarket>;
  
  const question = "Will BTC > $100k by 2027?";
  const feeBps = 200; // 2%

  before(async function () {
    // Airdrop some SOL to the wallet.
    await fundSOL(wallet);
    await fundSOL(wallet2);
    await fundSOL(wallet3);
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
    const { escrowAta } = await placeBet(program, marketId, wallet, betLamports, YES);

    // confirm the funds of the bet are in the escrow account
    const escrowAtaBalance = await fetchEscrowATAAccountAmount(marketInfo.marketPda);
    assert.equal(parseInt(escrowAtaBalance.amount, 10), betLamports);
    
    // test that the bet PDA exists and has proper status
    const { betAccount, betBump } = await fetchBetAccount(marketInfo.marketPda, wallet);
    assert.deepStrictEqual(betAccount.authority.toBytes(), wallet.publicKey.toBytes());
    assert.equal(betAccount.bump, betBump);
    assert.equal(betAccount.amount.eq(new anchor.BN(betLamports)), true);
    assert.deepStrictEqual(betAccount.wageredOutcome, YES);
    assert.deepStrictEqual(betAccount.escrowFundsStatus, FUNDED);
  });

  it("can place another bet as a different user", async () => {
    const marketId = "mkt:2-user";

    // create a market
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    const betLamports = 10;

    // both users place bets
    const { escrowAta: escrowAta1 } = await placeBet(program, marketId, wallet, betLamports, YES);
    const { escrowAta: escrowAta2 } = await placeBet(program2, marketId, wallet2, betLamports, NO);
    assert.deepStrictEqual(escrowAta1, escrowAta2);

    // double check first user's wallet 
    const { betAccount: betAccount1, betBump: betBump1 } = await fetchBetAccount(marketInfo.marketPda, wallet);
    assert.deepStrictEqual(betAccount1.authority.toBytes(), wallet.publicKey.toBytes());
    assert.deepStrictEqual(betAccount1.wageredOutcome, YES);

    const { betAccount: betAccount2, betBump: betBump2 } = await fetchBetAccount(marketInfo.marketPda, wallet2);
    assert.deepStrictEqual(betAccount1.authority.toBytes(), wallet.publicKey.toBytes());
    assert.deepStrictEqual(betAccount2.wageredOutcome, NO);

    const escrowAtaBalance = await program.provider.connection.getTokenAccountBalance(escrowAta1, 'confirmed');
    const escrowAtaValue : anchor.web3.TokenAmount = escrowAtaBalance.value;
    assert.equal(parseInt(escrowAtaValue.amount, 10), betLamports * 2);
  });

  it("cannot place a second bet as same user", async () => {
    const marketId = "mkt:user-dup-bet";
    
    // create a market
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    const betLamports = 10;
    await placeBet(program, marketId, wallet, betLamports, YES);
    expect(await doesThrow(placeBet(program, marketId, wallet, betLamports, YES))).to.be.true;
  });

  it("cannot place bet after market is aborted", async () => {
    const marketId = "mkt:no-bet-abrt-mkt";

    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();

    const betLamports = 10;
    expect(await doesThrow(placeBet(program, marketId, wallet, betLamports, YES))).to.be.true;
  });


  it("cannot place a bet after market is resolved", async () => {
    const marketId = "mkt:no-bet-rslvd-mkt";

    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();

    const betLamports = 10;
    expect(await doesThrow(placeBet(program, marketId, wallet, betLamports, YES))).to.be.true;
  });

  it("cannot abort market if market already resolved", async () => {
    const marketId = "mkt:no-abrt-rslvd-mkt";
    const marketInfo = await createMarket({
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

  // resolve a market

  it("can resolve a market as creator", async () => {
    const marketId = "mkt:resolve-as-creator";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();
    const marketAccount = await program.account.market.fetch(marketInfo.marketPda);
    assert.equal(marketAccount.isClosed, true);
    assert.ok("yes" in marketAccount.outcome);
  });

  it("cannot resolve a market if you are not the creator", async () => {
    const marketId = "mkt-no-rslv-if-not-creator";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    expect(await doesThrow(program2.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet2.publicKey,
    }).rpc(), "Unauthorized")).to.be.true;
  });

  it("cannot resolve market if market if aborted", async () => {
    const marketId = "mkt-no-rslv-if-abrtd";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();
    expect(await doesThrow(program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc())).to.be.true;
  });

  it("cannot resolve market if market is already resolved", async () => {
    const marketId = "mkt-no-dup-rslvd";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();
    expect(await doesThrow(program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc())).to.be.true;
  });

  // claim a reward

  it("can claim reward if bet was correct and market is resolved", async () => {
    const marketId = "mkt-claim-reward-correct";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    const betAmount = 10;
    await placeBet(program, marketId, wallet, betAmount, YES);
    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();

    let { betAccount: preClaimBetAccount } = await fetchBetAccount(marketInfo.marketPda, wallet);
    assert.deepStrictEqual(preClaimBetAccount.escrowFundsStatus, FUNDED);
    const preClaimEscrowAmount = await fetchEscrowATAAccountAmount(marketInfo.marketPda);
    assert.deepStrictEqual(Number(preClaimEscrowAmount.amount), betAmount);
    
    await claimReward(program, marketId, wallet);
    let { betAccount: postClaimBetAccount } = await fetchBetAccount(marketInfo.marketPda, wallet);
    assert.deepStrictEqual(postClaimBetAccount.escrowFundsStatus, WITHDRAWN);
    const postClaimEscrowAmount = await fetchEscrowATAAccountAmount(marketInfo.marketPda);
    assert.deepStrictEqual(Number(postClaimEscrowAmount.amount), 0);
  });

  it("cannot claim reward twice", async () => {
    const marketId = "mkt-no-claim-twice";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    const betAmount = 10;
    await placeBet(program, marketId, wallet, betAmount, YES);
    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();
    await claimReward(program, marketId, wallet);
    expect(await doesThrow(program.methods.claimReward(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc()), "BetIsNotFunded").to.be.true;
  });

  it("cannot claim reward on resolved market if bet was incorrect", async () => {
    const marketId = "mkt-no-claim-wrong-bet";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    const betAmount = 10;
    await placeBet(program, marketId, wallet, betAmount, YES);
    await program.methods.resolveMarket(marketId, NO).accounts({
      signer: wallet.publicKey,
    }).rpc();
    expect(await doesThrow(program.methods.claimReward(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc()), "WagerAndOutcomeDoNotMatch").to.be.true;
  });

  it("cannot claim reward if market was aborted", async () => {
    const marketId = "mkt-no-claim-abrtd";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();
    expect(await doesThrow(program.methods.claimReward(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc()), "MarketIsAborted").to.be.true;
  });

  it("cannot claim reward if market is not resolved", async () => {
    const marketId = "mkt-not-resolved";
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });
    const betAmount = 10;
    await placeBet(program, marketId, wallet, betAmount, YES);
    expect(await doesThrow(program.methods.claimReward(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc()), "MarketIsNotResolved").to.be.true;
  });

  it("two winners totally claim funds of loser", async () => {
    const marketId = "mkt-winners-take-all";

    // create a market
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    // for testing purposes, measure initial balance of all three wallets (used to calculate rewards later)
    const wallet1InitialATAAmount = await fetchWalletATAAccountAmount(wallet.publicKey);
    const wallet2InitialATAAmount = await fetchWalletATAAccountAmount(wallet2.publicKey);
    const wallet3InitialATAAmount = await fetchWalletATAAccountAmount(wallet3.publicKey);

    // place bets
    const betAmount1 = 10; // entitled to original bet + 25% of rewards (10 / (10 + 30))
    const betAmount2 = 30; // entitled to original bet + 75% of rewards (30 / (10 + 30))
    const betAmount3 = 20; // losing bet.  forfeited according to above proportions.
    await placeBet(program, marketId, wallet, betAmount1, YES);
    await placeBet(program2, marketId, wallet2, betAmount2, YES);
    await placeBet(program3, marketId, wallet3, betAmount3, NO);

    // resolve outcome to YES, making the winners wallet1 and wallet2
    const escrowTotal = betAmount1 + betAmount2 + betAmount3;
    await program.methods.resolveMarket(marketId, YES).accounts({
      signer: wallet.publicKey,
    }).rpc();
    
    // measure how much is in escrow
    const preClaimsEscrowAmount = await fetchEscrowATAAccountAmount(marketInfo.marketPda);
    assert.equal(Number(preClaimsEscrowAmount.amount), escrowTotal);

    // user 1 claims reward.
    await claimReward(program, marketId, wallet);

    // after user 1 claims, validate amount left in escrow. 
    // user is returned their initial bet and claims amount proportional to loser's bets.
    // should be 60 - (10 init bet + 5 reward) = 45
    const postClaim1EscrowAmount = await fetchEscrowATAAccountAmount(marketInfo.marketPda);
    const wallet1Reward = betAmount3 * (betAmount1) / (betAmount1 + betAmount2);
    assert.equal(Number(postClaim1EscrowAmount.amount), escrowTotal - (betAmount1 + wallet1Reward));

    // check that wallet1 net balance increasd by the share of the losing bet's rewards
    const wallet1AtaBalance = await fetchWalletATAAccountAmount(wallet.publicKey);
    assert.equal(Number(wallet1AtaBalance.amount) - Number(wallet1InitialATAAmount.amount), wallet1Reward);

    // user 2 claims reward.
    await claimReward(program2, marketId, wallet2);

    // after user 2 claims, the amount left should be zero, since both winners have claimed all the loser's funds.
    const postClaim2EscrowAmount = await fetchEscrowATAAccountAmount(marketInfo.marketPda);
    assert.equal(Number(postClaim2EscrowAmount.amount), 0);

    // check to see if user 2 received their share of the loser's funds
    const wallet2AtaBalance = await fetchWalletATAAccountAmount(wallet2.publicKey);
    const wallet2Reward = betAmount3 * (betAmount2) / (betAmount1 + betAmount3);
    assert.equal(Number(wallet2AtaBalance.amount) - Number(wallet2InitialATAAmount.amount), wallet2Reward);
    
    // and wallet 3 balance should be unchanged
    const wallet3AtaBalance = await fetchWalletATAAccountAmount(wallet3.publicKey);
    assert.equal(Number(wallet3InitialATAAmount.amount) - Number(wallet3AtaBalance.amount), 0);
  });

  // withdraw after abort

  it("can withdraw bet and fee after abort", async () => {
    const marketId = "mkt-withdraw-after-abort";

    // create a market
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    const preBetATABalance = await fetchWalletATAAccountAmount(wallet.publicKey);

    await placeBet(program, marketId, wallet, 10, YES);

    // abort market
    await program.methods.abortMarket(marketId).accounts({
      signer: wallet.publicKey,
    }).rpc();

    await program.methods.withdrawAfterAbort(marketId).accounts({
      signer: wallet.publicKey,
      mint: NATIVE_MINT
    }).rpc();

    const postWithdrawATABalance = await fetchWalletATAAccountAmount(wallet.publicKey);

    assert.equal(Number(preBetATABalance.amount), Number(postWithdrawATABalance.amount));

  });

  it("cannot withdraw bet and fee if market is not aborted", async () => {
    const marketId = "mkt-withdraw-not-aborted";

    // create a market
    const marketInfo = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await placeBet(program, marketId, wallet, 10, YES);

    expect(await doesThrow(program.methods.withdrawAfterAbort(marketId).accounts({
      signer: wallet.publicKey,
      mint: NATIVE_MINT
    }).rpc()), "MarketIsNotAborted").to.be.true;
  });
});
