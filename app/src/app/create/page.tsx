import { CreateMarketForm } from '@/components/CreateMarketForm';

export default function CreateMarketPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Market</h1>
        <p className="mt-2 text-gray-600">
          Set up a new prediction market for others to bet on
        </p>
      </div>

      <CreateMarketForm />

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Tips for Creating a Good Market
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Make your question clear and unambiguous</li>
          <li>• Ensure the outcome can be objectively verified</li>
          <li>• Set a reasonable fee (1-5% is typical)</li>
          <li>• Use a widely available SPL token for betting</li>
        </ul>
      </div>
    </div>
  );
}
