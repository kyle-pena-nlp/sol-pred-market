'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { placeBet } from '@/lib/solana/market';
import { connection } from '@/lib/solana/connection';
import toast from 'react-hot-toast';

interface BetFormProps {
  marketId: string;
  mint: string;
  onSuccess?: () => void;
}

export function BetForm({ marketId, mint, onSuccess }: BetFormProps) {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [amount, setAmount] = useState('');
  const [outcome, setOutcome] = useState<'Yes' | 'No'>('Yes');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey || !signTransaction || !signAllTransactions) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Placing bet...');

    try {
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction, signAllTransactions },
        { commitment: 'confirmed' }
      );

      const amountInLamports = Math.floor(parseFloat(amount) * 1e9);
      const mintPubkey = new PublicKey(mint);

      const { signature } = await placeBet(
        provider,
        marketId,
        amountInLamports,
        outcome,
        mintPubkey
      );

      toast.success('Bet placed successfully!', { id: toastId });
      setAmount('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error placing bet:', error);
      toast.error(error?.message || 'Failed to place bet', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-900">Place Your Bet</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Outcome
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOutcome('Yes')}
            className={`py-3 px-4 rounded-lg font-semibold transition-colors ${
              outcome === 'Yes'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setOutcome('No')}
            className={`py-3 px-4 rounded-lg font-semibold transition-colors ${
              outcome === 'No'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            No
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
          Amount (tokens)
        </label>
        <input
          type="number"
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          step="0.01"
          min="0"
          placeholder="0.00"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={isSubmitting}
        />
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
        {isSubmitting ? 'Placing Bet...' : !publicKey ? 'Connect Wallet' : 'Place Bet'}
      </button>
    </form>
  );
}
