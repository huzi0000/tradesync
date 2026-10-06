import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { evaluateAlertRule } from '@/lib/alerts/engine';
import type { AlertRule, AlertHistoryItem } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Validate Cron Authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const evaluatedAt = new Date().toISOString();
    let rulesCount = 0;
    let alertsTriggered = 0;

    if (supabase) {
      // 2. Fetch active alert rules from Supabase
      const { data: dbRules, error: rulesError } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('is_enabled', true);

      if (rulesError) {
        throw new Error(`Failed to fetch alert rules: ${rulesError.message}`);
      }

      const rules: AlertRule[] = (dbRules || []).map((r) => ({
        id: r.id,
        name: r.name,
        ruleType: r.rule_type,
        targetAddress: r.target_address,
        parameters: r.parameters || {},
        isEnabled: r.is_enabled,
        createdAt: new Date(r.created_at).getTime(),
        lastTriggered: r.last_triggered_at ? new Date(r.last_triggered_at).getTime() : undefined,
      }));

      rulesCount = rules.length;

      // 3. Evaluate each rule
      const triggeredAlerts: AlertHistoryItem[] = [];
      for (const rule of rules) {
        try {
          const item = await evaluateAlertRule(rule, []);
          if (item) {
            triggeredAlerts.push(item);
          }
        } catch {
          // Continue evaluating other rules
        }
      }

      alertsTriggered = triggeredAlerts.length;

      // 4. Insert triggered alerts into alert_history
      if (triggeredAlerts.length > 0) {
        const historyEntries = triggeredAlerts.map((a: AlertHistoryItem) => ({
          rule_id: a.ruleId,
          title: a.title,
          message: a.message,
          severity: a.severity || 'info',
          is_read: false,
          triggered_at: new Date(a.triggeredAt).toISOString(),
          metadata: a.metadata || {},
        }));

        await supabase.from('alert_history').insert(historyEntries);
      }
    }

    return NextResponse.json({
      success: true,
      job: 'tradesync_scheduled_alert_monitor',
      evaluatedAt,
      supabaseConnected: Boolean(supabase),
      rulesEvaluated: rulesCount,
      alertsTriggered,
      message: 'Background alert check complete within free-tier scheduled limits.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron execution failed' },
      { status: 500 }
    );
  }
}
