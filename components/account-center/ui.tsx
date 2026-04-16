import React from 'react'

const baseCardClass =
  'border border-[var(--border-primary)] bg-[var(--bg-primary)]'

export const cardClassName = baseCardClass

interface SectionCardProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  action,
  className = '',
  children
}) => {
  return (
    <section className={`${baseCardClass} p-6 ${className}`.trim()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-[var(--text-tertiary)] leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  valueClassName?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  valueClassName = ''
}) => {
  return (
    <div className="min-w-0 border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div
        className={`min-w-0 text-2xl font-light text-[var(--text-primary)] ${valueClassName}`.trim()}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono leading-relaxed">
          {hint}
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action
}) => {
  return (
    <div className="border border-dashed border-[var(--border-primary)] p-10 text-center text-[var(--text-muted)]">
      <div className="text-sm font-bold text-[var(--text-primary)]">
        {title}
      </div>
      <div className="mt-2 text-[10px] text-[var(--text-tertiary)] font-mono">
        {description}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
