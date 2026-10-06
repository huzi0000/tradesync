'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { cn, formatAddress, getSolscanWalletUrl } from '../../lib/utils';

interface AddressDisplayProps {
  address: string;
  chars?: number;
  showCopy?: boolean;
  showExplorer?: boolean;
  explorerUrl?: string;
  className?: string;
  mono?: boolean;
}

export function AddressDisplay({
  address,
  chars = 4,
  showCopy = true,
  showExplorer = true,
  explorerUrl,
  className,
  mono = true,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard not available
    }
  };

  const url = explorerUrl ?? getSolscanWalletUrl(address);

  return (
    <span className={cn('inline-flex items-center gap-1.5 shrink-0', className)}>
      <span className={cn('text-sm text-[#1B2428]', mono && 'font-mono')}>
        {formatAddress(address, chars)}
      </span>
      {showCopy && (
        <button
          onClick={copy}
          className="text-[#7D8A89] hover:text-[#1B2428] transition-colors"
          aria-label="Copy address"
        >
          {copied ? <Check size={13} className="text-[#387B60]" /> : <Copy size={13} />}
        </button>
      )}
      {showExplorer && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#7D8A89] hover:text-[#1B2428] transition-colors"
          aria-label="View on Solscan"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </span>
  );
}
