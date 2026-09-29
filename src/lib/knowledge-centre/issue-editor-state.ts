/**
 * Draft presentation for the Page 09 Issue editor.
 * This module never writes MissionState, tags, or History.
 * Save and Discard are the only exits from an active edit.
 */

export const ISSUE_EDIT_LOCK = "Editing — Save or Discard before leaving.";
export const ISSUE_EDIT_BLANK_TITLE = "Title cannot be blank.";
export const ISSUE_EDIT_MISSING_TARGET =
  "This issue is no longer in the project. Save is unavailable.";
export const ISSUE_EDIT_SAVE_FAILED = "Could not save the issue edit.";

export type IssueEditDraft = {
  title: string;
  notes: string;
  tagNames: string[];
};

export type IssueEditorState = {
  active: boolean;
  riskId: string | null;
  draft: IssueEditDraft | null;
  saving: boolean;
  error: string | null;
  lockAnnounced: boolean;
  announceTick: number;
};

export type IssueSaveIntent =
  | {
      ok: true;
      input: {
        riskId: string;
        title: string;
        notes: string;
        tagNames: string[];
      };
    }
  | { ok: false; reason: "blank-title" | "missing-target" | "busy" | "inactive" };

export function idleIssueEditor(): IssueEditorState {
  return {
    active: false,
    riskId: null,
    draft: null,
    saving: false,
    error: null,
    lockAnnounced: false,
    announceTick: 0,
  };
}

/** Open and watch Issues can enter the editor. Resolved and accepted cannot. */
export function canMountIssueEditor(status: string): boolean {
  return status === "open" || status === "watch";
}

export function startIssueEdit(
  current: IssueEditorState,
  input: {
    riskId: string;
    title: string;
    notes: string | null;
    tagNames: readonly string[];
  },
): IssueEditorState {
  if (current.saving) return current;
  return {
    active: true,
    riskId: input.riskId,
    draft: {
      title: input.title,
      notes: input.notes ?? "",
      tagNames: [...input.tagNames],
    },
    saving: false,
    error: null,
    lockAnnounced: false,
    announceTick: current.announceTick,
  };
}

export function changeIssueDraft(
  current: IssueEditorState,
  patch: Partial<IssueEditDraft>,
): IssueEditorState {
  if (!current.active || !current.draft || current.saving) return current;
  return {
    ...current,
    error: null,
    lockAnnounced: false,
    draft: {
      title: patch.title ?? current.draft.title,
      notes: patch.notes ?? current.draft.notes,
      tagNames: patch.tagNames ? [...patch.tagNames] : [...current.draft.tagNames],
    },
  };
}

/**
 * An external canonical update must not replace an in-progress draft.
 * The snapshot stays until Save or Discard.
 */
export function retainIssueDraft(current: IssueEditorState): IssueEditorState {
  return current;
}

/** Keep the editor open and announce the existing lock. */
export function requestIssueEditExit(current: IssueEditorState): IssueEditorState {
  if (!current.active || current.saving) return current;
  return {
    ...current,
    lockAnnounced: true,
    announceTick: current.announceTick + 1,
  };
}

export function discardIssueEdit(current: IssueEditorState): IssueEditorState {
  if (!current.active || current.saving) return current;
  return idleIssueEditor();
}

export function beginIssueSave(
  current: IssueEditorState,
  riskStillExists: boolean,
): { state: IssueEditorState; intent: IssueSaveIntent } {
  if (!current.active || !current.draft || !current.riskId) {
    return { state: current, intent: { ok: false, reason: "inactive" } };
  }
  if (current.saving) {
    return { state: current, intent: { ok: false, reason: "busy" } };
  }
  if (current.draft.title.trim() === "") {
    return {
      state: {
        ...current,
        error: ISSUE_EDIT_BLANK_TITLE,
        lockAnnounced: false,
      },
      intent: { ok: false, reason: "blank-title" },
    };
  }
  if (!riskStillExists) {
    return {
      state: {
        ...current,
        error: ISSUE_EDIT_MISSING_TARGET,
        saving: false,
      },
      intent: { ok: false, reason: "missing-target" },
    };
  }
  return {
    state: { ...current, saving: true, error: null, lockAnnounced: false },
    intent: {
      ok: true,
      input: {
        riskId: current.riskId,
        title: current.draft.title,
        notes: current.draft.notes,
        tagNames: [...current.draft.tagNames],
      },
    },
  };
}

export function finishIssueSave(
  current: IssueEditorState,
  result: { ok: boolean; error?: string },
): IssueEditorState {
  if (!current.active || !current.draft) return current;
  if (!result.ok) {
    return {
      ...current,
      saving: false,
      error: result.error?.trim() || ISSUE_EDIT_SAVE_FAILED,
      lockAnnounced: false,
    };
  }
  return idleIssueEditor();
}
