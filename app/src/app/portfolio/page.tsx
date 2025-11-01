'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Bet {
  id: string;
  marketId: string;
  amount: bigint;
  wageredOutcome: string;
  escrowStatus: string;
  createdAt: Date;
  market: {
    question: string;
    isClosed: boolean;
    outcome: string | null;
  };
}

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (publicKey) {
      fetchBets();
    } else {
      setLoading(false);
    }
  }, [publicKey]);

  const fetchBets = async () => {
    try {
      const response = await fetch(`/api/bets?wallet=${publicKey?.toString()}`);
      const data = await response.json();
      setBets(data.bets);
    } catch (error) {
      console.error('Error fetching bets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Connect Your Wallet</h1>
          <p className="text-gray-500 mt-2">
            Please connect your wallet to view your portfolio
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  const activeBets = bets.filter((bet) => !bet.market.isClosed);
  const resolvedBets = bets.filter((bet) => bet.market.isClosed);
  const totalWagered = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);

  const wonBets = resolvedBets.filter(
    (bet) => bet.market.outcome === bet.wageredOutcome
  );
  const lostBets = resolvedBets.filter(
    (bet) => bet.market.outcome && bet.market.outcome !== bet.wageredOutcome
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Portfolio</h1>
        <p className="mt-2 text-gray-600">
          Track your bets and performance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Total Bets</p>
          <p className="text-3xl font-bold text-gray-900">{bets.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Total Wagered</p>
          <p className="text-3xl font-bold text-gray-900">
            {(totalWagered / 1e9).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Won</p>
          <p className="text-3xl font-bold text-green-600">{wonBets.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-sm text-gray-600 mb-1">Lost</p>
          <p className="text-3xl font-bold text-red-600">{lostBets.length}</p>
        </div>
      </div>

      {/* Active Bets */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Active Bets</h2>
        {activeBets.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No active bets</p>
        ) : (
          <div className="space-y-3">
            {activeBets.map((bet) => (
              <Link
                key={bet.id}
                href={`/market/${bet.marketId}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {bet.market.question}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(bet.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`font-semibold ${
                      bet.wageredOutcome === 'Yes' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {bet.wageredOutcome}
                    </p>
                    <p className="text-sm text-gray-600">
                      {(Number(bet.amount) / 1e9).toFixed(2)} tokens
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Bets */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Resolved Bets</h2>
        {resolvedBets.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No resolved bets yet</p>
        ) : (
          <div className="space-y-3">
            {resolvedBets.map((bet) => {
              const won = bet.market.outcome === bet.wageredOutcome;
              return (
                <Link
                  key={bet.id}
                  href={`/market/${bet.marketId}`}
                  className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {bet.market.question}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          won
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {won ? 'Won' : 'Lost'}
                        </span>
                        <span className="text-sm text-gray-500">
                          Outcome: {bet.market.outcome}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-semibold ${
                        bet.wageredOutcome === 'Yes' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {bet.wageredOutcome}
                      </p>
                      <p className="text-sm text-gray-600">
                        {(Number(bet.amount) / 1e9).toFixed(2)} tokens
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
