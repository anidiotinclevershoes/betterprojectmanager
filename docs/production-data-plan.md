# Lume Production Data Plan (Phase 1)

**Date:** 2026-08-12  
**Goal:** Introduce Supabase Postgres + workspace ownership + RLS without rewriting Capture or removing localStorage.

---

## 1. Current localStorage entities

| Store | Key | Contents |
|---|---|---|
| MissionState | `mission-control-state-v5` | projects, todos, knowledge, timeline, memories, recommendations, meetings, releases, history, analysis usage |
| Capture history | `lume-capture-sessions-v1` | CaptureSessionRecord[] |
| Coach history | `lume-coaching-sessions-v1` | CoachingSessionRecord[] |
| Active Capture draft | sessionStorage `lume-capture-session-v1` | CapturePersistSlice (ephemeral) |
| Workspace layouts | `mc-workspace-layout-v3:{scope}` | frame config |
| Appearance | `mc-appearance-v1` | theme |
| Sidebar | `mc-sidebar-collapsed-v1` | chrome |
| AI dictionary | `lume-project-dictionary-v1` | local AI helper |
| AI Cockpit | `.lume-dev/ai-cockpit-metrics.json` | dev metrics file |

### MissionState → domain concepts

- **Project** (+ embedded **Stakeholder[]**)
- **TodoItem** (kind includes Waiting/Chase)
- **ProjectKnowledge** (sections: now, decisions, risks, people, openLoops)
- **TimelineItem** (milestones / dates)
- **MemoryEntry**, **Recommendation**, **Meeting**, **Release**
- **HistoryEvent**
- Soft analysis counters (`analysesThisMonth`, `analysesMonthKey`, `lastAnalyzedAt`)

Risks today are primarily `knowledge.sections.risks` (+ risk recommendations). Phase 1 introduces a first-class **`risks`** table aligned with the Risk frame, while **`knowledge_items`** hold durable Knowledge bullets (including risk-as-memory if still represented that way in local mode).

---

## 2. Proposed ownership model

```
auth.users
   ↓
profiles
   ↓
workspace_members (role)
   ↓
workspaces
   ↓
projects
   ├── stakeholders
   ├── todos
   ├── risks
   ├── knowledge_items
   ├── milestones          (timeline items)
   ├── memories
   ├── recommendations
   ├── meetings
   ├── releases
   ├── capture_sessions
   ├── history_events
   └── (coach_sessions)
workspace_preferences
```

V1 signup (later phase) creates **one personal workspace** + **one owner membership**. Schema supports future multi-member workspaces now.

Every project-scoped row has `workspace_id` (denormalised for RLS) **and** `project_id` where applicable.

---

## 3. Proposed Supabase tables

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | App profile for `auth.users` | `id` (uuid = auth.uid), email, display_name |
| `workspaces` | Tenant container | id, name, created_at |
| `workspace_members` | Membership + role | workspace_id, user_id, role (`owner`\|`member`) |
| `projects` | Projects | id, workspace_id, name, code, summary, status, kind, focus, milestone fields, RELOPS fields |
| `stakeholders` | People on a project | id, workspace_id, project_id, name, role, preferences/concerns jsonb |
| `todos` | To Dos | id, workspace_id, project_id?, title, done, due_at (date), kind, waiting_on |
| `risks` | First-class risks | id, workspace_id, project_id, title, status, source |
| `knowledge_items` | Durable knowledge bullets | id, workspace_id, project_id, section, body, position |
| `milestones` | Timeline / important dates | id, workspace_id, project_id, label, type, start_on/end_on (date), notes, source |
| `memories` | Org/project memories | id, workspace_id, project_id?, type, title, content, tags jsonb |
| `recommendations` | Coach/capture suggestions | id, workspace_id, project_id?, kind, urgency, status, fields… |
| `meetings` | Meeting prep | id, workspace_id, project_id, title, starts_at, prep jsonb… |
| `releases` | Release trains | id, workspace_id, project_id, stages jsonb, risks jsonb |
| `capture_sessions` | Capture history | id, workspace_id, project_id?, transcript, result jsonb, suggestions jsonb |
| `history_events` | Activity feed | id, workspace_id, project_id?, type, title, source |
| `coach_sessions` | Coach history | id, workspace_id, project_id?, markdown, scope… |
| `workspace_preferences` | Layout/theme sync (optional) | workspace_id, user_id, key, value jsonb |

