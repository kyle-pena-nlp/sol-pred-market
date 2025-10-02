import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { assert } from "chai";
import { BN } from "@coral-xyz/anchor";

type CreateMarketArgs = {
  wallet: anchor.Wallet,
  program: anchor.Program<SolPredMarket>,
  marketId: string,
  feeBps: number,
  question: string
};


const NATIVE_MINT = new anchor.web3.PublicKey(
  "So11111111111111111111111111111111111111112",
);

async function createMarket(args: CreateMarketArgs) {

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
    market: marketPda,
    signer: args.wallet.publicKey,
    escrowAuthority: escrowAuthorityPDA,
    escrow: escrowPda,
    mint: NATIVE_MINT,
    systemProgram: anchor.web3.SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  }).rpc();

  const bumps = {
    marketBump,
    escrowBump,
    escrowAuthorityBump
  }

  const marketAccount = await args.program.account.market.fetch(marketPda);

  return {
    tx,
    marketAccount,
    bumps,
    marketPda,
    escrowAuthorityPDA,
    escrowPda
  };
}

describe("sol-pred-market", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const wallet = anchor.AnchorProvider.env().wallet as anchor.Wallet;
  const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;
  const question = "Will BTC > $100k by 2027?";
  const feeBps = 200; // 2%

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

  it("aborts a market", async () => {
    const marketId = "mkt:aborted-market";


    const result = await createMarket({
      marketId,
      question,
      feeBps,
      program,
      wallet
    });

    await program.methods.abortMarket(marketId).accounts({
      market: result.marketPda,
      signer: wallet.publicKey,
    }).rpc();

    const marketAccount = await program.account.market.fetch(result.marketPda);
    assert.equal(marketAccount.isClosed, true);
    assert.ok("aborted" in marketAccount.outcome);
  });
});
