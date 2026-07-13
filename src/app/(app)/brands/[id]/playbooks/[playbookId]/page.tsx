'use client';

import { useParams } from 'next/navigation';
import PlaybookEditorClient from '@/components/PlaybookEditorClient';

export default function BrandPlaybookEditorPage() {
  const params = useParams();
  const brandKey = String(params.id || '');
  const playbookId = String(params.playbookId || '');
  return <PlaybookEditorClient playbookId={playbookId} brandKey={brandKey} />;
}
