'use client';

import { useTransition } from 'react';
import { closePeriodAction, reopenPeriodAction } from '@/actions/accounting';

export function PeriodStatusButton({ departmentId, periodId, status }: { departmentId: string; periodId: string; status: 'OPEN' | 'CLOSED' }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (status === 'OPEN') {
        if (!confirm('Bu dönemi kapatmak istediğinize emin misiniz? Kapalı döneme yeni fiş işlenemez.')) return;
        await closePeriodAction(departmentId, periodId);
      } else {
        await reopenPeriodAction(departmentId, periodId);
      }
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
      {pending ? '...' : status === 'OPEN' ? 'Kapat' : 'Yeniden Aç'}
    </button>
  );
}
