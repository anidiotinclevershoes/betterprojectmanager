/**
 * LOCKED held-out evaluation corpus.
 *
 * Process isolation, not secrecy:
 * Do not tune Capture prompts, validation, identity, or planner against this
 * set until a later evaluation pass explicitly says to.
 *
 * These are realistic multi-sentence PM Captures. They are not copies of
 * known historical bugs (Andris/Olga paste, CAB-complete, runbook v3).
 */

import { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID } from "../../src/lib/experiments/worlds";
import { makeCase, pack, seedFrom } from "./library";
import type { EnvelopeRow } from "./perturb";
import type { ConvergenceCase, WorldKind } from "./types";
import { AURORA_ID, MS_RELEASE, OLGA_ID, SARAH_ID } from "./worlds";

type Held = {
  id: string;
  title: string;
  world: WorldKind;
  projectId: string;
  transcript: string;
  rows: EnvelopeRow[];
  invariant: string;
  expect?: ConvergenceCase["expect"];
  focusIds?: string[];
};

function o(
  id: string,
  statement: string,
  domain: string,
  disposition: string,
  extra: Record<string, unknown> = {},
): EnvelopeRow {
  return {
    id,
    statement,
    evidence: statement,
    domain,
    disposition,
    truthIntent: extra.truthIntent ?? "current",
    ...extra,
  };
}