**IDs:** UUID primary keys for production rows.  
**Business dates:** `due_on`, `start_on`, `next_milestone_on`, `merge_on`, `release_on` as `date` where the domain is a calendar date; `timestamptz` for `created_at` / `updated_at` / meeting `starts_at`.

---

## 4. What remains local / untouched

### Remain local (Phase 1)

- Active Capture draft (`sessionStorage`)
- Appearance / sidebar collapse (device chrome)
- AI Cockpit metrics file
- AI vocabulary dictionary
- Full MissionState still drives the live UI via localStorage

### Untouched product surfaces

- Capture findings / prompts / golden semantics
- Review UX logic
- Demo Reset (must stay `NODE_ENV === "development"` only — never a production wipe)
- Golden / Hard / Mixed / Review Preview / AI Cockpit

### Not in this phase

- Paste Project Documentation productisation (parked post-v1)
- Stripe / billing tables
- Marketing site
- Full Sign Up / Login / OAuth / Forgot Password UI
- Replacing every MissionProvider read/write with Supabase

---

## 5. Migration strategy

1. **Add schema + RLS + clients + repository interfaces** (this phase).
2. Keep **`LocalMissionRepository`** as default (wraps existing MissionState / localStorage behaviour conceptually; UI continues using `store.tsx`).
3. Add **`SupabaseMissionRepository`** implementing the same interfaces for server/tests and future dual-write.
4. Phase 2: wire authenticated reads/writes gradually behind feature flag / env `LUME_PERSISTENCE=supabase`.
5. Production users get **empty workspace → New Project onboarding** — never auto-seed ATLAS/HORIZON/RELOPS.
6. No public end-user migration UI (no production users yet). Optional **dev-only** import helper may come later.

---

## 6. Repository boundary

```
UI / Capture / store.tsx
        ↓
  Lume data repositories (interfaces)
        ↓
  Local adapter  |  Supabase adapter
        ↓
  localStorage   |  Supabase Postgres + RLS
```

Initial interfaces (minimal, not over-abstracted):

- `WorkspaceRepository`
- `ProjectRepository`
- `TodoRepository`
- `RiskRepository`
- `KnowledgeRepository`
- `CaptureSessionRepository`
- `HistoryRepository`

---

## 7. RLS strategy

- RLS **enabled** on every user/workspace-owned table.
- Helper: `is_workspace_member(workspace_id)` using `auth.uid()`.
- Policies for SELECT / INSERT / UPDATE / DELETE: authenticated + member of row’s workspace.
- Nested entities: deny access even with a guessed UUID if workspace membership fails.
- Service role used **only** in server-side isolation test setup / admin bootstrap — never `NEXT_PUBLIC_*`, never normal CRUD.

---

## 8. Risks & assumptions

| Risk | Mitigation |
|---|---|
| Breaking Capture / golden tests | Do not change capture intelligence; keep local path default |
| No Docker in CI agent | Migrations + static policy verify always; live isolation tests require Tom’s Supabase project env |
| Dual ID systems (seed strings vs UUID) | Production tables use UUID; local MissionState keeps string ids until Phase 2 |
| Accidental demo wipe in prod | Reset Demo remains `NODE_ENV` gated; no production reset RPC |
| Leaking service role | Separate `createServiceClient()` server-only module |
| Over-normalising Knowledge | `knowledge_items.body` text; Capture session `result` jsonb preserves structure without chain-of-thought |

**Assumptions**

- Tom will create a **dedicated Lume Supabase project** (not reuse unrelated projects).
- Vercel env wiring can wait until Phase 2 auth/deploy work.
- Phase 1 success = schema + RLS + tests + repository boundary + local app still green.

---

## 9. Manual configuration (Tom)

See `docs/SUPABASE_SETUP_FOR_TOM.md` for click-by-click steps.

Required values (never commit secrets):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable / anon)
- `SUPABASE_SERVICE_ROLE_KEY` (server/tests only)

---

## 10. Definition of done (Phase 1)

- [x] Plan documented (this file)
- [x] Versioned `supabase/migrations`
- [x] Workspace ownership model
- [x] RLS on all owned tables
- [x] Isolation tests (live when credentials present; structural verify always)
- [x] `@supabase/ssr` browser/server clients
- [x] Repository boundary + local + supabase adapters
- [x] Existing verify suites still pass
- [x] Production build succeeds
- [x] Setup guide for Tom (`docs/SUPABASE_SETUP_FOR_TOM.md`)
- [x] No billing / no Capture intelligence changes
