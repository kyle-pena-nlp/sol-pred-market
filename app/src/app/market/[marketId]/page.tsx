'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BetForm } from '@/components/BetForm';
import { formatDistanceToNow } from 'date-fns';

interface Bet {
  id: string;
  bettor: string;
  amount: bigint;
  wageredOutcome: string;
  createdAt: Date;
}

interface Market {
  id: string;
  marketId: string;
  question: string;
  authority: string;
  feeBps: number;
  isClosed: boolean;
  outcome: string | null;
  yesWagered: bigint;
  noWagered: bigint;
  marketPubkey: string;
  createdAt: Date;
  bets: Bet[];
}

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.marketId as string;
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMarket = async () => {
    try {
      const response = await fetch(`/api/markets/${marketId}`);
      const data = await response.json();
      setMarket(data.market);
    } catch (error) {
      console.error('Error fetching market:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarket();
  }, [marketId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900">Market not found</h1>
          <p className="text-gray-500 mt-2">This market doesn't exist or hasn't been synced yet.</p>
        </div>
      </div>
    );
  }

  const totalWagered = Number(market.yesWagered) + Number(market.noWagered);
  const yesPercentage = totalWagered > 0 
    ? (Number(market.yesWagered) / totalWagered) * 100 
    : 50;
  const noPercentage = totalWagered > 0 
    ? (Number(market.noWagered) / totalWagered) * 100 
    : 50;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Market Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-2xl font-bold text-gray-900 flex-1">
                {market.question}
              </h1>
              {market.isClosed && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  market.outcome === 'Yes' 
                    ? 'bg-green-100 text-green-800' 
                    : market.outcome === 'No'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {market.outcome ? `Resolved: ${market.outcome}` : 'Closed'}
                </span>
              )}
              {!market.isClosed && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Volume</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(totalWagered / 1e9).toFixed(2)} tokens
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Fee</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(market.feeBps / 100).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-green-600">Yes</span>
                  <span className="text-lg font-bold text-green-600">
                    {yesPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${yesPercentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {(Number(market.yesWagered) / 1e9).toFixed(2)} tokens
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-red-600">No</span>
                  <span className="text-lg font-bold text-red-600">
                    {noPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full transition-all"
                    style={{ width: `${noPercentage}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {(Number(market.noWagered) / 1e9).toFixed(2)} tokens
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-500">
              <p>Created {formatDistanceToNow(new Date(market.createdAt), { addSuffix: true })}</p>
              <p className="mt-1 font-mono text-xs break-all">Market: {market.marketPubkey}</p>
            </div>
          </div>

          {/* Bet History */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Bets</h2>
            {market.bets.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No bets yet. Be the first!</p>
            ) : (
              <div className="space-y-3">
                {market.bets.map((bet) => (
                  <div key={bet.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-mono text-sm text-gray-600">
                        {bet.bettor.slice(0, 4)}...{bet.bettor.slice(-4)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(bet.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right">
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
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bet Form */}
        <div className="lg:col-span-1">
          {!market.isClosed && (
            <div className="sticky top-4">
              <BetForm 
                marketId={market.marketId} 
                mint="YOUR_TOKEN_MINT_HERE"
                onSuccess={fetchMarket}
              />
            </div>
          )}
          {market.isClosed && (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Market Closed</h3>
              <p className="text-gray-600">This market has been resolved and is no longer accepting bets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
