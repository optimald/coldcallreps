import type { ReactNode } from 'react';
import Link from 'next/link';

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  leading,
  compact = false,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  /** Optional mark (e.g. brand logo) beside the title block. */
  leading?: ReactNode;
  /** Tighter title block for viewport-fit desks (Trainer / Cold Call). */
  compact?: boolean;
}) {
  return (
    <header className={`page-header${compact ? ' page-header--compact' : ''}`}>
      <div className="page-header__main">
        {leading ? <div className="page-header__leading">{leading}</div> : null}
        <div className="page-header__copy">
          {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
          <h1 className="page-title">{title}</h1>
          {description ? <div className="page-desc">{description}</div> : null}
        </div>
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
      {(title || description || actions) && (
        <div className="panel__head">
          <div>
            {title ? <h2 className="panel__title">{title}</h2> : null}
            {description ? <div className="panel__desc">{description}</div> : null}
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
