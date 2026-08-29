/**
 * Production Capture V2 Apply persist hooks.
 * Phase 3B still decides the operation; these hooks write durable rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { confirmResponsibilityOwner } from "@/lib/people/identity";
import {
  persistDeleteStakeholder,
  persistEnsureStakeholder,
  persistFindCaptureApplyReceipt,
  persistKnowledgeBullet,
  persistKnowledgeLifecycle,
  persistMemory,
  persistPutCaptureApplyReceipt,
  persistRiskStatus,
  persistTimelineItem,
  persistTimelineUpdate,
  persistTodoCreate,
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
      }
      const created = await persistTodoCreate(client, workspaceId, userId, {
        projectId: op.projectId,
        title: op.title,
        detail: op.detail,
        done: false,
        dueAt: op.dueAt,
        kind: op.todoKind,
        waitingOn: op.waitingOn,
      });
      if (op.applyOperationId) {
        await persistPutCaptureApplyReceipt(client, workspaceId, op.projectId, {
          operationId: op.applyOperationId,
          entityType: "todo",
          entityId: created.id,
        });
      }
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
      const written = await persistKnowledgeBullet(
        client,
        workspaceId,
        op.projectId,
        "risks",
        op.title,
        userId,
        { riskId },
      );
      if (op.applyOperationId) {
        await persistPutCaptureApplyReceipt(client, workspaceId, op.projectId, {
          operationId: op.applyOperationId,
          entityType: "risk",
          entityId: written.riskId ?? riskId,
        });
      }
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
      }
      const created = await persistTimelineItem(client, workspaceId, op.projectId, {
        label: op.label,
        type: "milestone",
        startAt: op.startAt,
        endAt: op.endAt,
        notes: op.notes,
        source: "capture",
      });
      if (op.applyOperationId) {
        await persistPutCaptureApplyReceipt(client, workspaceId, op.projectId, {
          operationId: op.applyOperationId,
          entityType: "milestone",
          entityId: created.id,
        });
      }
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
      let personPersistCreated = false;
      const uuidIds = result.supersededIds.filter((id) => UUID_RE.test(id));
      let supersededPersisted = false;
      try {
        const ensured = await persistEnsureStakeholder(
          client,
          workspaceId,
          op.projectId,
          {
            id: result.person.id,
            name: result.person.name,
            role: result.person.role,
          },
        );
        personPersistCreated = ensured.created;
        if (uuidIds.length) {
          await persistKnowledgeLifecycle(
            client,
            workspaceId,
            op.projectId,
            uuidIds,
            "superseded",
          );
          supersededPersisted = true;
        }
        if (result.responsibilityCreated && result.peopleBullet) {
          await persistKnowledgeBullet(
            client,
            workspaceId,
            op.projectId,
            "people",
            result.peopleBullet,
            userId,
            {
              id: result.item.id,
              kind: result.item.kind,
              epistemic: result.item.epistemic,
              lifecycle: result.item.lifecycle,
              supersedesId: result.item.supersedesId,
              meta: (result.item.meta as Record<string, unknown>) ?? {},
              provenance: result.item.provenance,
            },
          );
        }
      } catch (err) {
        if (supersededPersisted && uuidIds.length) {
          try {
            await persistKnowledgeLifecycle(
              client,
              workspaceId,
              op.projectId,
              uuidIds,
              "current",
            );
          } catch {
            // Keep the original persist failure as the Apply result.
          }
        }
        if (personPersistCreated) {
          try {
            await persistDeleteStakeholder(
              client,
              workspaceId,
              op.projectId,
              result.person.id,
            );
          } catch {
            // Keep the original persist failure as the Apply result.
          }
        }
        throw err;
      }
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
