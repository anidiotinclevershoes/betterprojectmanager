/**
 * Production Capture V2 Apply persist hooks.
 * Phase 3B still decides the operation; these hooks write durable rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmResponsibilityOwner } from "@/lib/people/identity";
import {
  persistEnsureStakeholder,
  persistFindCaptureApplyReceipt,
  persistKnowledgeBullet,
  persistMemory,
  persistPersonResponsibilityBundle,
  persistRiskStatus,
  persistTimelineItem,
  persistTimelineItemWithReceipt,
  persistTimelineUpdate,
  persistTodoCreate,
  persistTodoCreateWithReceipt,
  persistTodoDelete,
  persistTodoUpdate,
} from "@/lib/data/supabase/persist-mutations";
import type { MissionState } from "@/lib/types";
import type { CaptureApplyHooks } from "./execute";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newId(): string {
  return crypto.randomUUID();
}

export function supabaseCaptureApplyHooks(args: {
  client: SupabaseClient;
  workspaceId: string;
  userId: string | null;
  state: MissionState;
}): CaptureApplyHooks {
  const { client, workspaceId, userId } = args;
  const box = { state: args.state };

  return {
    createTodo: async (op) => {
      if (op.applyOperationId) {
        const existing = await persistFindCaptureApplyReceipt(
          client,
          workspaceId,
          op.projectId,
          op.applyOperationId,
        );
        if (existing) return;
        await persistTodoCreateWithReceipt(
          client,
          workspaceId,
          userId,
          {
            projectId: op.projectId,
            title: op.title,
            detail: op.detail,
            done: false,
            dueAt: op.dueAt,
            kind: op.todoKind,
            waitingOn: op.waitingOn,
          },
          {
            operationId: op.applyOperationId,
            entityType: "todo",
            entityId: "",
          },
        );
        return;
      }
      await persistTodoCreate(client, workspaceId, userId, {
        projectId: op.projectId,
        title: op.title,
        detail: op.detail,
        done: false,
        dueAt: op.dueAt,
        kind: op.todoKind,
        waitingOn: op.waitingOn,
      });
    },
    updateTodo: async (op) => {
      await persistTodoUpdate(client, workspaceId, op.projectId, op.todoId, {
        title: op.title,
        detail: op.detail ?? undefined,
        dueAt: op.dueAt ?? undefined,
      });
    },
    completeTodo: async (op) => {
      await persistTodoUpdate(client, workspaceId, op.projectId, op.todoId, {
        done: true,
      });
    },
    deleteTodo: async (op) => {
      await persistTodoDelete(client, workspaceId, op.projectId, op.todoId);
    },
    createRisk: async (op) => {
      if (op.applyOperationId) {
        const existing = await persistFindCaptureApplyReceipt(
          client,
          workspaceId,
          op.projectId,
          op.applyOperationId,
        );
        if (existing) return;
      }
      const riskId = newId();
      await persistKnowledgeBullet(
        client,
        workspaceId,
        op.projectId,
        "risks",
        op.title,
        userId,
        {
          riskId,
          receipt: op.applyOperationId
            ? {
                operationId: op.applyOperationId,
                entityType: "risk",
                entityId: riskId,
              }
            : null,
        },
      );
    },
    updateRiskStatus: async (op) => {
      await persistRiskStatus(
        client,
        workspaceId,
        op.projectId,
        op.riskId,
        op.status,
      );
    },
    createMilestone: async (op) => {
      if (!op.startAt) {
        throw new Error("This date cannot be saved — the date is missing.");
      }
      if (op.applyOperationId) {
        const existing = await persistFindCaptureApplyReceipt(
          client,
          workspaceId,
          op.projectId,
          op.applyOperationId,
        );
        if (existing) return;
        await persistTimelineItemWithReceipt(
          client,
          workspaceId,
          op.projectId,
          {
            label: op.label,
            type: "milestone",
            startAt: op.startAt,
            endAt: op.endAt,
            notes: op.notes,
            source: "capture",
          },
          {
            operationId: op.applyOperationId,
            entityType: "milestone",
            entityId: "",
          },
        );
        return;
      }
      await persistTimelineItem(client, workspaceId, op.projectId, {
        label: op.label,
        type: "milestone",
        startAt: op.startAt,
        endAt: op.endAt,
        notes: op.notes,
        source: "capture",
      });
    },
    updateMilestone: async (op) => {
      await persistTimelineUpdate(
        client,
        workspaceId,
        op.projectId,
        op.milestoneId,
        {
          label: op.label,
          startAt: op.startAt,
          endAt: op.endAt,
          notes: op.notes,
        },
      );
    },
    ensurePerson: async (op) => {
      await persistEnsureStakeholder(client, workspaceId, op.projectId, {
        id: op.personId && UUID_RE.test(op.personId) ? op.personId : newId(),
        name: op.name,
        role: op.roleHint,
      });
    },
    confirmResponsibility: async (op) => {
      const result = confirmResponsibilityOwner({
        state: box.state,
        projectId: op.projectId,
        scope: op.scope,
        personName: op.personName,
        personId: op.personId,
        replacePersonId: op.replacePersonId,
      });
      box.state = result.state;
      const uuidIds = result.supersededIds.filter((id) => UUID_RE.test(id));
      await persistPersonResponsibilityBundle(client, workspaceId, op.projectId, {
        stakeholder: {
          id: result.person.id,
          name: result.person.name,
          role: result.person.role,
        },
        supersedeIds: uuidIds,
        knowledge:
          result.responsibilityCreated && result.peopleBullet
            ? {
                id: result.item.id,
                section: "people",
                body: result.peopleBullet,
                createdBy: userId,
                kind: result.item.kind,
                epistemic: result.item.epistemic,
                lifecycle: result.item.lifecycle,
                supersedesId: result.item.supersedesId,
                meta: (result.item.meta as Record<string, unknown>) ?? {},
                provenance: result.item.provenance,
              }
            : null,
      });
    },
    writeAvailability: async (op) => {
      const fromDay = op.awayFromIso.slice(0, 10);
      const toDay = op.awayToIso.slice(0, 10);
      const body =
        fromDay === toDay
          ? `${op.personName} — away ${fromDay}`
          : `${op.personName} — away ${fromDay} to ${toDay}`;
      const id = newId();
      await persistKnowledgeBullet(
        client,
        workspaceId,
        op.projectId,
        "people",
        body,
        userId,
        {
          id,
          kind: "availability",
          epistemic: "confirmed",
          lifecycle: "current",
          meta: {
            personId: op.personId,
            availability: {
              personId: op.personId,
              personName: op.personName,
              awayFromIso: op.awayFromIso,
              awayToIso: op.awayToIso,
              label: op.label ?? null,
            },
          },
          provenance: [{ type: "capture", at: new Date().toISOString() }],
        },
      );
    },
    writeKnowledge: async (op) => {
      await persistKnowledgeBullet(
        client,
        workspaceId,
        op.projectId,
        op.section,
        op.text,
        userId,
      );
    },
    findApplyReceipt: async ({ projectId, operationId }) => {
      const existing = await persistFindCaptureApplyReceipt(
        client,
        workspaceId,
        projectId,
        operationId,
      );
      return existing
        ? { entityType: existing.entityType, entityId: existing.entityId }
        : null;
    },
    writeMemory: async (op) => {
      const now = new Date().toISOString();
      await persistMemory(client, workspaceId, userId, {
        type: "conversation",
        projectId: op.projectId,
        title: op.title,
        content: op.title,
        tags: [],
        people: [],
        occurredAt: now,
        createdAt: now,
        source: "capture",
      });
    },
  };
}
