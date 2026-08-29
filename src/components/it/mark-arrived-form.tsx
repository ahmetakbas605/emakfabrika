'use client';

import { useActionState, useState } from 'react';
import { markArrivedAction, type FormState } from '@/actions/it/field-service';

// FIELD-SERVICE.md §2 — TEK noktalık bir konum kaydı, yalnızca teknisyen
// bilinçli olarak "Vardım" butonuna bastığında (source=ARRIVAL_BUTTON).
// Sürekli takip burada YOK — o yalnızca it_policies açıkken ayrı bir akış.
export function MarkArrivedForm({ departmentId, workOrderId }: { departmentId: string; workOrderId: string }) {
  const action = markArrivedAction.bind(null, departmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  function captureLocation() {
    setLocating(true);
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError('Bu tarayıcı konum servisini desteklemiyor.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
        setLocating(false);
      },
      () => {
        setLocError('Konum alınamadı — tarayıcı izni gerekli.');
        setLocating(false);
      }
    );
  }

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="latitude" value={coords?.lat ?? ''} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ''} />
      <button type="button" onClick={captureLocation} disabled={locating} style={{ padding: '6px 12px', cursor: 'pointer' }}>{locating ? 'Konum alınıyor...' : 'Konumumu Al'}</button>
      {coords ? <span style={{ fontSize: 12, color: '#666' }}>{Number(coords.lat).toFixed(5)}, {Number(coords.lng).toFixed(5)}</span> : null}
      <button type="submit" disabled={pending || !coords} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Vardım'}</button>
      {locError ? <span style={{ color: '#b00', fontSize: 12 }}>{locError}</span> : null}
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}
