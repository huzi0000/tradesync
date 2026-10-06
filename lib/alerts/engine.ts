import { AlertRule, AlertHistoryItem, TrackedWallet } from '../../types';
import { getSOLBalance, getTransactionHistory } from '../solana/connection';
import { searchTokenByMint } from '../api/dexscreener';

/**
 * Evaluates an individual alert rule against live Solana Mainnet and DexScreener data
 */
export async function evaluateAlertRule(
  rule: AlertRule,
  trackedWallets: TrackedWallet[]
): Promise<AlertHistoryItem | null> {
  if (!rule.isEnabled) return null;

  try {
    if (rule.ruleType === 'wallet_swap') {
      // Fetch recent transactions for target address
      const txs = await getTransactionHistory(rule.targetAddress, 5);
      const recentSwap = txs.find(t => t.type === 'swap' && t.blockTime && Date.now() - t.blockTime * 1000 < 300000);

      if (recentSwap) {
        const walletLabel = trackedWallets.find(w => w.address === rule.targetAddress)?.label || rule.targetAddress.slice(0, 8);
        return {
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          title: `DEX Swap Detected: ${walletLabel}`,
          message: `Tracked wallet executed a verified swap in block slot ${recentSwap.slot}. Signature: ${recentSwap.signature.slice(0, 16)}...`,
          severity: 'info',
          isRead: false,
          triggeredAt: Date.now(),
          metadata: { signature: recentSwap.signature, slot: recentSwap.slot },
        };
      }
    }

    if (rule.ruleType === 'price_threshold' && rule.parameters.tokenMint && rule.parameters.thresholdUSD) {
      const pairs = await searchTokenByMint(rule.parameters.tokenMint);
      const solanaPair = pairs?.[0];
      if (solanaPair && solanaPair.priceUsd) {
        const currentPrice = parseFloat(solanaPair.priceUsd);
        const threshold = rule.parameters.thresholdUSD;
        const isTriggered =
          rule.parameters.direction === 'above'
            ? currentPrice >= threshold
            : currentPrice <= threshold;

        if (isTriggered) {
          return {
            id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            title: `Price Threshold Alert: ${solanaPair.baseToken.symbol}`,
            message: `${solanaPair.baseToken.symbol} reached $${currentPrice.toFixed(4)} (${rule.parameters.direction} threshold $${threshold}).`,
            severity: 'warning',
            isRead: false,
            triggeredAt: Date.now(),
            metadata: { currentPrice, threshold, symbol: solanaPair.baseToken.symbol },
          };
        }
      }
    }

    if (rule.ruleType === 'concentration_risk') {
      const balance = await getSOLBalance(rule.targetAddress);
      // Rules-based concentration test
      if (balance > 1000) {
        return {
          id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ruleId: rule.id,
          ruleName: rule.name,
          title: `High Balance Concentration: ${rule.targetAddress.slice(0, 6)}...`,
          message: `Target wallet holds ${balance.toFixed(2)} SOL. Significant capital exposure concentrated in single address.`,
          severity: 'warning',
          isRead: false,
          triggeredAt: Date.now(),
          metadata: { balance },
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Error evaluating alert rule ${rule.id}:`, error);
    return null;
  }
}
