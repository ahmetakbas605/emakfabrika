import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { projects, projectTasks, projectMilestones, users, departments } from '@/db/schema';
import { newId } from '@/lib/id';
import { toDb } from '@/lib/money';
import { ProjectError } from './errors';

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  managerUserId?: string;
  departmentId?: string;
}

export async function createProject(companyId: string, createdByUserId: string, input: CreateProjectInput): Promise<string> {
  const id = newId();
  await db.insert(projects).values({
    id, companyId, code: input.code, name: input.name, description: input.description, startDate: input.startDate, endDate: input.endDate,
    budgetAmount: input.budgetAmount === undefined ? undefined : toDb(input.budgetAmount), managerUserId: input.managerUserId, departmentId: input.departmentId, createdByUserId
  });
  return id;
}

export async function listProjects(companyId: string) {
  return db
    .select({
      id: projects.id, code: projects.code, name: projects.name, status: projects.status, startDate: projects.startDate, endDate: projects.endDate,
      budgetAmount: projects.budgetAmount, managerName: users.fullName, departmentName: departments.name
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.managerUserId))
    .leftJoin(departments, eq(departments.id, projects.departmentId))
    .where(eq(projects.companyId, companyId))
    .orderBy(desc(projects.createdAt));
}

export async function getProject(companyId: string, projectId: string) {
  const [row] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, companyId))).limit(1);
  if (!row) throw new ProjectError('Proje bulunamadı.');
  return row;
}

export async function updateProjectStatus(companyId: string, projectId: string, status: (typeof projects.$inferInsert)['status']): Promise<void> {
  await getProject(companyId, projectId);
  await db.update(projects).set({ status }).where(eq(projects.id, projectId));
}

export interface CreateProjectTaskInput {
  name: string;
  parentTaskId?: string;
  assignedToUserId?: string;
  startDate?: string;
  dueDate?: string;
}

export async function createProjectTask(companyId: string, projectId: string, input: CreateProjectTaskInput): Promise<string> {
  await getProject(companyId, projectId);
  const id = newId();
  await db.insert(projectTasks).values({
    id, companyId, projectId, parentTaskId: input.parentTaskId, name: input.name, assignedToUserId: input.assignedToUserId, startDate: input.startDate, dueDate: input.dueDate
  });
  return id;
}

export async function listProjectTasks(companyId: string, projectId: string) {
  return db
    .select({
      id: projectTasks.id, name: projectTasks.name, parentTaskId: projectTasks.parentTaskId, status: projectTasks.status,
      assignedToName: users.fullName, startDate: projectTasks.startDate, dueDate: projectTasks.dueDate, completedAt: projectTasks.completedAt
    })
    .from(projectTasks)
    .leftJoin(users, eq(users.id, projectTasks.assignedToUserId))
    .where(and(eq(projectTasks.companyId, companyId), eq(projectTasks.projectId, projectId)))
    .orderBy(projectTasks.createdAt);
}

export async function completeProjectTask(companyId: string, taskId: string): Promise<void> {
  const [task] = await db.select().from(projectTasks).where(and(eq(projectTasks.id, taskId), eq(projectTasks.companyId, companyId))).limit(1);
  if (!task) throw new ProjectError('Görev bulunamadı.');
  if (task.status === 'DONE' || task.status === 'CANCELLED') throw new ProjectError('Bu görev zaten sonuçlanmış.');
  await db.update(projectTasks).set({ status: 'DONE', completedAt: new Date() }).where(eq(projectTasks.id, taskId));
}

export interface CreateMilestoneInput {
  name: string;
  targetDate: string;
}

export async function createMilestone(companyId: string, projectId: string, input: CreateMilestoneInput): Promise<string> {
  await getProject(companyId, projectId);
  const id = newId();
  await db.insert(projectMilestones).values({ id, companyId, projectId, name: input.name, targetDate: input.targetDate });
  return id;
}

export async function listMilestones(companyId: string, projectId: string) {
  return db.select().from(projectMilestones).where(and(eq(projectMilestones.companyId, companyId), eq(projectMilestones.projectId, projectId))).orderBy(projectMilestones.targetDate);
}

export async function completeMilestone(companyId: string, milestoneId: string): Promise<void> {
  const [milestone] = await db.select().from(projectMilestones).where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.companyId, companyId))).limit(1);
  if (!milestone) throw new ProjectError('Milestone bulunamadı.');
  if (milestone.status === 'COMPLETED') throw new ProjectError('Bu milestone zaten tamamlanmış.');
  await db.update(projectMilestones).set({ status: 'COMPLETED', completedAt: new Date() }).where(eq(projectMilestones.id, milestoneId));
}
