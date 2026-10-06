'use client';

import { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAlerts } from '../../hooks/useAlerts';
import { useTrackedWallets } from '../../hooks/useTrackedWallets';
import { Card, CardHeader, CardTitle, CardMeta } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AddressDisplay } from '../../components/ui/AddressDisplay';
import { useWalletData } from '../../hooks/useWallet';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_RPC_ENDPOINT,
  DEFAULT_PUBLIC_FALLBACK_RPC,
  OFFICIAL_MAINNET_RPC,
} from '../../lib/constants';
import { getConnection, resetConnection } from '../../lib/solana/connection';
import {
  ExternalLink,
  Trash2,
  RefreshCw,
  Check,
  Activity,
  Shield,
  AlertCircle,
  Bell,
  Plus,
  Play,
} from 'lucide-react';
import { AlertRuleType } from '../../types';

export default function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { tokens: watchlist, remove: removeFromWatchlist } = useWatchlist();
  const { address, walletName, solBalance, connected } = useWalletData();
  const { wallets: trackedWallets } = useTrackedWallets(address);
  const {
    rules: alertRules,
    toggleRule,
    deleteRule,
    addRule,
    runManualCheck,
    isEvaluating,
    clearHistory,
    history: alertHistory,
  } = useAlerts(trackedWallets);

  const [rpcInput, setRpcInput] = useState(settings.rpcUrl || DEFAULT_RPC_ENDPOINT);
  const [saved, setSaved] = useState(false);

  // Live RPC Diagnostics State
  const [isTestingRpc, setIsTestingRpc] = useState(false);
  const [rpcDiagnostics, setRpcDiagnostics] = useState<{
    success: boolean;
    latencyMs?: number;
    slot?: number;
    error?: string;
  } | null>(null);

  // New Alert Rule Form
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState<AlertRuleType>('wallet_swap');
  const [ruleTarget, setRuleTarget] = useState('');
  const [ruleThreshold, setRuleThreshold] = useState('');

  const saveRpc = (targetUrl?: string) => {
    const url = targetUrl ?? (rpcInput.trim() || DEFAULT_RPC_ENDPOINT);
    setRpcInput(url);
    update({ rpcUrl: url });
    resetConnection();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestRpc = async (testUrl?: string) => {
    const url = testUrl || rpcInput.trim() || DEFAULT_RPC_ENDPOINT;
    setIsTestingRpc(true);
    setRpcDiagnostics(null);

    const start = performance.now();
    try {
      const conn = getConnection(url);
      const slot = await conn.getSlot();
      const latency = Math.round(performance.now() - start);
      setRpcDiagnostics({
        success: true,
        latencyMs: latency,
        slot,
      });
    } catch (err) {
      setRpcDiagnostics({
        success: false,
        error: err instanceof Error ? err.message : 'RPC query timed out or was rejected',
      });
    } finally {
      setIsTestingRpc(false);
    }
  };

  const handleAddRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleTarget.trim()) return;

    addRule({
      name: ruleName.trim(),
      ruleType,
      targetAddress: ruleTarget.trim(),
      parameters: {
        thresholdUSD: ruleThreshold ? parseFloat(ruleThreshold) : undefined,
        direction: 'above',
      },
      isEnabled: true,
    });

    setRuleName('');
    setRuleTarget('');
    setRuleThreshold('');
    setShowAddRule(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Solana Mainnet RPC Configuration */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Solana Mainnet RPC Endpoint</CardTitle>
            <CardMeta>Configure network gateway for balances, token indexing, and transaction reads</CardMeta>
          </div>
          <Badge variant="neutral">Solana Mainnet</Badge>
        </CardHeader>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                label="Active RPC Endpoint URL"
                value={rpcInput}
                onChange={e => setRpcInput(e.target.value)}
                placeholder="/api/rpc"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => handleTestRpc()}
                loading={isTestingRpc}
                title="Test round-trip latency and fetch current slot"
              >
                <Activity size={14} />
                Test Latency
              </Button>
              <Button size="md" onClick={() => saveRpc()}>
                {saved ? (
                  <>
                    <Check size={14} className="text-[#387B60]" />
                    Saved
                  </>
                ) : (
                  'Apply Endpoint'
                )}
              </Button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="pt-2 border-t border-[#DAD8D1]">
            <p className="text-xs font-semibold text-[#1B2428] mb-2">Recommended Endpoints:</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRpcInput(DEFAULT_RPC_ENDPOINT);
                  saveRpc(DEFAULT_RPC_ENDPOINT);
                  handleTestRpc(DEFAULT_RPC_ENDPOINT);
                }}
                className="px-2.5 py-1.5 rounded border border-[#DEDCD5] bg-[#F8F7F4] hover:bg-[#E8E5DE] text-[#1B2428] font-mono transition-colors text-left"
              >
                <span className="font-semibold block">TradeSync Proxy (Recommended)</span>
                <span className="text-[11px] text-[#7D8A89]">/api/rpc (Bypasses browser CORS &amp; 403 blocks)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRpcInput(DEFAULT_PUBLIC_FALLBACK_RPC);
                  saveRpc(DEFAULT_PUBLIC_FALLBACK_RPC);
                  handleTestRpc(DEFAULT_PUBLIC_FALLBACK_RPC);
                }}
                className="px-2.5 py-1.5 rounded border border-[#DEDCD5] bg-[#F8F7F4] hover:bg-[#E8E5DE] text-[#1B2428] font-mono transition-colors text-left"
              >
                <span className="font-semibold block">PublicNode Fallback</span>
                <span className="text-[11px] text-[#7D8A89]">solana-rpc.publicnode.com</span>
              </button>
            </div>
          </div>

          {/* Diagnostics Results */}
          {rpcDiagnostics && (
            <div
              className={`p-3 rounded border text-xs font-mono ${
                rpcDiagnostics.success
                  ? 'border-[#C5DDD4] bg-[#EBF5F0] text-[#387B60]'
                  : 'border-[#EDCCC5] bg-[#FBF0ED] text-[#BA6249]'
              }`}
            >
              {rpcDiagnostics.success ? (
                <div className="flex items-center justify-between">
                  <span>✓ Node Responsive — Latency: {rpcDiagnostics.latencyMs}ms</span>
                  <span>Live Slot: #{rpcDiagnostics.slot?.toLocaleString()}</span>
                </div>
              ) : (
                <div>✕ Connection Failed: {rpcDiagnostics.error}</div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* On-Chain Alert Engine Rules */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>On-Chain Alert Engine</CardTitle>
            <CardMeta>Automated rules-based surveillance for swaps, whale flows, and price changes</CardMeta>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runManualCheck()}
              loading={isEvaluating}
            >
              <Play size={12} />
              <span>Run Check</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowAddRule(!showAddRule)}
            >
              <Plus size={12} />
              <span>New Rule</span>
            </Button>
          </div>
        </CardHeader>

        {showAddRule && (
          <form onSubmit={handleAddRuleSubmit} className="p-3 bg-[#F8F7F4] border border-[#DEDCD5] rounded mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder="Rule Name (e.g. Whale Swap)"
                value={ruleName}
                onChange={e => setRuleName(e.target.value)}
                required
              />
              <select
                value={ruleType}
                onChange={e => setRuleType(e.target.value as AlertRuleType)}
                className="h-9 px-3 text-xs bg-white border border-[#DEDCD5] rounded text-[#1B2428]"
              >
                <option value="wallet_swap">Tracked Wallet Swap</option>
                <option value="price_threshold">Price Threshold ($)</option>
                <option value="concentration_risk">Concentration Risk</option>
              </select>
              <Input
                placeholder="Target Solana Address or Mint..."
                value={ruleTarget}
                onChange={e => setRuleTarget(e.target.value)}
                className="font-mono text-xs"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddRule(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="primary">
                Save Rule
              </Button>
            </div>
          </form>
        )}

        <div className="divide-y divide-[#DAD8D1] border border-[#DEDCD5] rounded bg-white">
          {alertRules.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#7D8A89]">
              No alert surveillance rules active. Click New Rule above to create one.
            </div>
          ) : (
            alertRules.map(rule => (
              <div key={rule.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#FAF8F5]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1B2428]">{rule.name}</span>
                    <Badge variant={rule.isEnabled ? 'success' : 'neutral'}>
                      {rule.ruleType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="font-mono text-[11px] text-[#7D8A89] mt-0.5">
                    Target: {rule.targetAddress.slice(0, 8)}...{rule.targetAddress.slice(-6)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                      rule.isEnabled
                        ? 'bg-[#EBF5F0] border-[#C5DDD4] text-[#387B60]'
                        : 'bg-[#F3F0E9] border-[#DEDCD5] text-[#7D8A89]'
                    }`}
                  >
                    {rule.isEnabled ? 'Enabled' : 'Paused'}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-1 text-[#7D8A89] hover:text-[#BA6249]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Local Watchlist Manager */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-[#DAD8D1] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1B2428]">
              Local Token Watchlist ({watchlist.length})
            </h3>
            <p className="text-xs text-[#7D8A89] mt-0.5">Tokens pinned to your local terminal session</p>
          </div>
        </div>
        {watchlist.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-[#7D8A89]">
            No tokens currently saved in your watchlist. Search any mint in Token Explorer to pin tokens.
          </div>
        ) : (
          <div className="divide-y divide-[#DAD8D1]">
            {watchlist.map(token => (
              <div
                key={token.mint}
                className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#F3F0E9] transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-[#1B2428]">{token.symbol}</span>
                  <span className="text-xs text-[#7D8A89] ml-2 truncate">{token.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <AddressDisplay address={token.mint} chars={4} showExplorer={false} />
                  <button
                    onClick={() => removeFromWatchlist(token.mint)}
                    className="p-1.5 text-[#7D8A89] hover:text-[#BA6249] transition-colors"
                    aria-label={`Remove ${token.symbol} from watchlist`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* System Reset */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Reset Terminal Preferences</CardTitle>
            <CardMeta>Restores defaults without deleting wallet keys or browser extensions</CardMeta>
          </div>
        </CardHeader>
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw size={13} />
          Reset All Terminal Preferences
        </Button>
      </Card>
    </div>
  );
}
