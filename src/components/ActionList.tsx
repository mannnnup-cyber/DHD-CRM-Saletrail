import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Zap, ArrowRight, X, RefreshCw,
  Mail, MessageCircle, UserPlus, TrendingUp, Receipt, FileText
} from 'lucide-react';

type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Opportunity {
  id: string;
  rule: string;
  priority: Priority;
  title: string;
  description: string;
  contactId: string | null;
  contactName: string | null;
  actionUrl: string;
  ageMs: number;
  sourceId: string;
}

const PRIORITY_STYLES: Record<Priority, { badge: string; border: string; dot: string }> = {
  CRITICAL: { badge: 'bg-red-500/20 text-red-400 border border-red-500/30', border: 'border-l-red-500', dot: 'bg-red-500' },
  HIGH:     { badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30', border: 'border-l-amber-500', dot: 'bg-amber-500' },
  MEDIUM:   { badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', border: 'border-l-blue-500', dot: 'bg-blue-400' },
  LOW:      { badge: 'bg-gray-500/20 text-gray-400 border border-gray-600/30', border: 'border-l-gray-600', dot: 'bg-gray-500' },
};

const RULE_ICONS: Record<string, React.ElementType> = {
  EMAIL_UNANSWERED: Mail,
  WHATSAPP_UNANSWERED: MessageCircle,
  LEAD_NO_CONTACT: UserPlus,
  DEAL_STALE: TrendingUp,
  INVOICE_OVERDUE: Receipt,
  QUOTE_EXPIRING: FileText,
  QUOTE_OVERDUE: FileText,
};

interface ActionListProps {
  onCountChange?: (count: number) => void;
  compact?: boolean;
}

const ActionList: React.FC<ActionListProps> = ({ onCountChange, compact = false }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/opportunities');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const opps: Opportunity[] = json.opportunities || [];
      setOpportunities(opps);
      onCountChange?.(opps.length);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (opp: Opportunity) => {
    setDismissing(prev => new Set(prev).add(opp.id));
    try {
      await fetch('/api/opportunities?action=dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleKey: opp.rule, sourceId: opp.sourceId }),
      });
      const next = opportunities.filter(o => o.id !== opp.id);
      setOpportunities(next);
      onCountChange?.(next.length);
    } catch {
      // silently ignore — item stays visible
    } finally {
      setDismissing(prev => { const s = new Set(prev); s.delete(opp.id); return s; });
    }
  };

  const navigate = (url: string) => {
    window.location.hash = `#${url}`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Failed to load opportunities: {error}
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">All caught up!</p>
        <p className="text-xs mt-1">No action items right now.</p>
      </div>
    );
  }

  const visible = compact ? opportunities.slice(0, 5) : opportunities;

  return (
    <div className="space-y-2">
      {visible.map(opp => {
        const styles = PRIORITY_STYLES[opp.priority];
        const Icon = RULE_ICONS[opp.rule] || Zap;
        const isDismissing = dismissing.has(opp.id);
        return (
          <div
            key={opp.id}
            className={`flex items-center gap-3 bg-gray-800/40 border border-gray-700/50 border-l-2 ${styles.border} rounded-xl px-4 py-3 transition-opacity ${isDismissing ? 'opacity-40' : ''}`}
          >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.badge}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-white truncate">{opp.title}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${styles.badge}`}>
                  {opp.priority}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{opp.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => navigate(opp.actionUrl)}
                className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                title="Go to action"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => dismiss(opp)}
                disabled={isDismissing}
                className="p-1.5 text-gray-600 hover:text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {compact && opportunities.length > 5 && (
        <p className="text-xs text-gray-500 text-center pt-1">
          +{opportunities.length - 5} more action items
        </p>
      )}

      <button
        onClick={load}
        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors mx-auto pt-1"
      >
        <RefreshCw className="w-3 h-3" />
        Refresh
      </button>
    </div>
  );
};

export default ActionList;
