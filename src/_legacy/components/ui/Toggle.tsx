'use client';

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  /** denser padding for dense UIs (trainer, filters) */
  compact?: boolean;
  /** borderless inline row */
  inline?: boolean;
};

/** Accessible switch control — replaces bare checkboxes in app settings. */
export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  compact = false,
  inline = false,
}: ToggleProps) {
  const inputId = id || `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <label
      className={[
        'ui-toggle',
        checked ? 'is-on' : '',
        disabled ? 'is-disabled' : '',
        compact ? 'ui-toggle--compact' : '',
        inline ? 'ui-toggle--inline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      htmlFor={inputId}
    >
      <span className="ui-toggle__copy">
        <span className="ui-toggle__label">{label}</span>
        {description ? <span className="ui-toggle__desc">{description}</span> : null}
      </span>
      <span className="ui-toggle__control">
        <input
          id={inputId}
          type="checkbox"
          className="ui-toggle__input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="ui-toggle__track" aria-hidden>
          <span className="ui-toggle__thumb" />
        </span>
      </span>
    </label>
  );
}
