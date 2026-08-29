'use client';

import { useActionState } from 'react';
import { addProductBarcodeAction, addProductSupplierAction, type FormState } from '@/actions/master-data';

export function ProductBarcodeForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addProductBarcodeAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input type="hidden" name="productId" value={productId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Barkod</label>
        <input name="barcode" required style={{ padding: 6, width: 160 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tür</label>
        <select name="barcodeType" style={{ padding: 6 }}>
          <option value="EAN13">EAN13</option>
          <option value="EAN8">EAN8</option>
          <option value="UPC">UPC</option>
          <option value="CODE128">CODE128</option>
          <option value="CUSTOM">Özel</option>
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Barkod Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12 }}>{state.error}</span> : null}
    </form>
  );
}

export function ProductSupplierForm({ productId, suppliers, currencies }: { productId: string; suppliers: { id: string; legalName: string }[]; currencies: { code: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addProductSupplierAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input type="hidden" name="productId" value={productId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tedarikçi</label>
        <select name="supplierPartyId" required style={{ padding: 6 }}>
          <option value="">Seçin</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tedarikçi SKU</label>
        <input name="supplierSku" style={{ padding: 6, width: 120 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Alış Fiyatı</label>
        <input name="purchasePrice" style={{ padding: 6, width: 100 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Para Birimi</label>
        <select name="currencyCode" style={{ padding: 6 }}>
          <option value="">—</option>
          {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Teslim Süresi (gün)</label>
        <input name="leadTimeDays" type="number" min="0" style={{ padding: 6, width: 80 }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Min. Sipariş Miktarı</label>
        <input name="minOrderQty" style={{ padding: 6, width: 100 }} />
      </div>
      <button type="submit" disabled={pending} style={{ padding: '6px 12px', cursor: 'pointer' }}>{pending ? '...' : 'Tedarikçi Ekle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 12, width: '100%' }}>{state.error}</span> : null}
    </form>
  );
}
