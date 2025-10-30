'use client';

import { useEffect, useState } from 'react';
import { MarketCard } from '@/components/MarketCard';

interface Market {
  id: string;
  marketId: string;
  question: string;
  isClosed: boolean;
  outcome: string | null;
  yesWagered: bigint;
  noWagered: bigint;
  createdAt: Date;
  feeBps: number;
}

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchMarkets = async (sync = false) => {
    try {
      if (sync) setSyncing(true);
      const response = await fetch(`/api/markets${sync ? '?sync=true' : ''}`);
      const data = await response.json();
      setMarkets(data.markets);
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoading(false);
      if (sync) setSyncing(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prediction Markets</h1>
          <p className="mt-2 text-gray-600">
            Bet on outcomes and earn rewards when you're right
          </p>
        </div>
        <button
          onClick={() => fetchMarkets(true)}
          disabled={syncing}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            syncing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {syncing ? 'Syncing...' : 'Sync from Chain'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No markets found</p>
          <p className="text-gray-400 mt-2">Create the first market to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
