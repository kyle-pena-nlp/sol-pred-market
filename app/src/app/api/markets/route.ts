import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { getProgram, PROGRAM_ID } from '@/lib/anchor/program';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sync = searchParams.get('sync') === 'true';

    if (sync) {
      // Sync markets from blockchain to database
      await syncMarketsFromChain();
    }

    // Fetch markets from database
    const markets = await prisma.market.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        bets: {
          select: {
            bettor: true,
            amount: true,
            wageredOutcome: true,
          },
        },
      },
    });

    return NextResponse.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}

async function syncMarketsFromChain() {
  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    );

    // Fetch all market accounts from the program
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        {
          dataSize: 136, // Market account size
        },
      ],
    });

    const program = getProgram(
      new AnchorProvider(connection, {} as any, {})
    );

    for (const { pubkey, account } of accounts) {
      try {
        const marketData = await program.account.market.fetch(pubkey);

        // Upsert market in database
        await prisma.market.upsert({
          where: { marketPubkey: pubkey.toString() },
          update: {
            isClosed: marketData.isClosed,
            outcome: marketData.outcome
              ? Object.keys(marketData.outcome)[0]
              : null,
            yesWagered: marketData.yesWagered.toString(),
            noWagered: marketData.noWagered.toString(),
            updatedAt: new Date(),
          },
          create: {
            marketId: marketData.marketId,
            question: marketData.question,
            authority: marketData.authority.toString(),
            feeBps: marketData.feeBps,
            isClosed: marketData.isClosed,
            outcome: marketData.outcome
              ? Object.keys(marketData.outcome)[0]
              : null,
            yesWagered: marketData.yesWagered.toString(),
            noWagered: marketData.noWagered.toString(),
            marketPubkey: pubkey.toString(),
          },
        });
      } catch (err) {
        console.error(`Failed to sync market ${pubkey.toString()}:`, err);
      }
    }
  } catch (error) {
    console.error('Error syncing markets from chain:', error);
    throw error;
  }
}
