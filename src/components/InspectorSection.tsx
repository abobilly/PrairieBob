import { ChevronDown, ChevronRight } from 'lucide-react'

interface InspectorSectionProps {
  title: string
  icon?: React.ReactNode
  badge?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  children: React.ReactNode
  accentClass?: string
}

export function InspectorSection({
  title,
  icon,
  badge,
  collapsed,
  onToggleCollapsed,
  children,
  accentClass,
}: InspectorSectionProps) {
  return (
    <div className="pb-inspector-section shrink-0">
      <button
        className={`pb-inspector-section-header${accentClass ? ` ${accentClass}` : ''}`}
        onClick={onToggleCollapsed}
        title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        {icon && <span className="pb-inspector-section-icon">{icon}</span>}
        <span className="pb-inspector-section-title">{title}</span>
        {badge && (
          <span className="pb-inspector-section-badge">{badge}</span>
        )}
      </button>
      {!collapsed && (
        <div className="pb-inspector-section-body">
          {children}
        </div>
      )}
    </div>
  )
}
