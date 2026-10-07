'use client';

import { FC, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { X, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { VerifiedTradeRecord } from '../../types';
import { isValidTransactionSignature, getSolscanTxUrl } from '../../lib/utils';

interface TradeShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onTradeShared: (trade: VerifiedTradeRecord, note: string) => void;
}

export const TradeShareModal: FC<TradeShareModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onTradeShared,
}) => {
  const [signature, setSignature] = useState('');
  const [researchNote, setResearchNote] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verifiedTrade, setVerifiedTrade] = useState<VerifiedTradeRecord | null>(null);
  const [ownershipNotice, setOwnershipNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerify = async () => {
    const trimmed = signature.trim();
    if (!isValidTransactionSignature(trimmed)) {
      setVerificationError('Invalid Solana transaction signature format (must be 87-88 base58 characters)');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setVerifiedTrade(null);
    setOwnershipNotice(null);

    try {
      const res = await fetch('/api/trades/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signature: trimmed, roomId }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Failed to verify transaction on Solana Mainnet');
      }

      setVerifiedTrade(data.tradeRecord);
      setOwnershipNotice(data.ownershipNotice);
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePublish = () => {
    if (!verifiedTrade) return;
    onTradeShared(verifiedTrade, researchNote.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg bg-white border border-[#DEDCD5] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#DAD8D1] bg-[#F8F7F4]">
          <div>
            <h3 className="text-sm font-semibold text-[#1B2428]">Share Verified Solana Trade</h3>
            <p className="text-xs text-[#7D8A89] mt-0.5">
              Cryptographically verified on Solana Mainnet Beta
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#7D8A89] hover:text-[#1B2428] hover:bg-[#E8E5DE] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-[#1B2428] mb-1">
              Solana Transaction Signature
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste 88-char base58 signature..."
                value={signature}
                onChange={e => setSignature(e.target.value)}
                className="font-mono text-xs flex-1"
                disabled={isVerifying}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={handleVerify}
                disabled={isVerifying || !signature.trim()}
              >
                {isVerifying ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
            {verificationError && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-[#BA6249]">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}
          </div>

          {verifiedTrade && (
            <div className="p-3 bg-[#F8F7F4] border border-[#DEDCD5] rounded-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1B2428] uppercase tracking-wide">
                  {verifiedTrade.dexName}
                </span>
                <Badge variant={verifiedTrade.isOwnerVerified ? 'success' : 'neutral'}>
                  {verifiedTrade.isOwnerVerified ? (
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={11} /> Verified Owner Trade
                    </span>
                  ) : (
                    'Observed Public Swap'
                  )}
                </Badge>
              </div>

              {/* Swap summary */}
              <div className="flex items-center justify-between p-2.5 bg-white border border-[#DEDCD5] rounded text-xs">
                <div>
                  <p className="text-[10px] text-[#7D8A89]">Input</p>
                  <p className="font-semibold text-[#1B2428] font-mono">
                    {verifiedTrade.inputToken.amount.toFixed(4)} {verifiedTrade.inputToken.symbol}
                  </p>
                </div>
                <ArrowRight size={14} className="text-[#7D8A89]" />
                <div className="text-right">
                  <p className="text-[10px] text-[#7D8A89]">Output</p>
                  <p className="font-semibold text-[#387B60] font-mono">
                    +{verifiedTrade.outputToken.amount.toFixed(4)} {verifiedTrade.outputToken.symbol}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#7D8A89]">
                <span>Slot: #{verifiedTrade.slot}</span>
                <a
                  href={getSolscanTxUrl(verifiedTrade.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#BA6249] hover:underline"
                >
                  View on Solscan ↗
                </a>
              </div>

              {ownershipNotice && (
                <p className="text-[11px] text-[#7D8A89] italic">{ownershipNotice}</p>
              )}
            </div>
          )}

          {verifiedTrade && (
            <div>
              <label className="block text-xs font-semibold text-[#1B2428] mb-1">
                Research Notes / Thesis (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add trade context, reasoning, entry criteria, or alpha observations..."
                value={researchNote}
                onChange={e => setResearchNote(e.target.value)}
                className="w-full p-2.5 text-xs text-[#1B2428] bg-white border border-[#DEDCD5] rounded placeholder:text-[#7D8A89] focus:outline-none focus:border-[#1B2428]"
              />
            </div>
          )}

          <div className="p-2.5 bg-[#FAF8F5] border border-[#DAD8D1] rounded text-[11px] text-[#7D8A89] space-y-1">
            <p className="font-semibold text-[#1B2428]">Institutional Verification Policy:</p>
            <p>
              TradeSync verifies cryptographic execution and DEX program routing directly on Solana Mainnet Beta. Verification does not imply trade profitability, financial endorsement, or absence of smart-contract risk.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#DAD8D1] bg-[#F8F7F4]">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePublish}
            disabled={!verifiedTrade}
          >
            Publish to Room Feed
          </Button>
        </div>
      </div>
    </div>
  );
};
