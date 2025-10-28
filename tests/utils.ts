import * as anchor from "@coral-xyz/anchor";
import { NATIVE_MINT, 
  createSyncNativeInstruction, 
  createAssociatedTokenAccountIdempotentInstruction
} from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { CreateMarketArgs, CreateMarketResult, MarketAccount, MarketResolution } from "./types";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "./consts";
import { Program } from "@coral-xyz/anchor";
import { SolPredMarket } from "../target/types/sol_pred_market";


export async function getProgram() : Promise<Program<SolPredMarket>> {
    const program = anchor.workspace.SolPredMarket as Program<SolPredMarket>;
    return program;
}

// Much easier to do this then fight with chai-as-promised in this environment.
export async function doesThrow<T>(fn : Promise<T>, errorCode ?: string) {
  try {
    await fn;
    return false;
  } catch (e) {
    if (errorCode != null) {
      const name = e?.error?.errorCode?.code;
      return name === errorCode;
    }
    return true;
  }
}

export async function createMarket(args: CreateMarketArgs) : Promise<CreateMarketResult> {

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
export async function fundSOL(wallet : anchor.Wallet) {

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


export async function getAllTokenBalances(walletAddress: PublicKey, connection: Connection) {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    walletAddress,
    {
      programId: TOKEN_PROGRAM_ID, // or TOKEN_2022_PROGRAM_ID for Token Extensions
    }
  );

  console.log(`Found ${tokenAccounts.value.length} token accounts:`);
  
  tokenAccounts.value.forEach((accountInfo) => {
    const parsedInfo = accountInfo.account.data.parsed.info;
    const mintAddress = parsedInfo.mint;
    const balance = parsedInfo.tokenAmount.uiAmount;
    const decimals = parsedInfo.tokenAmount.decimals;
    
    console.log(`Mint: ${mintAddress}`);
    console.log(`Balance: ${balance}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`ATA Address: ${accountInfo.pubkey.toString()}`);
    console.log('---');
  });
  
  return tokenAccounts.value;
}

export async function getEscrowATA(marketPda : anchor.web3.PublicKey) {
    const program = await getProgram();
    const [escrowAta, escrowAtaBump] = PublicKey.findProgramAddressSync([Buffer.from("escrow"), marketPda.toBuffer()], program.programId);
    return {
        escrowAta,
        escrowAtaBump
    }
}

export async function getWalletATA(wallet : anchor.web3.PublicKey) {
  const program = await getProgram();
  const [walletAta, walletAtaBump] = PublicKey.findProgramAddressSync([Buffer.from("bettor_token_account"), wallet.toBuffer()], program.programId);
  return {
    walletAta,
    walletAtaBump
  }
}

export async function fetchEscrowATAAccountAmount(marketPda: anchor.web3.PublicKey) : Promise<anchor.web3.TokenAmount> {
  const { escrowAta } = await getEscrowATA(marketPda);
  const program = await getProgram();
  const escrowAccount = (await program.provider.connection.getTokenAccountBalance(escrowAta, 'confirmed')).value;
  return escrowAccount;
}

export async function fetchWalletATAAccountAmount(wallet : anchor.web3.PublicKey) : Promise<anchor.web3.TokenAmount> {
  const { walletAta } = await getWalletATA(wallet);
  const program = await getProgram();
  const amount = (await program.provider.connection.getTokenAccountBalance(walletAta, 'confirmed')).value;
  return amount;
}

export async function placeBet(program : Program<SolPredMarket>, marketId : string, wallet : anchor.Wallet, amount : number, outcome : MarketResolution) {

  console.log(`Wagering ${amount} for ${anchorEnumToString(outcome)} on market ${marketId} by ${wallet.publicKey.toString()}`);
  
  const walletAta = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  
  console.log(`Wallet ATA that will be withdrawn from: ${walletAta.toString()}`);

  // Derive the market PDA to get the escrow account
  const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(marketId)], 
    program.programId
  );

  console.log(`Market account that bet will be placed on: ${marketPda.toString()}`);
  
  // Derive the escrow account that will be used by the instruction
  const { escrowAta } = await getEscrowATA(marketPda);
  
  console.log("Escrow account that instruction will use:", escrowAta.toString());
  
  await (program.methods.placeBet(marketId, new anchor.BN(amount), outcome).accounts({
    signer: wallet.publicKey,
    mint: NATIVE_MINT,
    bettorTokenAccount : walletAta
  }).rpc());
  
  return { escrowAta };
}

export async function claimReward(program : Program<SolPredMarket>, marketId: string, wallet: anchor.Wallet) {
  const walletAta = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  await program.methods.claimReward(marketId).accounts({
    signer: wallet.publicKey,
    mint: NATIVE_MINT,
    bettorTokenAccount: walletAta
  }).rpc();
}

export async function fetchBetAccount(marketPda : PublicKey, wallet : anchor.Wallet) {
  const program = await getProgram();
  const [betPda, betBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId);
  const betAccount = await program.account.bet.fetch(betPda);
  return { betAccount, betBump };
}

export function anchorEnumToString(x : Record<string,unknown>) {
    return Object.keys(x)[0];
}