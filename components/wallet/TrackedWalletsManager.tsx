'use client';

import { FC, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { AddressDisplay } from '../ui/AddressDisplay';
import { Plus, Trash2, Eye, ShieldCheck, Tag, ExternalLink } from 'lucide-react';
import { TrackedWallet } from '../../types';
import { getSolscanWalletUrl } from '../../lib/utils';

interface TrackedWalletsManagerProps {
  wallets: TrackedWallet[];
  onAddWallet: (address: string, label: string, category: TrackedWallet['category'], notes: string) => { success: boolean; error?: string } | Promise<{ success: boolean; error?: string }>;
  onRemoveWallet: (id: string) => void;
  onSelectWallet?: (address: string) => void;
}

export const TrackedWalletsManager: FC<TrackedWalletsManagerProps> = ({
  wallets,
  onAddWallet,
  onRemoveWallet,
  onSelectWallet,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<TrackedWallet['category']>('Whale');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await onAddWallet(address, label, category, notes);
    if (!result.success) {
      setError(result.error || 'Failed to add wallet');
      return;
    }
    setAddress('');
    setLabel('');
    setNotes('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#1B2428]">Tracked Public Wallets</h3>
          <p className="text-xs text-[#7D8A89]">
            Monitor high-signal Solana addresses without requiring custodial keys
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={13} />
          <span>{showAddForm ? 'Cancel' : 'Track New Wallet'}</span>
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-[#F8F7F4] border border-[#DEDCD5] rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1B2428] mb-1">
                Solana Public Address
              </label>
              <Input
                placeholder="e.g. 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="font-mono text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1B2428] mb-1">
                Custom Label
              </label>
              <Input
                placeholder="e.g. Binance Settlement, Whale Alpha #1"
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1B2428] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as TrackedWallet['category'])}
                className="w-full h-9 px-3 text-xs bg-white border border-[#DEDCD5] rounded text-[#1B2428] focus:outline-none focus:border-[#1B2428]"
              >
                <option value="Whale">Whale</option>
                <option value="Market Maker">Market Maker</option>
                <option value="Alpha Caller">Alpha Caller</option>
                <option value="Deployer">Deployer</option>
                <option value="Personal">Personal</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1B2428] mb-1">
                Research Notes (Optional)
              </label>
              <Input
                placeholder="Thesis or observation notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-xs text-[#BA6249]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Save Tracked Wallet
            </Button>
          </div>
        </form>
      )}

      {/* Wallets table */}
      <div className="overflow-x-auto border border-[#DEDCD5] rounded-lg bg-white">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#F8F7F4] border-b border-[#DAD8D1] text-[#7D8A89]">
            <tr>
              <th className="py-2.5 px-3 font-semibold">Wallet Label</th>
              <th className="py-2.5 px-3 font-semibold">Address</th>
              <th className="py-2.5 px-3 font-semibold">Category</th>
              <th className="py-2.5 px-3 font-semibold">Verification Status</th>
              <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DAD8D1]">
            {wallets.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[#7D8A89]">
                  No tracked wallets configured yet. Click Track New Wallet above to begin.
                </td>
              </tr>
            ) : (
              wallets.map(w => (
                <tr key={w.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-[#1B2428]">{w.label}</p>
                    {w.notes && <p className="text-[11px] text-[#7D8A89] truncate max-w-xs">{w.notes}</p>}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <AddressDisplay address={w.address} chars={4} />
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant="neutral">{w.category || 'Other'}</Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    {w.isOwnerVerified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#387B60] font-medium">
                        <ShieldCheck size={12} /> Owned Signer
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#7D8A89]">Public Monitored</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {onSelectWallet && (
                        <button
                          onClick={() => onSelectWallet(w.address)}
                          className="p-1 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
                          title="Inspect Activity"
                        >
                          <Eye size={13} />
                        </button>
                      )}
                      <a
                        href={getSolscanWalletUrl(w.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
                        title="View on Solscan"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <button
                        onClick={() => onRemoveWallet(w.id)}
                        className="p-1 rounded text-[#7D8A89] hover:text-[#BA6249] hover:bg-[#FBF0ED] transition-colors"
                        title="Remove from tracking"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
