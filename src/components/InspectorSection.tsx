import { ChevronDown, ChevronRight } from 'lucide-react'

export type InspectorTab = 'quick' | 'advanced' | 'bindings' | 'preview'

const TAB_LABELS: Record<InspectorTab, string> = {
  quick: 'Quick',
  advanced: 'Advanced',
  bindings: 'Bindings',
  preview: 'Preview',
}

interface InspectorSectionProps {
  title: string
  icon?: React.ReactNode
  badge?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  children: React.ReactNode
  accentClass?: string
  /** Optional list of tabs to render inside the section body. */
  tabs?: InspectorTab[]
  /** Currently active tab (required when tabs is set). */
  activeTab?: InspectorTab
  /** Callback when tab changes (required when tabs is set). */
  onTabChange?: (tab: InspectorTab) => void
}

export function InspectorSection({
  title,
  icon,
  badge,
  collapsed,
  onToggleCollapsed,
  children,
  accentClass,
  tabs,
  activeTab,
  onTabChange,
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
        <>
          {tabs && tabs.length > 1 && (
            <div className="pb-inspector-tab-bar">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`pb-inspector-tab${activeTab === tab ? ' pb-inspector-tab-active' : ''}`}
                  onClick={() => onTabChange?.(tab)}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          )}
          <div className="pb-inspector-section-body">
            {children}
          </div>
        </>
      )}
    </div>
  )
}
