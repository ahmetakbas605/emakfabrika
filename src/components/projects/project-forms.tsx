'use client';

import { useActionState } from 'react';
import {
  createProjectAction, createProjectTaskAction, completeProjectTaskAction, createMilestoneAction, completeMilestoneAction,
  createProgressPaymentAction, approveProgressPaymentAction, markProgressPaymentPaidAction, type FormState
} from '@/actions/projects';

export function CreateProjectForm({ users, departments }: { users: { id: string; fullName: string }[]; departments: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProjectAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Kod</label><input name="code" required style={{ padding: 6, width: 100 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç (ops.)</label><input name="startDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş (ops.)</label><input name="endDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bütçe (ops.)</label><input name="budgetAmount" type="number" step="0.01" style={{ padding: 6, width: 100 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Proje Yöneticisi (ops.)</label>
        <select name="managerUserId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Departman (ops.)</label>
        <select name="departmentId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Proje Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CreateProjectTaskForm({ projectId, tasks, users }: { projectId: string; tasks: { id: string; name: string }[]; users: { id: string; fullName: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProjectTaskAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="projectId" value={projectId} />
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Görev Adı</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Üst Görev (ops.)</label>
        <select name="parentTaskId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Atanan (ops.)</label>
        <select name="assignedToUserId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Seçin</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Başlangıç (ops.)</label><input name="startDate" type="date" style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Bitiş Tarihi (ops.)</label><input name="dueDate" type="date" style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Görev Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CompleteProjectTaskButton({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(completeProjectTaskAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="projectId" value={projectId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Tamamla'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateMilestoneForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createMilestoneAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="projectId" value={projectId} />
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Ad</label><input name="name" required style={{ padding: 6, width: 180 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Hedef Tarih</label><input name="targetDate" type="date" required style={{ padding: 6 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Milestone Ekle'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function CompleteMilestoneButton({ milestoneId, projectId }: { milestoneId: string; projectId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(completeMilestoneAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="projectId" value={projectId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Tamamla'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function CreateProgressPaymentForm({ projectId, milestones }: { projectId: string; milestones: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createProgressPaymentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#666' }}>Milestone (ops.)</label>
        <select name="milestoneId" style={{ padding: 6, minWidth: 140 }}>
          <option value="">Yok</option>
          {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Dönem Başlangıcı</label><input name="periodStart" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Dönem Bitişi</label><input name="periodEnd" type="date" required style={{ padding: 6 }} /></div>
      <div><label style={{ display: 'block', fontSize: 12, color: '#666' }}>Tutar</label><input name="amount" type="number" step="0.01" required style={{ padding: 6, width: 100 }} /></div>
      <button type="submit" disabled={pending} style={{ padding: '7px 14px', cursor: 'pointer' }}>{pending ? '...' : 'Hakediş Oluştur'}</button>
      {state?.error ? <p style={{ color: '#b00', fontSize: 13, width: '100%' }}>{state.error}</p> : null}
      {state?.success ? <p style={{ color: '#080', fontSize: 13, width: '100%' }}>{state.success}</p> : null}
    </form>
  );
}

export function ApproveProgressPaymentButton({ paymentId, projectId }: { paymentId: string; projectId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(approveProgressPaymentAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-block' }}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="projectId" value={projectId} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Onayla'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}

export function MarkProgressPaymentPaidForm({ paymentId, projectId }: { paymentId: string; projectId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(markProgressPaymentPaidAction, undefined);
  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input name="paymentDate" type="date" required style={{ padding: 4, fontSize: 12, width: 130 }} />
      <button type="submit" disabled={pending} style={{ padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}>{pending ? '...' : 'Ödendi İşaretle'}</button>
      {state?.error ? <span style={{ color: '#b00', fontSize: 11, marginLeft: 4 }}>{state.error}</span> : null}
    </form>
  );
}
