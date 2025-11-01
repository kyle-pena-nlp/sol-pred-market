'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { createMarket } from '@/lib/solana/market';
import { connection } from '@/lib/solana/connection';
import toast from 'react-hot-toast';

export function CreateMarketForm() {
  const router = useRouter();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [marketId, setMarketId] = useState('');
  const [question, setQuestion] = useState('');
  const [feeBps, setFeeBps] = useState('100'); // 1%
  const [mint, setMint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey || !signTransaction || !signAllTransactions) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!marketId || !question || !mint) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Creating market...');

    try {
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction, signAllTransactions },
        { commitment: 'confirmed' }
      );

      const mintPubkey = new PublicKey(mint);
      const fee = parseInt(feeBps);

      const { signature, marketPDA } = await createMarket(
        provider,
        marketId,
        question,
        fee,
        mintPubkey
      );

      toast.success('Market created successfully!', { id: toastId });
      
      // Redirect to the new market
      router.push(`/market/${marketId}`);
    } catch (error: any) {
      console.error('Error creating market:', error);
      toast.error(error?.message || 'Failed to create market', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div>
        <label htmlFor="marketId" className="block text-sm font-medium text-gray-700 mb-2">
          Market ID
        </label>
        <input
          type="text"
          id="marketId"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          placeholder="unique-market-id"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          A unique identifier for your market (e.g., "btc-100k-2024")
        </p>
      </div>

      <div>
        <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
          Question
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will Bitcoin reach $100,000 by end of 2024?"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={isSubmitting}
          required
        />
      </div>

      <div>
        <label htmlFor="mint" className="block text-sm font-medium text-gray-700 mb-2">
          Token Mint Address
        </label>
        <input
          type="text"
          id="mint"
          value={mint}
          onChange={(e) => setMint(e.target.value)}
          placeholder="Token mint public key"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          The SPL token that will be used for betting
        </p>
      </div>

      <div>
        <label htmlFor="feeBps" className="block text-sm font-medium text-gray-700 mb-2">
          Fee (basis points)
        </label>
        <input
          type="number"
          id="feeBps"
          value={feeBps}
          onChange={(e) => setFeeBps(e.target.value)}
          min="0"
          max="10000"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={isSubmitting}
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          100 basis points = 1%. Current: {(parseInt(feeBps || '0') / 100).toFixed(2)}%
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !publicKey}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
          isSubmitting || !publicKey
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-primary-600 hover:bg-primary-700'
        }`}
      >
        {isSubmitting ? 'Creating Market...' : !publicKey ? 'Connect Wallet' : 'Create Market'}
      </button>
    </form>
  );
}
