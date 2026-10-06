import type { TokenBalance, RiskIntelligenceReport } from '@/types';

/**
 * Evaluates rules-based risk intelligence for a Solana wallet
 */
export function evaluateRiskProfile(
  walletAddress: string,
  solBalance: number | null,
  tokens: TokenBalance[]
): RiskIntelligenceReport {
  const findings: RiskIntelligenceReport['findings'] = [];

  // Calculate total portfolio rough value
  let totalEstimatedValueUSD = (solBalance || 0) * 120; // approximate SOL USD if not priced
  let dominantTokenSymbol = 'SOL';
  let maxTokenValueUSD = (solBalance || 0) * 120;

  tokens.forEach(t => {
    const val = (t.price ? t.price * t.uiAmount : 0);
    totalEstimatedValueUSD += val;
    if (val > maxTokenValueUSD) {
      maxTokenValueUSD = val;
      dominantTokenSymbol = t.symbol || t.mint.slice(0, 6);
    }
  });

  const dominantPercentage = totalEstimatedValueUSD > 0
    ? Math.round((maxTokenValueUSD / totalEstimatedValueUSD) * 100)
    : 100;

  // 1. Concentration Analysis
  let concentrationScore = 15;
  if (dominantPercentage > 75) {
    concentrationScore = 85;
    findings.push({
      title: 'High Single-Asset Exposure',
      description: `Portfolio is heavily concentrated in ${dominantTokenSymbol} (${dominantPercentage}% of observed holdings).`,
      severity: 'high',
      evidence: `Single-asset weighting exceeds institutional 50% diversification guideline. Observed weight: ${dominantPercentage}%.`,
    });
  } else if (dominantPercentage > 50) {
    concentrationScore = 55;
    findings.push({
      title: 'Moderate Concentration',
      description: `Dominant holding ${dominantTokenSymbol} accounts for ${dominantPercentage}% of total wallet assets.`,
      severity: 'medium',
      evidence: `Exceeds 50% single-token threshold.`,
    });
  } else {
    findings.push({
      title: 'Balanced Asset Diversification',
      description: `No single token represents more than 50% of observed wallet value.`,
      severity: 'low',
      evidence: `Top asset (${dominantTokenSymbol}) represents ${dominantPercentage}% of portfolio.`,
    });
  }

  // 2. Token Market Data & Liquidity Warnings
  const lowLiquidityTokens: string[] = [];
  const unpricedTokens = tokens.filter(t => !t.price && t.uiAmount > 0);

  if (unpricedTokens.length > 0) {
    findings.push({
      title: 'Unindexed / Low-Liquidity Tokens Detected',
      description: `${unpricedTokens.length} SPL token(s) in this wallet lack public DEX pricing pools on major Solana venues.`,
      severity: 'medium',
      evidence: `Unindexed mints: ${unpricedTokens.slice(0, 3).map(t => t.symbol || t.mint.slice(0, 8)).join(', ')}`,
    });
    unpricedTokens.forEach(t => lowLiquidityTokens.push(t.symbol || t.mint));
  }

  // 3. Activity Velocity Indicator
  const totalPositions = (solBalance && solBalance > 0 ? 1 : 0) + tokens.length;
  const activityVelocityScore: 'Low' | 'Moderate' | 'High' =
    totalPositions > 15 ? 'High' : totalPositions > 5 ? 'Moderate' : 'Low';

  if (totalPositions === 0) {
    findings.push({
      title: 'Dormant or Empty Balance State',
      description: 'Wallet currently holds zero active SOL balance or SPL token accounts on Mainnet Beta.',
      severity: 'low',
      evidence: 'Mainnet RPC returned 0 lamports and no active token accounts.',
    });
  }

  return {
    walletAddress,
    concentrationScore,
    dominantTokenSymbol,
    dominantTokenPercentage: dominantPercentage,
    lowLiquidityTokens,
    largeExposureCount: tokens.filter(t => (t.value || 0) > 1000).length,
    activityVelocityScore,
    findings,
    evaluatedAt: Date.now(),
  };
}
