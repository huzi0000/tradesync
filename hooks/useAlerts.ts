'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertRule, AlertHistoryItem, TrackedWallet } from '../types';
import { evaluateAlertRule } from '../lib/alerts/engine';

const RULES_STORAGE_KEY = 'tradesync:alert_rules';
const HISTORY_STORAGE_KEY = 'tradesync:alert_history';

const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'rule-default-1',
    name: 'Binance Hot Wallet Swap Watcher',
    ruleType: 'wallet_swap',
    targetAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    parameters: {},
    isEnabled: true,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'rule-default-2',
    name: 'SOL Price Dip Alert ($100)',
    ruleType: 'price_threshold',
    targetAddress: 'So11111111111111111111111111111111111111112',
    parameters: {
      tokenMint: 'So11111111111111111111111111111111111111112',
      thresholdUSD: 100,
      direction: 'below',
    },
    isEnabled: true,
    createdAt: Date.now() - 86400000,
  },
];

export function useAlerts(trackedWallets: TrackedWallet[] = []) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load from persistent storage
  useEffect(() => {
    try {
      const storedRules = localStorage.getItem(RULES_STORAGE_KEY);
      if (storedRules) {
        setRules(JSON.parse(storedRules) as AlertRule[]);
      } else {
        setRules(DEFAULT_RULES);
        localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(DEFAULT_RULES));
      }

      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory) as AlertHistoryItem[]);
      }
    } catch {
      setRules(DEFAULT_RULES);
    }
    setIsLoaded(true);
  }, []);

  const saveRules = useCallback((newRules: AlertRule[]) => {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(newRules));
    } catch {
      // Ignore
    }
    setRules(newRules);
  }, []);

  const saveHistory = useCallback((newHistory: AlertHistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch {
      // Ignore
    }
    setHistory(newHistory);
  }, []);

  // Poll active rules
  const runEvaluation = useCallback(async () => {
    if (rules.length === 0 || isEvaluating) return;

    setIsEvaluating(true);
    try {
      const activeRules = rules.filter(r => r.isEnabled);
      for (const rule of activeRules) {
        const alertItem = await evaluateAlertRule(rule, trackedWallets);
        if (alertItem) {
          // Check for duplicate alert in last 10 minutes
          setHistory(prev => {
            const hasRecentDuplicate = prev.some(
              h => h.ruleId === alertItem.ruleId && Math.abs(h.triggeredAt - alertItem.triggeredAt) < 600000
            );
            if (hasRecentDuplicate) return prev;
            const updated = [alertItem, ...prev].slice(0, 50); // Keep last 50
            try {
              localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
            } catch {
              // Ignore
            }
            return updated;
          });
        }
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [rules, isEvaluating, trackedWallets]);

  // Periodic polling check every 60 seconds
  useEffect(() => {
    timerRef.current = setInterval(runEvaluation, 60000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runEvaluation]);

  const addRule = useCallback((newRule: Omit<AlertRule, 'id' | 'createdAt'>) => {
    const rule: AlertRule = {
      ...newRule,
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const next = [rule, ...rules];
    saveRules(next);
  }, [rules, saveRules]);

  const toggleRule = useCallback((id: string) => {
    const next = rules.map(r => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r));
    saveRules(next);
  }, [rules, saveRules]);

  const deleteRule = useCallback((id: string) => {
    const next = rules.filter(r => r.id !== id);
    saveRules(next);
  }, [rules, saveRules]);

  const markAllAsRead = useCallback(() => {
    const next = history.map(h => ({ ...h, isRead: true }));
    saveHistory(next);
  }, [history, saveHistory]);

  const clearHistory = useCallback(() => {
    saveHistory([]);
  }, [saveHistory]);

  const unreadCount = history.filter(h => !h.isRead).length;

  return {
    rules,
    history,
    unreadCount,
    isLoaded,
    isEvaluating,
    addRule,
    toggleRule,
    deleteRule,
    markAllAsRead,
    clearHistory,
    runManualCheck: runEvaluation,
  };
}
