import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";

describe("sol-pred-market", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;

  const marketId = "mkt:demo";
  const question = "Will BTC > $100k by 2027?";
  const feeBps = 200; // 2%

  it("Creates a market", async () => {
    const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("market"), Buffer.from(marketId)], program.programId);
    const [escrowAuth] = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("escrow_authority")], program.programId);
    const tx = await program.methods.createMarket(marketId, feeBps, question).accounts({ market: marketPda, escrowAuthority: escrowAuth }).rpc();
    console.log("Your transaction signature", tx);
  });
});
