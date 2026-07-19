'use client';

import { useEffect } from 'react';

export type CheatSheetSection = {
  title: string;
  points: string[];
};

function looksLikeMediaUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith('/');
}

function displayHost(url: string): string {
  try {
    if (url.startsWith('/')) return url;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 48);
  }
}

/** Shared playbook brief overlay — review before calling (Practice + Cold Call). */
export default function CheatSheetPanel({
  open,
  onClose,
  sections,
  loading = false,
  productUrl,
  trainingImages,
  trainingVideoUrl,
}: {
  open: boolean;
  onClose: () => void;
  sections: CheatSheetSection[];
  loading?: boolean;
  productUrl?: string | null;
  trainingImages?: string[] | null;
  trainingVideoUrl?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const images = (trainingImages || []).filter(looksLikeMediaUrl).slice(0, 8);
  const hasProduct = Boolean(productUrl && looksLikeMediaUrl(productUrl));
  const hasVideo = Boolean(trainingVideoUrl && looksLikeMediaUrl(trainingVideoUrl));
  const hasMedia = hasProduct || images.length > 0 || hasVideo;
  const emptyBrief = !loading && sections.length === 0 && !hasMedia;

  return (
    <div className="cc-cheat-overlay" role="presentation" onClick={onClose}>
      <aside
        className="cc-cheat-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-cheat-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc-cheat-panel__head">
          <h2 id="cc-cheat-title">Playbook</h2>
          <button
            type="button"
            className="cc-cheat-panel__close"
            onClick={onClose}
            aria-label="Close playbook"
          >
            ×
          </button>
        </div>
        <div className="cc-cheat-panel__body">
          <p className="muted" style={{ margin: '0 0 1rem', fontSize: '0.88rem' }}>
            Review before you dial — product media, pitch, objections, and talk track for this call.
          </p>

          {hasMedia && (
            <div className="cc-cheat-section cc-cheat-media">
              <h3>Product</h3>
              {hasProduct && productUrl && (
                <p style={{ margin: '0 0 0.65rem' }}>
                  <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="soft-link"
                  >
                    Open product → {displayHost(productUrl)}
                  </a>
                </p>
              )}
              {images.length > 0 && (
                <div className="cc-cheat-gallery" role="list">
                  {images.map((src) => (
                    <a
                      key={src}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-cheat-gallery__item"
                      role="listitem"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="Product training" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              {hasVideo && trainingVideoUrl && (
                <div className="cc-cheat-video">
                  {/\.(mp4|webm|mov)(\?|$)/i.test(trainingVideoUrl) ||
                  trainingVideoUrl.startsWith('/') ? (
                    <video controls preload="metadata" src={trainingVideoUrl}>
                      <a href={trainingVideoUrl} target="_blank" rel="noopener noreferrer">
                        Open training video
                      </a>
                    </video>
                  ) : (
                    <p style={{ margin: '0.5rem 0 0' }}>
                      <a
                        href={trainingVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="soft-link"
                      >
                        Open training video →
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {loading && sections.length === 0 && !hasMedia ? (
            <p className="muted">Loading playbook…</p>
          ) : emptyBrief ? (
            <p className="muted">No playbook yet. Pick a playbook or lead and try again.</p>
          ) : (
            sections.map((sec) => (
              <div key={sec.title} className="cc-cheat-section">
                <h3>{sec.title}</h3>
                <ul>
                  {sec.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
