import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, procRequests } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createUnit } from '../src/lib/master-data/units';
import { createProject, getProject, listProjects, createProjectTask, listProjectTasks, completeProjectTask, createMilestone, listMilestones, completeMilestone } from '../src/lib/projects/projects';
import { createProgressPayment, listProgressPayments, approveProgressPayment, markProgressPaymentPaid } from '../src/lib/projects/progress-payments';
import { getProjectBudgetStatus } from '../src/lib/projects/budget';
import { createProcRequest } from '../src/lib/procurement/requisition';
import { ProjectError } from '../src/lib/projects/errors';

// Holding ERP Faz 8 (Proje Yönetimi) — Diğer kalıcı test paketleriyle AYNI
// disiplin: gerçek MySQL'e karşı, mock YOK. npm run test:projects. Bu
// testin odağı: getProjectBudgetStatus'ün (budgetAmount − Satın Alma
// taahhütleri − ödenmiş hakedişler) TAM doğru hesaplandığı, DRAFT bir
// satın alma talebinin ve henüz ÖDENMEMİŞ bir hakedişin hesaba
// KATILMADIĞI kanıtlanıyor.

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

async function main() {
  const companyId = newId();
  const userId = newId();

  await db.insert(companies).values({ id: companyId, name: 'PROJECTS TEST A.Ş.', taxId: '9999999995', taxOffice: 'Test V.D.' });
  await db.insert(users).values([{ id: userId, companyId, fullName: 'Proje Yöneticisi', email: `test-${Date.now()}-pm@projects.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }]);

  try {
    console.log('--- Proje + Görev (üst-alt hiyerarşi) + Milestone ---');
    const projectId = await createProject(companyId, userId, { code: 'PRJ-001', name: 'Test Projesi', budgetAmount: 100000, startDate: '2026-01-01' });
    const project = await getProject(companyId, projectId);
    check('proje doğru bütçeyle oluşturuldu (100000)', Number(project.budgetAmount) === 100000);

    const parentTaskId = await createProjectTask(companyId, projectId, { name: 'Ana Görev' });
    const childTaskId = await createProjectTask(companyId, projectId, { name: 'Alt Görev', parentTaskId });
    const tasks = await listProjectTasks(companyId, projectId);
    check('2 görev oluşturuldu (üst-alt)', tasks.length === 2 && tasks.find((t) => t.id === childTaskId)?.parentTaskId === parentTaskId);

    await completeProjectTask(companyId, childTaskId);
    let doubleCompleteRejected = false;
    try {
      await completeProjectTask(companyId, childTaskId);
    } catch (err) {
      doubleCompleteRejected = err instanceof ProjectError;
    }
    check('zaten tamamlanmış bir görev TEKRAR tamamlanamadı', doubleCompleteRejected);

    const milestoneId = await createMilestone(companyId, projectId, { name: 'Faz 1 Teslim', targetDate: '2026-03-01' });
    await completeMilestone(companyId, milestoneId);
    const milestones = await listMilestones(companyId, projectId);
    check('milestone tamamlandı', milestones[0].status === 'COMPLETED');
    let milestoneReCompleteRejected = false;
    try {
      await completeMilestone(companyId, milestoneId);
    } catch (err) {
      milestoneReCompleteRejected = err instanceof ProjectError;
    }
    check('zaten tamamlanmış bir milestone TEKRAR tamamlanamadı', milestoneReCompleteRejected);

    console.log('--- Hakediş: DRAFT → APPROVED → PAID (sırasız atlama reddi dahil) ---');
    const paidPaymentId = await createProgressPayment(companyId, userId, { projectId, periodStart: '2026-01-01', periodEnd: '2026-01-31', amount: 10000 });
    let payBeforeApproveRejected = false;
    try {
      await markProgressPaymentPaid(companyId, paidPaymentId, { paymentDate: '2026-02-01' });
    } catch (err) {
      payBeforeApproveRejected = err instanceof ProjectError;
    }
    check('APPROVED olmadan ödendi işaretlenemedi', payBeforeApproveRejected);

    await approveProgressPayment(companyId, paidPaymentId);
    await markProgressPaymentPaid(companyId, paidPaymentId, { paymentDate: '2026-02-01' });

    const draftPaymentId = await createProgressPayment(companyId, userId, { projectId, periodStart: '2026-02-01', periodEnd: '2026-02-28', amount: 5000 });
    // draftPaymentId BİLİNÇLİ OLARAK DRAFT bırakıldı — bütçe hesabına
    // KATILMAMASI gerektiğini kanıtlamak için.

    let invalidPeriodRejected = false;
    try {
      await createProgressPayment(companyId, userId, { projectId, periodStart: '2026-03-15', periodEnd: '2026-03-01', amount: 100 });
    } catch (err) {
      invalidPeriodRejected = err instanceof ProjectError;
    }
    check('dönem bitişi başlangıçtan önce olan hakediş reddedildi', invalidPeriodRejected);

    const otherProjectId = await createProject(companyId, userId, { code: 'PRJ-002', name: 'Diğer Proje' });
    let wrongProjectMilestoneRejected = false;
    try {
      await createProgressPayment(companyId, userId, { projectId: otherProjectId, milestoneId, periodStart: '2026-01-01', periodEnd: '2026-01-31', amount: 100 });
    } catch (err) {
      wrongProjectMilestoneRejected = err instanceof ProjectError;
    }
    check('başka bir projenin milestone\'u ile hakediş oluşturulamadı', wrongProjectMilestoneRejected);

    const payments = await listProgressPayments(companyId, projectId);
    check('proje için 2 hakediş listelendi (1 PAID, 1 DRAFT)', payments.length === 2);

    console.log('--- Satın Alma\'nın proje-bazlı talebi (projectId opsiyonel entegrasyonu) ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const submittedRequestId = await createProcRequest(companyId, userId, {
      projectId, lines: [{ description: 'Proje malzemesi', quantity: 10, unitId, estimatedUnitPrice: 2000 }]
    });
    // Test fixture — gerçek submit akışı workflow'a bağlı, burada yalnızca
    // budget.ts'in "DRAFT hariç" filtresini doğrulamak için durum doğrudan
    // ayarlandı (mes.test.ts'nin kontrollü zaman damgası deseniyle AYNI mantık).
    await db.update(procRequests).set({ status: 'SUBMITTED' }).where(eq(procRequests.id, submittedRequestId));

    const draftRequestId = await createProcRequest(companyId, userId, {
      projectId, lines: [{ description: 'Henüz gönderilmemiş talep', quantity: 1, unitId, estimatedUnitPrice: 99999 }]
    });
    check('draft talep gerçekten DRAFT durumunda kaldı', (await db.select({ status: procRequests.status }).from(procRequests).where(eq(procRequests.id, draftRequestId)))[0].status === 'DRAFT');

    console.log('--- Proje Bütçe Durumu (talep üzerine hesaplanan rapor) ---');
    const budgetStatus = await getProjectBudgetStatus(companyId, projectId);
    check(`taahhüt edilen tutar doğru (yalnızca SUBMITTED talep: 10×2000=20000, DRAFT HARİÇ): ${budgetStatus.committedAmount}`, budgetStatus.committedAmount === 20000);
    check(`ödenen hakediş doğru (yalnızca PAID: 10000, DRAFT hakediş HARİÇ): ${budgetStatus.paidAmount}`, budgetStatus.paidAmount === 10000);
    check(`kalan bütçe TAM doğru (100000-20000-10000=70000): ${budgetStatus.remainingBudget}`, budgetStatus.remainingBudget === 70000);

    const otherProjectBudget = await getProjectBudgetStatus(companyId, otherProjectId);
    check('bütçesi tanımsız projede budgetAmount/remainingBudget dürüstçe null', otherProjectBudget.budgetAmount === null && otherProjectBudget.remainingBudget === null);

    const allProjects = await listProjects(companyId);
    check('2 proje listelendi', allProjects.length === 2);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // proc_request_lines'ın KENDİ company_id kolonu yok (yalnızca requestId
    // FK, onDelete:'cascade') — proc_requests silinince otomatik gider.
    // project_tasks KENDİ tablosuna self-referans veriyor (parentTaskId,
    // cascade YOK) — mrp_planned_orders.parent_id'de (Faz 3) karşılaşılan
    // AYNI gerçek sorun: tek bir DELETE, satırlar arası sırayı garanti
    // etmez. Önce self-referansı NULL'a çekmek (leaf-first silme yerine
    // daha basit bir çözüm, bu testte yalnızca 1 seviye derinlik olduğu
    // için yeterli) kısıtı güvenle devre dışı bırakır.
    await cleanupConn.query(`UPDATE project_tasks SET parent_task_id = NULL WHERE company_id = ?`, [companyId]);
    const dependentFirst = ['proj_progress_payments', 'proc_requests', 'project_tasks', 'project_milestones', 'projects'];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]);
    }
    await cleanupConn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
