'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PlaybookEditorClient, {
  parseDemoPlaybookId,
} from '@/components/PlaybookEditorClient';
import { brandHref } from '@/lib/brand-context';
import { isDemoEntityId } from '@/lib/demo/brand-demo-data';

/**
 * Legacy /playbooks/[id] — redirect brand/demo playbooks to
 * /brands/[brand]/playbooks/[id]. Personal playbooks stay here.
 */
export default function LegacyPlaybookEditorRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');

  useEffect(() => {
    if (!id) return;
    const demo = parseDemoPlaybookId(id);
    if (demo) {
      router.replace(brandHref(demo.brandKey, 'playbooks', id));
      return;
    }
    if (isDemoEntityId(id)) return;
    let cancelled = false;
    fetch(`/api/playbooks/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.playbook?.brand) return;
        const brand = d.playbook.brand as { id?: string; slug?: string | null };
        const key = brand.slug || brand.id || d.playbook.brandId;
        if (key) router.replace(brandHref(String(key), 'playbooks', id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const demo = parseDemoPlaybookId(id);
  if (demo) {
    return (
      <main className="app-page">
        <p className="muted">Opening brand playbook…</p>
      </main>
    );
  }

  return <PlaybookEditorClient playbookId={id} />;
}
