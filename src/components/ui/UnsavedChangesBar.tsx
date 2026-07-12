'use client';

type UnsavedChangesBarProps = {
  dirty: boolean;
  saving?: boolean;
  saveDisabled?: boolean;
  onReset: () => void;
  onSave: () => void | Promise<void>;
  label?: string;
  saveLabel?: string;
  resetLabel?: string;
};

/** Clerk-style floating pill: appears at viewport bottom when the form is dirty. */
export default function UnsavedChangesBar({
  dirty,
  saving = false,
  saveDisabled = false,
  onReset,
  onSave,
  label = 'Unsaved changes',
  saveLabel = 'Save',
  resetLabel = 'Reset',
}: UnsavedChangesBarProps) {
  if (!dirty) return null;

  return (
    <div className="unsaved-bar" role="status" aria-live="polite">
      <div className="unsaved-bar__inner">
        <div className="unsaved-bar__label">
          <svg
            className="unsaved-bar__icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 4.5v5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.5" r="0.85" fill="currentColor" />
          </svg>
          <span>{label}</span>
        </div>
        <div className="unsaved-bar__actions">
          <button
            type="button"
            className="unsaved-bar__reset"
            onClick={onReset}
            disabled={saving}
          >
            {resetLabel}
          </button>
          <button
            type="button"
            className="unsaved-bar__save"
            onClick={() => void onSave()}
            disabled={saving || saveDisabled}
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
