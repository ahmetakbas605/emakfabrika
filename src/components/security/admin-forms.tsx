'use client';

import { useActionState } from 'react';
import { resolveSecurityEventAction, createRetentionPolicyAction, createLegalHoldAction, releaseLegalHoldAction, createDsrAction, submitDsrAction, resolveDsrAction, upsertInventoryEntryAction, deleteInventoryEntryAction, createRoleConflictRuleAction, deactivateRoleConflictRuleAction, requestBreakGlassAction, approveBreakGlassAction, revokeBreakGlassAction, type FormState } from '@/actions/security-admin';
import { AuroraButton, AuroraInput, AuroraSelect, AuroraTextarea } from '@/components/shell/ui';

function FormMsg({ state }: { state: FormState }) {
  if (state?.error) return <p className="text-sm mt-2" style={{ color: 'var(--aurora-danger)' }}>{state.error}</p>;
  if (state?.success) return <p className="text-sm mt-2" style={{ color: 'var(--aurora-emerald)' }}>{state.success}</p>;
  return null;
}

// --- Güvenlik Olayları ---
export function ResolveEventButtons({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(resolveSecurityEventAction, undefined);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <button name="status" value="RESOLVED" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-emerald)' }}>Çözüldü</button>
      <button name="status" value="FALSE_POSITIVE" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-text-dim)' }}>Yanlış Alarm</button>
    </form>
  );
}

// --- Saklama Politikası ---
export function RetentionPolicyForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRetentionPolicyAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Veri Türü</label><AuroraInput name="dataType" required placeholder="Bordro Kaydı" className="w-40" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Yasal Dayanak</label><AuroraInput name="legalBasis" placeholder="VUK m.253" className="w-40" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Süre (yıl)</label><AuroraInput name="retentionYears" type="number" min={1} required className="w-24" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Başlangıç Olayı</label><AuroraInput name="startEvent" placeholder="İşten ayrılış" className="w-40" /></div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Silme Yöntemi</label>
        <AuroraSelect name="deleteMethod" required className="w-36">
          <option value="ANONYMIZE">Anonimleştir</option>
          <option value="HARD_DELETE">Tamamen Sil</option>
          <option value="ARCHIVE">Arşivle</option>
        </AuroraSelect>
      </div>
      <AuroraButton type="submit" disabled={pending}>{pending ? '...' : 'Politika Kaydet'}</AuroraButton>
      <FormMsg state={state} />
    </form>
  );
}

export function LegalHoldForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createLegalHoldAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Kayıt Türü</label><AuroraInput name="entityType" required placeholder="EMPLOYEE" className="w-36" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Kayıt ID</label><AuroraInput name="entityId" required className="w-64" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Gerekçe</label><AuroraInput name="reason" required placeholder="Dava kapsamında" className="w-60" /></div>
      <AuroraButton type="submit" disabled={pending}>{pending ? '...' : 'Legal Hold Ekle'}</AuroraButton>
      <FormMsg state={state} />
    </form>
  );
}

export function ReleaseLegalHoldButton({ legalHoldId }: { legalHoldId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(releaseLegalHoldAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="legalHoldId" value={legalHoldId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-danger)' }}>{pending ? '...' : 'Kaldır'}</button>
    </form>
  );
}

// --- KVKK Talepleri ---
export function CreateDsrForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createDsrAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Talep Türü</label>
        <AuroraSelect name="requestType" required className="w-40">
          <option value="ACCESS">Erişim</option><option value="CORRECTION">Düzeltme</option><option value="DELETION">Silme</option>
          <option value="RESTRICTION">Kısıtlama</option><option value="OBJECTION">İtiraz</option><option value="PORTABILITY">Taşınabilirlik</option><option value="OTHER">Diğer</option>
        </AuroraSelect>
      </div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Veri Sahibi</label><AuroraInput name="subjectName" required className="w-48" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Kimlik (ops.)</label><AuroraInput name="subjectIdentifier" className="w-32" /></div>
      <div className="w-full"><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Açıklama</label><AuroraTextarea name="description" required rows={2} className="w-full" /></div>
      <AuroraButton type="submit" disabled={pending}>{pending ? '...' : 'Taslak Oluştur'}</AuroraButton>
      <FormMsg state={state} />
    </form>
  );
}

