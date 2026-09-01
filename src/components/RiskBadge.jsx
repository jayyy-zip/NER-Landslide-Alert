import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * RiskBadge — single source of truth for all severity indicators.
 *
 * Usage:  <RiskBadge tier="severe" />
 * Tiers:  "normal" | "medium" | "high" | "severe"
 *
 * Rules (DESIGN_AND_CODE_RULES.md §1):
 *   status-* colours are ONLY used here — never on buttons or nav.
 *   The 175ms transition is applied via the `.risk-badge` CSS class.
 */

const TIER_CONFIG = {
  normal: {
    dot: 'bg-status-normal',
    text: 'text-status-normal',
    // WCAG AA: green-700 on white (≥4.5:1) — status-normal itself is
    // too light on white; we darken the label to #15803d for contrast.
    label: 'Normal',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-700',
    border: 'border-green-200',
    leftBar: 'bg-status-normal',
  },
  medium: {
    dot: 'bg-status-medium',
    // WCAG note: amber-500 on white fails AA (3.1:1). We use amber-800
    // (#92400E) on amber-50 to reach ≥4.5:1 — confirmed via APCA.
    label: 'Medium',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    border: 'border-amber-200',
    leftBar: 'bg-status-medium',
  },
  high: {
    dot: 'bg-status-high',
    label: 'High',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    border: 'border-orange-200',
    leftBar: 'bg-status-high',
  },
  severe: {
    dot: 'bg-status-severe',
    label: 'Severe',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    border: 'border-red-200',
    leftBar: 'bg-status-severe',
  },
}

/**
 * @param {{ tier: 'normal'|'medium'|'high'|'severe', className?: string }} props
 */
export function RiskBadge({ tier, className }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.normal

  return (
    <Badge
      variant="outline"
      className={cn(
        'risk-badge gap-1.5 rounded-full border font-medium',
        cfg.badgeBg,
        cfg.badgeText,
        cfg.border,
        tier === 'severe' && 'pulse-red',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}

/**
 * Dot-only variant — used in map markers and legend items.
 * @param {{ tier: 'normal'|'medium'|'high'|'severe', className?: string }} props
 */
export function RiskDot({ tier, className }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.normal
  return (
    <span
      className={cn(
        'risk-badge inline-block rounded-full ring-2 ring-white shadow-sm',
        cfg.dot,
        tier === 'severe' && 'pulse-red',
        className,
      )}
    />
  )
}

/** Left-border accent bar used on alert cards */
export function riskLeftBar(tier) {
  return TIER_CONFIG[tier]?.leftBar ?? TIER_CONFIG.normal.leftBar
}

export default RiskBadge
