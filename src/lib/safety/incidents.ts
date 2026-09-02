import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { safetyIncidents, employees } from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { publishEventInTx, dispatchEvent } from '@/lib/integration/events';
import '@/lib/integration/subscribers';
import { SafetyError } from './errors';

// Faz 9'un risk_register_entries'inden (POTANSİYEL risk) BİLİNÇLİ OLARAK
// AYRI — bu, GERÇEKLEŞMİŞ bir olayın kaydı (schema.ts'in kendi yorumu).

export interface CreateIncidentInput {
  incidentType: (typeof safetyIncidents.$inferInsert)['incidentType'];
  severity?: (typeof safetyIncidents.$inferInsert)['severity'];
  incidentDate: string;
  location?: string;
  employeeId?: string;
  description: string;
}

export async function createIncident(companyId: string, createdByUserId: string, input: CreateIncidentInput): Promise<string> {
  if (input.employeeId) {
    const [employee] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.employeeId), eq(employees.companyId, companyId))).limit(1);
    if (!employee) throw new SafetyError('Çalışan bulunamadı.');
  }

  const severity = input.severity ?? 'MINOR';
  const id = await db.transaction(async (tx) => {
    const id = newId();
    const incidentNo = await nextDocumentNo(tx, companyId, 'SFTY', 'OLY', new Date().getFullYear(), 6);
    await tx.insert(safetyIncidents).values({
      id, companyId, incidentNo, incidentType: input.incidentType, severity, incidentDate: input.incidentDate,
      location: input.location ?? '', employeeId: input.employeeId, description: input.description, createdByUserId
    });
    await publishEventInTx(tx, companyId, { eventType: 'SAFETY_INCIDENT_CREATED', sourceModule: 'SAFETY', entityId: id, payload: { severity, incidentType: input.incidentType } });
    return id;
  });
  await dispatchEvent(companyId, 'SAFETY_INCIDENT_CREATED', id, { severity, incidentType: input.incidentType });
  return id;
}

export async function listIncidents(companyId: string) {
  return db
    .select({
      id: safetyIncidents.id, incidentNo: safetyIncidents.incidentNo, incidentType: safetyIncidents.incidentType, severity: safetyIncidents.severity,
      incidentDate: safetyIncidents.incidentDate, location: safetyIncidents.location, employeeName: employees.firstName, employeeLastName: employees.lastName,
      status: safetyIncidents.status
    })
    .from(safetyIncidents)
    .leftJoin(employees, eq(employees.id, safetyIncidents.employeeId))
    .where(eq(safetyIncidents.companyId, companyId))
    .orderBy(desc(safetyIncidents.incidentDate));
}

async function getIncident(companyId: string, incidentId: string) {
  const [row] = await db.select().from(safetyIncidents).where(and(eq(safetyIncidents.id, incidentId), eq(safetyIncidents.companyId, companyId))).limit(1);
  if (!row) throw new SafetyError('Olay kaydı bulunamadı.');
  return row;
}

export async function startIncidentInvestigation(companyId: string, incidentId: string): Promise<void> {
  const incident = await getIncident(companyId, incidentId);
  if (incident.status !== 'OPEN') throw new SafetyError('Yalnızca açık (OPEN) bir olay soruşturmaya alınabilir.');
  await db.update(safetyIncidents).set({ status: 'INVESTIGATING' }).where(eq(safetyIncidents.id, incidentId));
}

export interface CloseIncidentInput {
  rootCause: string;
  correctiveAction: string;
}

export async function closeIncident(companyId: string, incidentId: string, input: CloseIncidentInput): Promise<void> {
  const incident = await getIncident(companyId, incidentId);
  if (incident.status !== 'INVESTIGATING') throw new SafetyError('Yalnızca soruşturulan (INVESTIGATING) bir olay kapatılabilir.');
  await db.update(safetyIncidents).set({ status: 'CLOSED', rootCause: input.rootCause, correctiveAction: input.correctiveAction, closedAt: new Date() }).where(eq(safetyIncidents.id, incidentId));
}
