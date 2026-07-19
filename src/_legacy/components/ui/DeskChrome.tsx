'use client';

import type { ReactNode } from 'react';

/** Shared Cards|Board / Table control for desk pages. */
export function DeskViewToggle({
  value,
  onChange,
  options,
  label = 'View mode',
}: {
  value: string;
  onChange: (next: string) => void;
  options: { id: string; label: string }[];
  label?: string;
}) {
  return (
    <div className="desk-view-toggle" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? 'is-active' : undefined}
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Search + filter row inside a Panel. */
export function DeskToolbar({ children }: { children: ReactNode }) {
  return <div className="desk-toolbar">{children}</div>;
}

export function DeskToolbarSearch({
  value,
  onChange,
  placeholder,
  label = 'Filter',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <label className="desk-toolbar__search">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function DeskToolbarSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="desk-toolbar__select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {children}
      </select>
    </label>
  );
}