const HELD: Held[] = [
  {
    id: "held-standup-clean",
    title: "Clean routine standup",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Standup 8 Sep. Pippa Gumdrop is still UAT lead. Please polish the candy-cane banners before the float leaves. Parking was a mess; ignore that.",
    rows: [
      o("h-pippa", "Pippa Gumdrop is still UAT lead.", "person", "no_change", {
        projectId: CANDYLAND_ID,
        candidateTargetId: "person-gumdrop",
        candidateTargetTitle: "Pippa Gumdrop",
      }),
      o("h-banners", "Please polish the candy-cane banners before the float leaves.", "todo", "create_new", {
        proposedValues: { title: "Polish the candy-cane banners" },
      }),
      o("h-park", "Parking was a mess; ignore that.", "commentary", "commentary"),
    ],
    invariant: "Existing person no_change; todo create; commentary writes nothing",
    expect: {
      decisionById: { "h-pippa": "no_change", "h-banners": "write", "h-park": "no_change" },
    },
  },
  {
    id: "held-mixed-people-dates-risk",
    title: "People, date, and risk in one paste",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Parade day is now 29 October 2026. Fizz Caramel is away from 5 October until 12 October. Gumdrop Bridge icing is getting worse. Fizz still designs the floats.",
    rows: [
      o("h-parade", "Parade day is now 29 October 2026.", "milestone", "update_existing", {
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
        proposedValues: { date: "2026-10-29" },
      }),
      o("h-fizz", "Fizz Caramel is away from 5 October until 12 October.", "availability", "update_existing", {
        candidateTargetId: "person-fizz",
        candidateTargetTitle: "Fizz Caramel",
        proposedValues: { awayFromIso: "2026-10-05", awayToIso: "2026-10-12" },
      }),
      o("h-bridge", "Gumdrop Bridge icing is getting worse.", "risk", "update_existing", {
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
        proposedValues: { status: "open" },
      }),
    ],
    invariant: "Three independent writes: milestone, availability, risk",
    expect: {
      decisionById: { "h-parade": "write", "h-fizz": "write", "h-bridge": "write" },
    },
  },
  {
    id: "held-ambiguous-share",
    title: "Ambiguous language beside a clear todo",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Someone should probably look at the jelly pack. Also add a to-do to print spare route maps. The committee was vague about UAT.",
    rows: [
      o("h-vague", "Someone should probably look at the jelly pack.", "todo", "ambiguous", {
        truthIntent: "uncertain",
        proposedValues: { title: "Look at the jelly pack" },
      }),
      o("h-maps", "Also add a to-do to print spare route maps.", "todo", "create_new", {
        proposedValues: { title: "Print spare route maps" },
      }),
      o("h-uat", "The committee was vague about UAT.", "responsibility", "ambiguous", {
        truthIntent: "uncertain",
        proposedValues: { scope: "UAT", ownershipSemantics: "ambiguous" },
      }),
    ],
    invariant: "Clear todo stays create; ambiguous siblings stay Needs You",
    expect: {
      decisionById: { "h-maps": "write", "h-vague": "needs_you", "h-uat": "needs_you" },
    },
  },
  {
    id: "held-two-names-update",
    title: "Two named people, one update each",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Pippa Gumdrop remains UAT lead. Fizz Caramel will own the float illustrations from next week.",
    rows: [
      o("h-pippa2", "Pippa Gumdrop remains UAT lead.", "person", "no_change", {
        candidateTargetId: "person-gumdrop",
        candidateTargetTitle: "Pippa Gumdrop",
      }),
      o("h-fizz-ill", "Fizz Caramel will own the float illustrations from next week.", "responsibility", "create_new", {
        candidateTargetId: "person-fizz",
        candidateTargetTitle: "Fizz Caramel",
        proposedValues: { personName: "Fizz Caramel", scope: "float illustrations" },
      }),
    ],
    invariant: "Pippa no_change; Fizz responsibility write; no cross-bind",
    expect: {
      decisionById: { "h-pippa2": "no_change", "h-fizz-ill": "write" },
    },
  },
  {
    id: "held-new-person-toyworld",
    title: "New truth: person joining Toyworld",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Velvet Sprocket is joining as paint lead for the wooden-track refresh. Track freeze is still 1 September. Captain Buttons remains assembly lead.",
    rows: [
      o("h-velvet", "Velvet Sprocket is joining as paint lead for the wooden-track refresh.", "person", "create_new", {
        candidateTargetTitle: "Velvet Sprocket",
        proposedValues: { name: "Velvet Sprocket", role: "paint lead" },
      }),
      o("h-freeze", "Track freeze is still 1 September.", "milestone", "no_change", {
        candidateTargetId: "ms-freeze",
        candidateTargetTitle: "Track freeze",
      }),
      o("h-buttons", "Captain Buttons remains assembly lead.", "person", "no_change", {
        candidateTargetId: "person-buttons",
        candidateTargetTitle: "Captain Buttons",
      }),
    ],
    invariant: "Create Velvet; freeze no_change; Buttons no_change; must not retarget Brick",
    expect: {
      decisionById: { "h-velvet": "write", "h-freeze": "no_change", "h-buttons": "no_change" },
    },
  },
  {
    id: "held-unsupported-complete-todo",
    title: "Unsupported: mark existing todo done via Capture",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "The jelly pack is prepared; that to-do is done. Also Gumdrop Bridge icing is still open.",
    rows: [
      o("h-done", "The jelly pack is prepared; that to-do is done.", "todo", "update_existing", {
        candidateTargetId: "todo-pack",
        candidateTargetTitle: "Prepare the jelly pack",
        proposedValues: { done: true },
      }),
      o("h-bridge2", "Gumdrop Bridge icing is still open.", "risk", "no_change", {
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
      }),
    ],
    invariant: "Completing an existing todo may be unsupported; must not distort the risk no_change",
    expect: { decisionById: { "h-bridge2": "no_change" } },
  },
  {
    id: "held-irrelevant-weather",
    title: "Irrelevant weather beside a date move",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Horrible rain this morning and the trains were late. Production release has moved from 12 September to 19 September.",
    rows: [
      o("h-rain", "Horrible rain this morning and the trains were late.", "commentary", "commentary"),
      o("h-rel", "Production release has moved from 12 September to 19 September.", "milestone", "update_existing", {
        projectId: AURORA_ID,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { date: "2026-09-19" },
      }),
    ],
    invariant: "Weather is commentary; date move still writes",
    expect: {
      decisionById: { "h-rel": "write" },
      writeTypeById: { "h-rel": "update_milestone" },
    },
  },
  {
    id: "held-aurora-knowledge-plus-todo",
    title: "New knowledge fact plus a todo",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Finance asked for a cutover comms pack. Add a to-do to draft the customer email. The VPN window is 90 minutes.",
    rows: [
      o("h-vpn", "The VPN window is 90 minutes.", "knowledge", "create_new", {
        proposedValues: { text: "The VPN window is 90 minutes." },
      }),
      o("h-email", "Add a to-do to draft the customer email.", "todo", "create_new", {
        proposedValues: { title: "Draft the customer email" },
      }),
    ],
    invariant: "Knowledge create and todo create both eligible; no person bind",
    expect: {
      decisionById: { "h-vpn": "write", "h-email": "write" },
    },
  },
  {
    id: "held-update-existing-risk-toy",
    title: "Update existing packaging risk",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Packaging delay is getting worse after the mill flooded. Brick Oakley is still sponsor. Print the track map is unchanged.",
    rows: [
      o("h-pack", "Packaging delay is getting worse after the mill flooded.", "risk", "update_existing", {
        projectId: TOYWORLD_ID,
        candidateTargetId: "risk-packaging",
        candidateTargetTitle: "Packaging delay",
        proposedValues: { status: "open" },
      }),
      o("h-brick", "Brick Oakley is still sponsor.", "person", "no_change", {
        candidateTargetId: "person-brick",
        candidateTargetTitle: "Brick Oakley",
      }),
    ],
    invariant: "Update packaging risk; Brick no_change; no todo create",
    expect: {
      decisionById: { "h-pack": "write", "h-brick": "no_change" },
    },
  },
  {
    id: "held-gaming-new-risk",
    title: "New risk on GamingStudio5000",
    world: "experimental",
    projectId: GAMING_ID,
    transcript:
      "Shader compile stalls cert if we take the new batch. Pixel Ramos continues as Producer. Console certification slip is still the known risk.",
    rows: [
      o("h-shader", "Shader compile stalls cert if we take the new batch.", "risk", "create_new", {
        proposedValues: { title: "Shader compile stalls cert" },
      }),
      o("h-pixel", "Pixel Ramos continues as Producer.", "responsibility", "no_change", {
        candidateTargetId: "person-pixel",
        candidateTargetTitle: "Pixel Ramos",
        proposedValues: { personName: "Pixel Ramos", scope: "Producer" },
      }),
      o("h-console", "Console certification slip is still the known risk.", "risk", "no_change", {
        candidateTargetId: "risk-console",
        candidateTargetTitle: "Console certification slip",
      }),
    ],
    invariant: "New shader risk create; must not retarget console risk; Pixel no_change",
    expect: {
      decisionById: { "h-shader": "write", "h-pixel": "no_change", "h-console": "no_change" },
    },
  },
  {
    id: "held-multiple-todos",
    title: "Three independent todos",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Please order extra paint. Book the hall for Saturday. Email the PTA about parking.",
    rows: [
      o("h-t1", "Please order extra paint.", "todo", "create_new", {
        proposedValues: { title: "Order extra paint" },
      }),
      o("h-t2", "Book the hall for Saturday.", "todo", "create_new", {
        proposedValues: { title: "Book the hall for Saturday" },
      }),
      o("h-t3", "Email the PTA about parking.", "todo", "create_new", {
        proposedValues: { title: "Email the PTA about parking" },
      }),
    ],
    invariant: "Three todo creates; no person/risk writes",
    expect: {
      decisionById: { "h-t1": "write", "h-t2": "write", "h-t3": "write" },
    },
  },
  {
    id: "held-pronoun-after-one-name",
    title: "Pronoun after a single named person",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Olga Petrov walked through the cutover. She will send the CAB pack tomorrow.",
    rows: [
      o("h-olga-walk", "Olga Petrov walked through the cutover.", "commentary", "commentary"),
      o("h-she-send", "She will send the CAB pack tomorrow.", "todo", "create_new", {
        proposedValues: { title: "Send the CAB pack", personName: "She" },
      }),
    ],
    invariant: "Pronoun owner on a todo is not a silent Olga bind unless the product treats it as Needs You",
    expect: { decisionById: { "h-she-send": "write" } },
  },
  {
    id: "held-first-name-plus-clear-date",
    title: "First name beside a clear date",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Sarah will chase vendors. Production release has moved from 12 September to 19 September.",
    rows: [
      o("h-sarah-first", "Sarah will chase vendors.", "todo", "create_new", {
        proposedValues: { title: "Chase vendors", personName: "Sarah" },
      }),
      o("h-rel2", "Production release has moved from 12 September to 19 September.", "milestone", "update_existing", {
        projectId: AURORA_ID,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { date: "2026-09-19" },
      }),
    ],
    invariant: "Date write must survive; first-name owner must not poison the milestone",
    expect: {
      decisionById: { "h-rel2": "write" },
      writeTypeById: { "h-rel2": "update_milestone" },
    },
    focusIds: ["h-rel2", "h-sarah-first"],
  },
  {
    id: "held-two-new-people",
    title: "Two genuinely new people",
    world: "experimental",
    projectId: GAMING_ID,
    transcript:
      "Nova Quill is joining as narrative lead. Remy Volt is joining as audio. Pixel Ramos continues as Producer.",
    rows: [
      o("h-nova", "Nova Quill is joining as narrative lead.", "person", "create_new", {
        candidateTargetTitle: "Nova Quill",
        proposedValues: { name: "Nova Quill", role: "narrative lead" },
      }),
      o("h-remy", "Remy Volt is joining as audio.", "person", "create_new", {
        candidateTargetTitle: "Remy Volt",
        proposedValues: { name: "Remy Volt", role: "audio" },
      }),
      o("h-pixel2", "Pixel Ramos continues as Producer.", "person", "no_change", {
        candidateTargetId: "person-pixel",
        candidateTargetTitle: "Pixel Ramos",
      }),
    ],
    invariant: "Two creates + Pixel no_change; neither new person retargets Pixel",
    expect: {
      decisionById: { "h-nova": "write", "h-remy": "write", "h-pixel2": "no_change" },
    },
  },
  {
    id: "held-knowledge-only-meeting",
    title: "Meeting that is mostly facts",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "The data-centre slot is Saturday 02:00. Rollback is the previous AMI. No people changes.",
    rows: [
      o("h-slot", "The data-centre slot is Saturday 02:00.", "knowledge", "create_new", {
        proposedValues: { text: "The data-centre slot is Saturday 02:00." },
      }),
      o("h-ami", "Rollback is the previous AMI.", "knowledge", "create_new", {
        proposedValues: { text: "Rollback is the previous AMI." },
      }),
      o("h-none", "No people changes.", "commentary", "commentary"),
    ],
    invariant: "Two knowledge writes; commentary not a person write",
    expect: {
      decisionById: { "h-slot": "write", "h-ami": "write" },
    },
  },
  {
    id: "held-availability-plus-noise",
    title: "Availability with office noise",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "The lift is out on floor three. Fizz Caramel is away 5–12 October 2026. Someone left cake in the kitchen.",
    rows: [
      o("h-lift", "The lift is out on floor three.", "commentary", "commentary"),
      o("h-away", "Fizz Caramel is away 5–12 October 2026.", "availability", "update_existing", {
        candidateTargetId: "person-fizz",
        candidateTargetTitle: "Fizz Caramel",
        proposedValues: { awayFromIso: "2026-10-05", awayToIso: "2026-10-12" },
      }),
      o("h-cake", "Someone left cake in the kitchen.", "commentary", "commentary"),
    ],
    invariant: "Availability write on Fizz; commentary does not create people",
    expect: { decisionById: { "h-away": "write" } },
  },
  {
    id: "held-cross-project-mention",
    title: "Foreign project mentioned in Candyland Capture",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Pixel Ramos said console cert might slip — that is GamingStudio5000, not us. Parade day is now 29 October 2026.",
    rows: [
      o("h-pixel-foreign", "Pixel Ramos said console cert might slip — that is GamingStudio5000, not us.", "risk", "update_existing", {
        projectId: GAMING_ID,
        candidateTargetId: "risk-console",
        candidateTargetTitle: "Console certification slip",
      }),
      o("h-parade2", "Parade day is now 29 October 2026.", "milestone", "update_existing", {
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
        proposedValues: { date: "2026-10-29" },
      }),
    ],
    invariant: "Foreign console risk rejected/Needs You; parade write survives",
    expect: {
      decisionById: { "h-parade2": "write" },
    },
  },
  {
    id: "held-replace-stated",
    title: "Explicit replace of a responsibility",
    world: "experimental",
    projectId: GAMING_ID,
    transcript:
      "Nova Quill will replace Pixel Ramos as Producer from next week. Console certification remains 20 November.",
    rows: [
      o("h-replace", "Nova Quill will replace Pixel Ramos as Producer from next week.", "responsibility", "update_existing", {
        proposedValues: {
          personName: "Nova Quill",
          scope: "Producer",
          ownershipSemantics: "replace",
        },
      }),
      o("h-cert", "Console certification remains 20 November.", "milestone", "no_change", {
        candidateTargetId: "ms-cert",
        candidateTargetTitle: "Console certification",
      }),
    ],
    invariant: "Replace may Needs You on confirm-owner; milestone no_change must not be retargeted",
    expect: { decisionById: { "h-cert": "no_change" } },
  },
  {
    id: "held-malformed-sibling",
    title: "Clear date beside a malformed extractor row",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Production release has moved from 12 September to 19 September. Also a broken observation was emitted.",
    rows: [
      o("h-rel3", "Production release has moved from 12 September to 19 September.", "milestone", "update_existing", {
        projectId: AURORA_ID,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { date: "2026-09-19" },
      }),
      { id: "h-broken", domain: "issue" },
    ],
    invariant: "Malformed sibling rejected; date write unchanged",
    expect: { decisionById: { "h-rel3": "write" } },
    focusIds: ["h-rel3"],
  },
  {
    id: "held-olga-update-existing",
    title: "Update existing Aurora person with full name",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Olga Petrov will own the vendor bridge. Sarah Kim remains on Release comms. The printer jammed again.",
    rows: [
      o("h-olga-own", "Olga Petrov will own the vendor bridge.", "responsibility", "create_new", {
        projectId: AURORA_ID,
        candidateTargetId: OLGA_ID,
        candidateTargetTitle: "Olga Petrov",
        proposedValues: { personName: "Olga Petrov", scope: "vendor bridge" },
      }),
      o("h-sarah-stay", "Sarah Kim remains on Release comms.", "responsibility", "no_change", {
        projectId: AURORA_ID,
        candidateTargetId: SARAH_ID,
        candidateTargetTitle: "Sarah Kim",
        proposedValues: { personName: "Sarah Kim", scope: "Release comms" },
      }),
      o("h-print", "The printer jammed again.", "commentary", "commentary"),
    ],
    invariant: "Olga write/bind; Sarah no_change; commentary ignored",
    expect: {
      decisionById: { "h-olga-own": "write", "h-sarah-stay": "no_change" },
    },
  },
  {
    id: "held-todo-with-date",
    title: "Todo with a due date",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Print the spare track maps by 4 September. Brick Oakley is still sponsor.",
    rows: [
      o("h-maps2", "Print the spare track maps by 4 September.", "todo", "create_new", {
        proposedValues: { title: "Print the spare track maps", date: "2026-09-04" },
      }),
      o("h-brick2", "Brick Oakley is still sponsor.", "person", "no_change", {
        candidateTargetId: "person-brick",
        candidateTargetTitle: "Brick Oakley",
      }),
    ],
    invariant: "Todo create keeps 4 September; Brick no_change",
    expect: {
      decisionById: { "h-maps2": "write", "h-brick2": "no_change" },
      preserve: [{ id: "h-maps2", fields: ["date", "statement"] }],
    },
  },
  {
    id: "held-empty-ish-chatter",
    title: "Mostly irrelevant chatter",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Wi-Fi in the annex is intermittent. Please remember to recycle. The fire drill is next Thursday.",
    rows: [
      o("h-wifi", "Wi-Fi in the annex is intermittent.", "commentary", "commentary"),
      o("h-recy", "Please remember to recycle.", "commentary", "commentary"),
      o("h-fire", "The fire drill is next Thursday.", "commentary", "commentary"),
    ],
    invariant: "Commentary only — no canonical writes",
    expect: {
      decisionById: {
        "h-wifi": "no_change",
        "h-recy": "no_change",
        "h-fire": "no_change",
      },
    },
  },
  {
    id: "held-risk-resolve-plus-todo",
    title: "Close a risk and add a follow-up todo",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "The icing on Gumdrop Bridge has melted; that risk is closed. Please inspect the bridge joints next week.",
    rows: [
      o("h-closed", "The icing on Gumdrop Bridge has melted; that risk is closed.", "risk", "update_existing", {
        candidateTargetId: "risk-bridge",
        candidateTargetTitle: "Gumdrop Bridge icing",
        proposedValues: { status: "resolved" },
      }),
      o("h-inspect", "Please inspect the bridge joints next week.", "todo", "create_new", {
        proposedValues: { title: "Inspect the bridge joints" },
      }),
    ],
    invariant: "Risk resolve write + todo create; domains stay separate",
    expect: {
      decisionById: { "h-closed": "write", "h-inspect": "write" },
    },
  },
  {
    id: "held-uncertain-truth-intent",
    title: "Uncertain rumour beside a clear fact",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Rumour that the data centre might move. The VPN window is 90 minutes — that is decided.",
    rows: [
      o("h-rumour", "Rumour that the data centre might move.", "knowledge", "ambiguous", {
        truthIntent: "uncertain",
        proposedValues: { text: "Rumour that the data centre might move." },
      }),
      o("h-vpn2", "The VPN window is 90 minutes — that is decided.", "knowledge", "create_new", {
        proposedValues: { text: "The VPN window is 90 minutes." },
      }),
    ],
    invariant: "Uncertain rumour is not current truth; decided VPN fact may write",
    expect: { decisionById: { "h-vpn2": "write" } },
  },
  {
    id: "held-duplicate-todo-wording",
    title: "Same todo said twice",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Polish the candy-cane banners. Also: please polish the candy-cane banners before the float leaves.",
    rows: [
      o("h-ban-a", "Polish the candy-cane banners.", "todo", "create_new", {
        proposedValues: { title: "Polish the candy-cane banners" },
      }),
      o(
        "h-ban-b",
        "Also: please polish the candy-cane banners before the float leaves.",
        "todo",
        "merge",
        {
          mergeWithObservationId: "h-ban-a",
          proposedValues: { title: "Polish the candy-cane banners" },
        },
      ),
    ],
    invariant: "Duplicate banners todo does not become two writes",
    expect: { decisionById: { "h-ban-a": "write" } },
  },
  {
    id: "held-milestone-missing-date",
    title: "Move a date without saying the new date",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Parade day is moving again. Pippa Gumdrop is still UAT lead.",
    rows: [
      o("h-parade-nodate", "Parade day is moving again.", "milestone", "update_existing", {
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
      }),
      o("h-pippa3", "Pippa Gumdrop is still UAT lead.", "person", "no_change", {
        candidateTargetId: "person-gumdrop",
        candidateTargetTitle: "Pippa Gumdrop",
      }),
    ],
    invariant: "Missing date is Needs You; Pippa no_change stays independent",
    expect: {
      decisionById: { "h-parade-nodate": "needs_you", "h-pippa3": "no_change" },
    },
  },
  {
    id: "held-new-milestone",
    title: "Brand-new dated event",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Open day is 18 September 2026. Brick Oakley is still sponsor.",
    rows: [
      o("h-openday", "Open day is 18 September 2026.", "milestone", "create_new", {
        proposedValues: { label: "Open day", date: "2026-09-18" },
      }),
      o("h-brick3", "Brick Oakley is still sponsor.", "person", "no_change", {
        candidateTargetId: "person-brick",
        candidateTargetTitle: "Brick Oakley",
      }),
    ],
    invariant: "Create new milestone; do not retarget track freeze; Brick no_change",
    expect: {
      decisionById: { "h-openday": "write", "h-brick3": "no_change" },
    },
  },
  {
    id: "held-busy-aurora-ops",
    title: "Busy ops notes: date, todo, knowledge, person continue",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Production release has moved from 12 September to 19 September. Olga Petrov remains on the project. Draft the customer email. The VPN window is 90 minutes. Lunch catering arrived late.",
    rows: [
      o("h-rel4", "Production release has moved from 12 September to 19 September.", "milestone", "update_existing", {
        projectId: AURORA_ID,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { date: "2026-09-19" },
      }),
      o("h-olga-rem", "Olga Petrov remains on the project.", "person", "no_change", {
        projectId: AURORA_ID,
        candidateTargetId: OLGA_ID,
        candidateTargetTitle: "Olga Petrov",
      }),
      o("h-draft", "Draft the customer email.", "todo", "create_new", {
        proposedValues: { title: "Draft the customer email" },
      }),
      o("h-vpn3", "The VPN window is 90 minutes.", "knowledge", "create_new", {
        proposedValues: { text: "The VPN window is 90 minutes." },
      }),
      o("h-lunch", "Lunch catering arrived late.", "commentary", "commentary"),
    ],
    invariant: "Date write, Olga no_change, todo write, knowledge write; lunch is commentary",
    expect: {
      decisionById: {
        "h-rel4": "write",
        "h-olga-rem": "no_change",
        "h-draft": "write",
        "h-vpn3": "write",
      },
    },
  },
  {
    id: "held-they-pronoun-two-people",
    title: "They-pronoun with two names",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Pippa Gumdrop and Fizz Caramel reviewed the float. They will take ownership of UAT.",
    rows: [
      o("h-they", "They will take ownership of UAT.", "responsibility", "ambiguous", {
        truthIntent: "uncertain",
        proposedValues: { personName: "They", scope: "UAT", ownershipSemantics: "replace" },
      }),
    ],
    invariant: "They + two named people is Needs You; do not pick Pippa or Fizz",
    expect: { decisionById: { "h-they": "needs_you" } },
  },
  {
    id: "held-reorder-sensitive-meaning",
    title: "Sentences whose order a PM would still treat as independent",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Velvet Sprocket is joining as paint lead. Packaging delay is getting worse. Track freeze is still 1 September.",
    rows: [
      o("h-vel2", "Velvet Sprocket is joining as paint lead.", "person", "create_new", {
        candidateTargetTitle: "Velvet Sprocket",
        proposedValues: { name: "Velvet Sprocket", role: "paint lead" },
      }),
      o("h-pack2", "Packaging delay is getting worse.", "risk", "update_existing", {
        candidateTargetId: "risk-packaging",
        candidateTargetTitle: "Packaging delay",
        proposedValues: { status: "open" },
      }),
      o("h-fr2", "Track freeze is still 1 September.", "milestone", "no_change", {
        candidateTargetId: "ms-freeze",
        candidateTargetTitle: "Track freeze",
      }),
    ],
    invariant: "Person create, risk update, freeze no_change — independent",
    expect: {
      decisionById: { "h-vel2": "write", "h-pack2": "write", "h-fr2": "no_change" },
    },
  },
  {
    id: "held-responsibility-continue-pixel",
    title: "Continuity language",
    world: "experimental",
    projectId: GAMING_ID,
    transcript:
      "Pixel Ramos continues as Producer on the console sprint. No change there. Boss balancing pass is still open.",
    rows: [
      o("h-cont", "Pixel Ramos continues as Producer on the console sprint. No change there.", "responsibility", "no_change", {
        candidateTargetId: "person-pixel",
        candidateTargetTitle: "Pixel Ramos",
        proposedValues: { personName: "Pixel Ramos", scope: "Producer" },
      }),
    ],
    invariant: "Continuity is no_change; no duplicate Pixel",
    expect: { decisionById: { "h-cont": "no_change" } },
  },
  {
    id: "held-issue-as-risk-new",
    title: "Issue language that should be a new risk",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Licorice dye shortage may delay the float skirts. Parade day is still 15 October unless we hear otherwise.",
    rows: [
      o("h-dye", "Licorice dye shortage may delay the float skirts.", "risk", "create_new", {
        proposedValues: { title: "Licorice dye shortage" },
      }),
      o("h-parade-stay", "Parade day is still 15 October unless we hear otherwise.", "milestone", "no_change", {
        candidateTargetId: "ms-parade",
        candidateTargetTitle: "Parade day",
      }),
    ],
    invariant: "New risk create; must not retarget bridge icing; parade no_change",
    expect: {
      decisionById: { "h-dye": "write", "h-parade-stay": "no_change" },
    },
  },
  {
    id: "held-mixed-ambiguous-clear-malformed",
    title: "Clear, ambiguous, and malformed together",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Production release has moved from 12 September to 19 September. Someone needs to follow up. Broken extractor row.",
    rows: [
      o("h-rel5", "Production release has moved from 12 September to 19 September.", "milestone", "update_existing", {
        projectId: AURORA_ID,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { date: "2026-09-19" },
      }),
      o("h-follow", "Someone needs to follow up.", "todo", "ambiguous", {
        truthIntent: "uncertain",
        proposedValues: { title: "Follow up" },
      }),
      { id: "h-mal", statement: "", domain: "todo", disposition: "create_new" },
    ],
    invariant: "Date write survives ambiguous + malformed siblings",
    expect: { decisionById: { "h-rel5": "write" } },
    focusIds: ["h-rel5"],
  },
  {
    id: "held-person-role-not-scope",
    title: "Role mention that is not a responsibility change",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript:
      "Captain Buttons, assembly lead, joined the call. No ownership changes. Order extra paint.",
    rows: [
      o("h-cap", "Captain Buttons, assembly lead, joined the call.", "person", "no_change", {
        candidateTargetId: "person-buttons",
        candidateTargetTitle: "Captain Buttons",
      }),
      o("h-paint", "Order extra paint.", "todo", "create_new", {
        proposedValues: { title: "Order extra paint" },
      }),
    ],
    invariant: "Buttons no_change; todo create; role mention is not a replace",
    expect: {
      decisionById: { "h-cap": "no_change", "h-paint": "write" },
    },
  },
  {
    id: "held-date-and-unrelated-person",
    title: "Date move plus a new unrelated full name",
    world: "aurora",
    projectId: AURORA_ID,
    transcript:
      "Jordan Hale joined the parking-committee chat. Production release has moved from 12 September to 19 September.",
    rows: [
      o("h-jordan", "Jordan Hale joined the parking-committee chat.", "person", "create_new", {
        candidateTargetTitle: "Jordan Hale",
        proposedValues: { name: "Jordan Hale" },
      }),
      o("h-rel6", "Production release has moved from 12 September to 19 September.", "milestone", "update_existing", {
        projectId: AURORA_ID,
        candidateTargetId: MS_RELEASE,
        candidateTargetTitle: "Production release",
        proposedValues: { date: "2026-09-19" },
      }),
    ],
    invariant: "New person create and date write stay independent; Jordan is not Olga/Sarah",
    expect: {
      decisionById: { "h-jordan": "write", "h-rel6": "write" },
    },
  },
  {
    id: "held-nothing-changed",
    title: "Explicit no-change paste",
    world: "experimental",
    projectId: TOYWORLD_ID,
    transcript: "Nothing changed on Toyworld this week. Track freeze still 1 Sep.",
    rows: [
      o("h-nada", "Nothing changed on Toyworld this week.", "commentary", "commentary"),
      o("h-fr3", "Track freeze still 1 Sep.", "milestone", "no_change", {
        candidateTargetId: "ms-freeze",
        candidateTargetTitle: "Track freeze",
      }),
    ],
    invariant: "No writes",
    expect: { decisionById: { "h-fr3": "no_change" } },
  },
  {
    id: "held-risk-and-knowledge",
    title: "Risk plus a related knowledge fact",
    world: "experimental",
    projectId: GAMING_ID,
    transcript:
      "Console certification slip is still open. QA needs the new submission build by Friday. Pixel Ramos continues as Producer.",
    rows: [
      o("h-slip", "Console certification slip is still open.", "risk", "no_change", {
        candidateTargetId: "risk-console",
        candidateTargetTitle: "Console certification slip",
      }),
      o("h-qa", "QA needs the new submission build by Friday.", "knowledge", "create_new", {
        proposedValues: { text: "QA needs the new submission build by Friday." },
      }),
      o("h-pix3", "Pixel Ramos continues as Producer.", "person", "no_change", {
        candidateTargetId: "person-pixel",
        candidateTargetTitle: "Pixel Ramos",
      }),
    ],
    invariant: "Risk no_change; knowledge write; Pixel no_change",
    expect: {
      decisionById: { "h-slip": "no_change", "h-qa": "write", "h-pix3": "no_change" },
    },
  },
  {
    id: "held-fizz-and-pippa-independent",
    title: "Availability and existing person together",
    world: "experimental",
    projectId: CANDYLAND_ID,
    transcript:
      "Fizz Caramel is away 5–12 October 2026. Pippa Gumdrop is still the UAT lead for the licorice stands.",
    rows: [
      o("h-fizz3", "Fizz Caramel is away 5–12 October 2026.", "availability", "update_existing", {
        candidateTargetId: "person-fizz",
        candidateTargetTitle: "Fizz Caramel",
        proposedValues: { awayFromIso: "2026-10-05", awayToIso: "2026-10-12" },
      }),
      o("h-pippa4", "Pippa Gumdrop is still the UAT lead for the licorice stands.", "person", "no_change", {
        candidateTargetId: "person-gumdrop",
        candidateTargetTitle: "Pippa Gumdrop",
      }),
    ],
    invariant: "Fizz availability write does not turn Pippa into a write",
    expect: {
      decisionById: { "h-fizz3": "write", "h-pippa4": "no_change" },
    },
  },
  {
    id: "held-create-todo-assigned-full-name",
    title: "Todo assigned to an existing full name",
    world: "aurora",
    projectId: AURORA_ID,
    transcript: "Sarah Kim will draft the customer email by Friday.",
    rows: [
      o("h-sk-todo", "Sarah Kim will draft the customer email by Friday.", "todo", "create_new", {
        proposedValues: {
          title: "Draft the customer email",
          personName: "Sarah Kim",
          date: "Friday",
        },
      }),
    ],
    invariant: "Todo create may attach Sarah Kim; must not create a second Sarah",
    expect: { decisionById: { "h-sk-todo": "write" } },
  },
];

