'use client';

import { FC } from 'react';
import { Card, CardHeader, CardTitle, CardMeta } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { RiskIntelligenceReport } from '../../types';

interface RiskIntelligenceCardProps {
  report: RiskIntelligenceReport;
}

export const RiskIntelligenceCard: FC<RiskIntelligenceCardProps> = ({ report }) => {
  const getConcentrationBadge = (score: number) => {
    if (score > 70) return <Badge variant="error">High Concentration Risk ({score}/100)</Badge>;
    if (score > 40) return <Badge variant="warning">Moderate ({score}/100)</Badge>;
    return <Badge variant="success">Balanced ({score}/100)</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Rules-Based Risk Intelligence</CardTitle>
          <CardMeta>Explainable on-chain exposure and liquidity indicators</CardMeta>
        </div>
        {getConcentrationBadge(report.concentrationScore)}
      </CardHeader>

      <div className="space-y-4">
        {/* Metric summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded">
            <p className="text-[10px] text-[#7D8A89] uppercase tracking-wider font-semibold">
              Dominant Asset
            </p>
            <p className="text-sm font-bold text-[#1B2428] font-mono mt-0.5">
              {report.dominantTokenSymbol || 'SOL'} ({report.dominantTokenPercentage}%)
            </p>
          </div>

          <div className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded">
            <p className="text-[10px] text-[#7D8A89] uppercase tracking-wider font-semibold">
              Concentration Score
            </p>
            <p className="text-sm font-bold text-[#1B2428] font-mono mt-0.5">
              {report.concentrationScore} / 100
            </p>
          </div>

          <div className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded">
            <p className="text-[10px] text-[#7D8A89] uppercase tracking-wider font-semibold">
              Unindexed Mints
            </p>
            <p className="text-sm font-bold text-[#1B2428] font-mono mt-0.5">
              {report.lowLiquidityTokens.length}
            </p>
          </div>

          <div className="p-2.5 bg-[#F8F7F4] border border-[#DEDCD5] rounded">
            <p className="text-[10px] text-[#7D8A89] uppercase tracking-wider font-semibold">
              Activity Velocity
            </p>
            <p className="text-sm font-bold text-[#1B2428] font-mono mt-0.5">
              {report.activityVelocityScore}
            </p>
          </div>
        </div>

        {/* Detailed findings with evidence */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#1B2428] uppercase tracking-wider">
            Evaluation Findings & Supporting Evidence
          </p>
          {report.findings.map((f, i) => (
            <div
              key={i}
              className="p-3 bg-white border border-[#DEDCD5] rounded flex items-start gap-3"
            >
              {f.severity === 'high' ? (
                <ShieldAlert size={16} className="text-[#BA6249] shrink-0 mt-0.5" />
              ) : f.severity === 'medium' ? (
                <AlertTriangle size={16} className="text-[#9B7B2B] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={16} className="text-[#387B60] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#1B2428]">{f.title}</p>
                <p className="text-xs text-[#7D8A89] mt-0.5 leading-relaxed">{f.description}</p>
                <p className="text-[11px] text-[#7D8A89] font-mono mt-1 pt-1 border-t border-[#DAD8D1]/50">
                  Evidence: {f.evidence}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Clear Institutional Disclaimer */}
        <div className="p-2.5 bg-[#F8F7F4] border border-[#DAD8D1] rounded text-[11px] text-[#7D8A89] leading-relaxed">
          <span className="font-semibold text-[#1B2428]">Institutional Risk Methodology:</span> Indicators are strictly computed from public on-chain account state and decentralized pricing feeds. They are mathematical metrics and do not constitute automated scam detection, solvency guarantees, or financial advice.
        </div>
      </div>
    </Card>
  );
};
