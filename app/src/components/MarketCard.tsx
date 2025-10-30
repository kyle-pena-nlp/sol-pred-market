'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface MarketCardProps {
  market: {
    id: string;
    marketId: string;
    question: string;
    isClosed: boolean;
    outcome: string | null;
    yesWagered: bigint;
    noWagered: bigint;
    createdAt: Date;
    feeBps: number;
  };
}

export function MarketCard({ market }: MarketCardProps) {
  const totalWagered = Number(market.yesWagered) + Number(market.noWagered);
  const yesPercentage = totalWagered > 0 
    ? (Number(market.yesWagered) / totalWagered) * 100 
    : 50;
  const noPercentage = totalWagered > 0 
    ? (Number(market.noWagered) / totalWagered) * 100 
    : 50;

  return (
    <Link href={`/market/${market.marketId}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex-1 mr-4">
            {market.question}
          </h3>
          {market.isClosed && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
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
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Active
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-green-600">Yes</span>
              <span className="text-sm font-bold text-green-600">
                {yesPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${yesPercentage}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-red-600">No</span>
              <span className="text-sm font-bold text-red-600">
                {noPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${noPercentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
          <span>
            Total: {(totalWagered / 1e9).toFixed(2)} tokens
          </span>
          <span>
            {formatDistanceToNow(new Date(market.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}
