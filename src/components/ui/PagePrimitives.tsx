import type { ReactNode } from 'react';
import Link from 'next/link';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  compact = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  /** Tighter title block for viewport-fit desks (Trainer / Cold Call). */
  compact?: boolean;
}) {
  return (
    <header className={`page-header${compact ? ' page-header--compact' : ''}`}>
      <div className="page-header__copy">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  compact = false,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tighter padding/head for viewport-fit desks. */
  compact?: boolean;
}) {
  return (
    <section className={`panel${compact ? ' panel--compact' : ''} ${className}`.trim()}>
      {(title || actions) && (
        <div className="panel__head">
          <div>
            {title ? <h2 className="panel__title">{title}</h2> : null}
            {description ? <p className="panel__desc">{description}</p> : null}
          </div>
          {actions ? <div className="panel__actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'good' | 'warn' | 'bad' | 'accent';
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__desc">{description}</p> : null}
      {action}
    </div>
  );
}

export function SoftLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="soft-link">
      {children}
    </Link>
  );
}
