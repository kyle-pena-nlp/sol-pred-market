import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { assert } from "chai";
import { BN } from "@coral-xyz/anchor";

describe("sol-pred-market", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const wallet = anchor.AnchorProvider.env().wallet as anchor.Wallet;

  const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;

  const marketId = "mkt:demo";
  const question = "Will BTC > $100k by 2027?";
  const feeBps = 200; // 2%

  it("Creates a market", async () => {
    
    const [marketPda, marketBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(marketId)], 
      program.programId);

    
    const [escrowAuthorityPDA, escrowAuthorityBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_authority"), marketPda.toBuffer()], 
      program.programId);
    
    const [escrowPda, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), marketPda.toBuffer()],
      program.programId);

    const NATIVE_MINT = new anchor.web3.PublicKey(
      "So11111111111111111111111111111111111111112",
    );

    const tx = await program.methods.createMarket(marketId, feeBps, question).accounts({
      market: marketPda,
      signer: wallet.publicKey,
      escrowAuthority: escrowAuthorityPDA,
      escrow: escrowPda,
      mint: NATIVE_MINT,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();
    console.log("Your transaction signature", tx);


    const marketAccount = await program.account.market.fetch(marketPda);
    console.log("Market account:", marketAccount);
    assert.ok(marketAccount.authority.equals(wallet.publicKey));
    assert.equal(marketAccount.bump, marketBump);
    assert.equal(marketAccount.escrowBump, escrowBump);
    assert.equal(marketAccount.escrowAuthorityBump, escrowAuthorityBump);
    assert.equal(marketAccount.feeBps, feeBps);
    assert.equal(marketAccount.marketId, marketId);
    assert.equal(marketAccount.question, question);
    assert.equal(marketAccount.isClosed, false);
    assert.equal(marketAccount.outcome, null);
    assert.ok(marketAccount.yesWagered.eq(new BN(0)));
    assert.ok(marketAccount.noWagered.eq(new BN(0)));

  });
});