export function SubmitDsrButton({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitDsrAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded mr-2" style={{ color: 'var(--aurora-cyan)' }}>{pending ? '...' : 'Gönder'}</button>
    </form>
  );
}

export function ResolveDsrForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(resolveDsrAction, undefined);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <AuroraInput name="note" placeholder="Sonuç notu" required className="w-48 text-xs py-1" />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-emerald)' }}>{pending ? '...' : 'Tamamla'}</button>
    </form>
  );
}

// --- Veri Sınıflandırma ---
export function InventoryForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(upsertInventoryEntryAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Tablo</label><AuroraInput name="tableName" required placeholder="employees" className="w-32" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Kolon</label><AuroraInput name="columnName" required placeholder="identity_reference" className="w-40" /></div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Sınıflandırma</label>
        <AuroraSelect name="classification" required className="w-44">
          <option value="PUBLIC">PUBLIC</option><option value="INTERNAL">INTERNAL</option><option value="CONFIDENTIAL">CONFIDENTIAL</option>
          <option value="PERSONAL">PERSONAL</option><option value="SPECIAL_CATEGORY">SPECIAL_CATEGORY</option><option value="FINANCIAL">FINANCIAL</option>
          <option value="HIGHLY_CONFIDENTIAL">HIGHLY_CONFIDENTIAL</option><option value="SYSTEM_SECURITY">SYSTEM_SECURITY</option>
        </AuroraSelect>
      </div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Amaç</label><AuroraInput name="purpose" className="w-40" /></div>
      <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--aurora-text-dim)' }}><input type="checkbox" name="maskingRequired" /> Maskeleme gerekli</label>
      <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--aurora-text-dim)' }}><input type="checkbox" name="encryptionRequired" /> Şifreleme gerekli</label>
      <AuroraButton type="submit" disabled={pending}>{pending ? '...' : 'Kaydet'}</AuroraButton>
      <FormMsg state={state} />
    </form>
  );
}

export function DeleteInventoryButton({ entryId }: { entryId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(deleteInventoryEntryAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="entryId" value={entryId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-danger)' }}>{pending ? '...' : 'Sil'}</button>
    </form>
  );
}

// --- Görevler Ayrılığı ---
export function SodForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createRoleConflictRuleAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Belge Türü</label><AuroraInput name="documentType" required placeholder="BONUS" className="w-36" /></div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Kural</label>
        <AuroraSelect name="rule" required className="w-56"><option value="CREATOR_CANNOT_APPROVE">Oluşturan Onaylayamaz</option></AuroraSelect>
      </div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Açıklama</label><AuroraInput name="description" className="w-56" /></div>
      <AuroraButton type="submit" disabled={pending}>{pending ? '...' : 'Kural Ekle'}</AuroraButton>
      <FormMsg state={state} />
    </form>
  );
}

export function DeactivateSodButton({ ruleId }: { ruleId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(deactivateRoleConflictRuleAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="ruleId" value={ruleId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-danger)' }}>{pending ? '...' : 'Devre Dışı Bırak'}</button>
    </form>
  );
}

// --- Break-Glass ---
export function BreakGlassForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestBreakGlassAction, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Gerekçe</label><AuroraInput name="reason" required placeholder="Destek talebi #1234" className="w-56" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Ticket Referansı</label><AuroraInput name="ticketReference" className="w-36" /></div>
      <div><label className="block text-xs mb-1" style={{ color: 'var(--aurora-text-dim)' }}>Kapsam</label><AuroraInput name="scope" placeholder="Çalışan bordro kaydı" className="w-48" /></div>
      <AuroraButton type="submit" disabled={pending}>{pending ? '...' : 'Erişim Talep Et'}</AuroraButton>
      <FormMsg state={state} />
    </form>
  );
}

export function ApproveBreakGlassForm({ accessId }: { accessId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(approveBreakGlassAction, undefined);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="accessId" value={accessId} />
      <AuroraInput name="durationHours" type="number" min={1} defaultValue={4} className="w-16 text-xs py-1" />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-emerald)' }}>{pending ? '...' : 'Onayla (saat)'}</button>
    </form>
  );
}

export function RevokeBreakGlassButton({ accessId }: { accessId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(revokeBreakGlassAction, undefined);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="accessId" value={accessId} />
      <button type="submit" disabled={pending} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--aurora-danger)' }}>{pending ? '...' : 'İptal Et'}</button>
    </form>
  );
}
