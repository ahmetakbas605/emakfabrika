'use client';

import { useTransition, useState } from 'react';
import { runDepreciationAction } from '@/actions/fixed-assets';

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function RunDepreciationButton({ departmentId, fixedAssetId }: { departmentId: string; fixedAssetId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const formData = new FormData();
    formData.set('fixedAssetId', fixedAssetId);
    formData.set('periodDate', currentMonthIso());
    startTransition(async () => {
      const result = await runDepreciationAction(departmentId, undefined, formData);
      setError(result?.error ?? null);
    });
  }

  return (
    <span>
      <button type="button" onClick={handleClick} disabled={pending} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
        {pending ? '...' : 'Bu Ayın Amortismanını İşle'}
      </button>
      {error ? <span style={{ color: 'var(--dim-danger)', fontSize: 11, marginLeft: 6 }}>{error}</span> : null}
    </span>
  );
}
