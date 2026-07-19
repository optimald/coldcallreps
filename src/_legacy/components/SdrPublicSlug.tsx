'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { repPublicPath } from '@/lib/public-urls';

const DISPLAY_HOST = 'coldcallreps.com';

function profileAbsoluteUrl(path: string) {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `https://${DISPLAY_HOST}${path}`;
}

export default function SdrPublicSlug({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const path = repPublicPath(slug);
  const displayUrl = `${DISPLAY_HOST}${path}`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(profileAbsoluteUrl(path));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore — user can select manually */
    }
  }

  async function shareWithBrands() {
    const url = profileAbsoluteUrl(path);
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My ColdCallReps profile',
          text: 'Here’s my ColdCallReps profile — dial stats, verified goals, and resume.',
          url,
        });
        return;
      }
    } catch (err) {
      // User cancelled share sheet — don't fall through to copy.
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
    await copyUrl();
  }

  return (
    <span className="sdr-public-slug">
      <button
        type="button"
        className="sdr-public-slug__copy"
        onClick={() => void copyUrl()}
        aria-label={copied ? 'Copied profile URL' : 'Copy profile URL'}
        title={copied ? 'Copied' : 'Copy link'}
      >
        <span className="sdr-public-slug__url">{displayUrl}</span>
        {copied ? (
          <Check className="sdr-public-slug__icon" size={14} strokeWidth={2.25} aria-hidden />
        ) : (
          <Copy className="sdr-public-slug__icon" size={14} strokeWidth={2.25} aria-hidden />
        )}
        <span className="sdr-public-slug__copied" aria-live="polite">
          {copied ? 'Copied' : ''}
        </span>
      </button>
      <span className="sdr-public-slug__sep" aria-hidden>
        ·
      </span>
      <button
        type="button"
        className="sdr-public-slug__share"
        onClick={() => void shareWithBrands()}
      >
        Share this with brands
      </button>
    </span>
  );
}