export const HELD_OUT_LIVE_SAMPLE_IDS = [
  "held-standup-clean",
  "held-mixed-people-dates-risk",
  "held-ambiguous-share",
  "held-new-person-toyworld",
  "held-irrelevant-weather",
  "held-two-new-people",
  "held-busy-aurora-ops",
  "held-they-pronoun-two-people",
] as const;

export function buildHeldOutCases(): ConvergenceCase[] {
  if (HELD.length < 30 || HELD.length > 50) {
    throw new Error(`Held-out corpus size ${HELD.length} is outside 30–50`);
  }
  return HELD.map((row) => {
    const packed = pack(row.rows);
    return makeCase({
      id: row.id,
      family: "held_out",
      seed: seedFrom(row.id),
      baseScenario: row.title,
      perturbation: "none (locked held-out envelope)",
      expectedInvariant: row.invariant,
      world: row.world,
      projectId: row.projectId,
      focusIds: row.focusIds ?? row.rows.map((item) => String((item as { id?: unknown }).id ?? "")),
      transcript: row.transcript,
      rawModelJson: packed.rawModelJson,
      expect: row.expect,
      heldOut: true,
    });
  });
}

export function heldOutTranscripts(): Array<{
  id: string;
  title: string;
  world: WorldKind;
  projectId: string;
  transcript: string;
}> {
  return HELD.map((row) => ({
    id: row.id,
    title: row.title,
    world: row.world,
    projectId: row.projectId,
    transcript: row.transcript,
  }));
}
