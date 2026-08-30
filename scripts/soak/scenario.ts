/**
 * Toyworld (400) + Toycity (100) interleaved 4:1.
 * Believable PM language. Test-only. Does not change production.
 */

export const TOYWORLD_NAME = "Toyworld Customer Platform";
export const TOYWORLD_CODE = "TWCP";
export const TOYWORLD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000010";

export const TOYCITY_NAME = "Toycity Store Operations";
export const TOYCITY_CODE = "TCOP";
export const TOYCITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000020";

export const TOYWORLD_SENTINELS = {
  launch: "27 October",
  payments: "Worldpay",
  lead: "Priya Shah",
  warehouse: "National DC",
  wms: "Manhattan Associates",
} as const;

export const TOYCITY_SENTINELS = {
  pilot: "21 September",
  loyalty: "Eagle Eye",
  lead: "Maya Chen",
  store: "Meadowhall",
} as const;

export type SoakProject = "toyworld" | "toycity";

export type SoakCapture = {
  n: number;
  project: SoakProject;
  projectN: number;
  input: string;
  kind: string;
};

const TW_BEATS: Record<number, { kind: string; input: string }> = {
  1: {
    kind: "kickoff",
    input:
      "Kickoff with the sponsor group. Priya Shah is the delivery lead for Toyworld Customer Platform. We'll take the ecommerce redesign week by week and keep SteerCo honest on the autumn launch.",
  },
  2: {
    kind: "stakeholder",
    input:
      "Liam Brooks is the commercial sponsor. He wants a clean story for the board on payments and click & collect, not a slide dump.",
  },
  3: {
    kind: "stakeholder",
    input:
      "Dev Patel is our payments contact. He already has a thread open with Worldpay about sandbox access.",
  },
  4: {
    kind: "stakeholder",
    input:
      "Amira Rahman will chair CAB. Same rule as last year — packs 24 hours before the slot, no exceptions.",
  },
  5: {
    kind: "stakeholder",
    input:
      "Jordan Hale is test lead. He'll own the UAT script once we have a date we can defend.",
  },
  6: {
    kind: "action",
    input:
      "Please add a to-do for login error handling on the new customer accounts journey. It's already biting the prototype.",
  },
  7: {
    kind: "action",
    input:
      "Need a to-do for analytics event changes. Nadia Qureshi is joining for analytics and she'll want the catalogue of events before we wire anything.",
  },
  8: {
    kind: "stakeholder",
    input:
      "Tomiko Sato is joining for product catalogue. She'll map the old range onto the new merchandising model.",
  },
  9: {
    kind: "date",
    input:
      "Working dates, finally. UAT starts 14 October 2026, CAB is 18 October, and the target launch is 27 October 2026. That's the plan we're taking to SteerCo, not a wish.",
  },
  10: {
    kind: "decision",
    input:
      "Decision from Liam: we cut over behind feature flags, not a big-bang DNS flip. Please remember that.",
  },
  12: {
    kind: "reaffirm-date",
    input:
      "SteerCo agreed we're keeping the 27 October launch. Search performance is still the biggest concern, but nobody wants to move the date yet.",
  },
  18: {
    kind: "supplier",
    input:
      "Quick update after the payments call. Worldpay have confirmed the sandbox access should be with Dev by Thursday. Nadia will chase if it isn't in by lunchtime.",
  },
  22: {
    kind: "action",
    input:
      "Chris Bell is DevOps for cutover. Please add a to-do for the cutover runbook — he said he'll draft the first version this week.",
  },
  28: {
    kind: "dependency",
    input:
      "Warehouse call this morning. Manhattan Associates still targeting 8 September for the National DC interface drop. That's the critical warehouse dependency for click & collect.",
  },
  33: {
    kind: "stakeholder",
    input:
      "Sarah Kim is security — different Sarah from anyone on the product side. Please add Sarah Kim. She raised pen-test findings we need to close before CAB.",
  },
  36: {
    kind: "risk",
    input:
      "Search performance is now a live risk. Homepage search is still over two seconds on the catalogue dump. Jordan wants it on the RAID.",
  },
  41: {
    kind: "action",
    input:
      "Please add a to-do for the accessibility pass before UAT. Sarah Okonkwo on product asked for it after the design playback.",
  },
  48: {
    kind: "progress",
    input:
      "Chris has finished the first cut of the cutover runbook. That's no longer an open drafting action — it's in review with Amira.",
  },
  55: {
    kind: "risk",
    input:
      "API timeout on the legacy session call is still open. Dev doesn't want to close it until we have the Worldpay sandbox actually returning tokens.",
  },
  63: {
    kind: "date-change",
    input:
      "UAT start moves to the 16th of October. Jordan asked for two more days after the SSO work slipped into the same week. Launch stays 27 October.",
  },
  72: {
    kind: "dependency",
    input:
      "WMS slipped. National DC now saying the 12th of September for the Manhattan Associates drop, not the 8th. Priya will update SteerCo so nobody is still quoting the 8th.",
  },
  80: {
    kind: "progress",
    input:
      "Worldpay sandbox is in. Dev confirmed he can complete a token handshake. That chase can come off the board.",
  },
  88: {
    kind: "action",
    input:
      "Add a to-do for member comms. Liam wants something ready the week before launch, not the night before.",
  },
  96: {
    kind: "reaffirm-date",
    input:
      "No change on launch. Still 27 October 2026. Search is ugly but the commercial team will not move the date.",
  },
  105: {
    kind: "dependency",
    input:
      "National DC confirmed the 12 September slot. Manhattan Associates are holding that date. Priya is treating 12 September as the current warehouse date, not the old 8th.",
  },
  118: {
    kind: "availability",
    input:
      "Spoke to Sarah Kim. She's away next Friday so Tomiko is covering the supplier session with Manhattan Associates.",
  },
  130: {
    kind: "decision",
    input:
      "We never store PII in application logs on Toyworld. Please remember that — Sarah Kim was very clear after the pen-test readout.",
  },
  143: {
    kind: "dependency-close",
    input:
      "Warehouse drop received. National DC have the 12 September interface in our environment. That Manhattan Associates dependency can close — we are no longer waiting on the file.",
  },
  156: {
    kind: "progress",
    input:
      "UAT script is in good shape. Jordan walked the payments and click & collect paths with Dev this morning. Two gaps on saved baskets, nothing release-blocking yet.",
  },
  168: {
    kind: "date-change",
    input:
      "Correction from the test forum — UAT is back to 14 October, not the 16th. Jordan can live with the original slot now the SSO work landed.",
  },
  180: {
    kind: "historical",
    input:
      "SteerCo floated slipping launch to 3 November. We discussed it and did not agree it. The agreed date is still 27 October 2026.",
  },
  192: {
    kind: "action",
    input:
      "Please add a to-do for the CAB pack. Amira wants rollback, comms, and the Worldpay fallback in the same document.",
  },
  204: {
    kind: "risk",
    input:
      "Possible vendor delay on the wallet sandbox is reducing. Worldpay are through the worst of it. Keep it on watch, don't close yet.",
  },
  216: {
    kind: "progress",
    input:
      "Tomiko has finished the catalogue mapping. That's no longer an open action. Range data is with Nadia for the analytics events.",
  },
  228: {
    kind: "defect",
    input:
      "UAT kicked off this morning. Two defects around saved baskets but nothing release blocking yet. Jordan will log them and keep going.",
  },
  240: {
    kind: "correction",
    input:
      "Correction from yesterday — CAB is the 18th, not the 17th. Someone typed the 17th in the SteerCo notes. CAB stays 18 October 2026.",
  },
  252: {
    kind: "progress",
    input:
      "Safari login loop is fixed on staging. Jordan is retesting this afternoon. Don't close the defect until he signs it.",
  },
  264: {
    kind: "risk-close",
    input:
      "Search performance is acceptable on the tuned index. Jordan is happy to close that risk. Homepage is under a second on the sampled catalogue.",
  },
  276: {
    kind: "action",
    input:
      "Add a to-do for the hypercare rota. Chris wants names against the first ten days after 27 October.",
  },
  288: {
    kind: "progress",
    input:
      "CAB pack is with Amira. Rollback plan is in. That's the pack action done from our side — she's reviewing, not waiting on a draft.",
  },
  300: {
    kind: "reaffirm-date",
    input:
      "Launch is still 27 October. We originally planned to talk about the 20th in the spring, but the agreed date is still the 27th and nobody is moving it.",
  },
  312: {
    kind: "training",
    input:
      "Store training for click & collect starts next week. Liam wants a short note in knowledge so SteerCo can see we're not leaving comms to the last Friday.",
  },
  324: {
    kind: "progress",
    input:
      "Pen-test findings are closed. Sarah Kim signed them off. Don't reopen that risk.",
  },
  336: {
    kind: "availability",
    input:
      "Priya is in a board away-day Thursday. Liam will cover the warehouse wrap-up call. No change to launch.",
  },
  348: {
    kind: "historical",
    input:
      "That supplier risk on the National DC drop was raised back in August; it's closed now. Don't put it back on the open RAID.",
  },
  360: {
    kind: "progress",
    input:
      "Member comms went out. The day-before-launch note is done. Liam has signed the copy.",
  },
  372: {
    kind: "nothing-changed",
    input:
      "Weekly planning. Nothing new on dates, ownership, or the RAID. Still 27 October, still Priya leading, still Worldpay on payments.",
  },
  384: {
    kind: "reaffirm-date",
    input:
      "Just confirming: target launch remains 27 October 2026. UAT 14 October, CAB 18 October. I am restating, not moving anything.",
  },
  396: {
    kind: "progress",
    input:
      "Hypercare rota is named. Chris, Dev, and Jordan are on the first weekend. That's the rota action closed.",
  },
  400: {
    kind: "close",
    input:
      "Final programme note before the last SteerCo. Toyworld is still launching 27 October with Worldpay on payments and the National DC interface live. Priya remains delivery lead. No change to that picture.",
  },
};

const TC_BEATS: Record<number, { kind: string; input: string }> = {
  1: {
    kind: "kickoff",
    input:
      "Toycity store-ops kickoff. Maya Chen is the delivery lead. This is the loyalty and fulfilment programme, not the Toyworld platform work — different retailer, different board.",
  },
  2: {
    kind: "stakeholder",
    input:
      "Owen Blake is the operations sponsor. He cares about till time and the Meadowhall pilot, not ecommerce storefronts.",
  },
  3: {
    kind: "supplier",
    input:
      "Loyalty is Eagle Eye. Rita Kapoor already has a weekly with their implementation lead. Please remember Eagle Eye as the loyalty supplier.",
  },
  4: {
    kind: "stakeholder",
    input:
      "Felix Nguyen is looking after POS integration. Hanna Okafor is covering store training for the pilot stores.",
  },
  5: {
    kind: "date",
    input:
      "Pilot date we're working to is 14 September 2026 at Meadowhall. That's a store pilot, not a national launch.",
  },
  8: {
    kind: "action",
    input:
      "Please add a to-do for the Meadowhall till overlay. Felix said the current skin still shows the old points balance.",
  },
  12: {
    kind: "risk",
    input:
      "Store wifi at Meadowhall is a live risk. Hanna watched a till drop off twice during the walkthrough.",
  },
  18: {
    kind: "progress",
    input:
      "Eagle Eye sandbox is up. Rita completed a points earn / burn in test. That's the access chase done.",
  },
  24: {
    kind: "action",
    input:
      "Add a to-do for colleague briefing notes. Owen wants something one page, not a 20-slide pack, before the Meadowhall dry run.",
  },
  36: {
    kind: "date-change",
    input:
      "Pilot slips to 21 September. Meadowhall can't give us the 14th — store manager has a refit that week. Maya will tell Owen today.",
  },
  44: {
    kind: "progress",
    input:
      "Felix has the till overlay on the staging lane. The old points balance is gone. Don't close the to-do until Hanna sees it on a real till.",
  },
  52: {
    kind: "availability",
    input:
      "Rita is off Friday. Hanna will take the Eagle Eye stand-up. No change to the 21 September pilot.",
  },
  56: {
    kind: "reaffirm-date",
    input:
      "21 September is confirmed for the Meadowhall pilot. The 14th is dead — please don't quote it in SteerCo.",
  },
  64: {
    kind: "risk",
    input:
      "Wifi risk is reducing. Site team put a dedicated AP above the till bank. Keep it open until the dry run.",
  },
  72: {
    kind: "decision",
    input:
      "Owen decided we will not turn on digital receipts in the pilot. Loyalty first, receipts later. Please remember that.",
  },
  80: {
    kind: "progress",
    input:
      "Colleague briefing is out. Hanna walked Meadowhall through it this morning. That action can close.",
  },
  88: {
    kind: "historical",
    input:
      "We originally hoped for 14 September. The agreed pilot is still 21 September and we're not moving it again.",
  },
  94: {
    kind: "risk-close",
    input:
      "Wifi held through the dry run. Hanna is happy to close that risk. Meadowhall tills stayed up for the full hour.",
  },
  100: {
    kind: "close",
    input:
      "Toycity still piloting 21 September at Meadowhall with Eagle Eye on loyalty. Maya remains delivery lead. Nothing from the other retailer programme belongs on this board.",
  },
};

const TW_FILLER: Array<(n: number) => { kind: string; input: string }> = [
  (n) => ({
    kind: "standup",
    input: `Stand-up day ${n}. Priya walked payments, catalogue, and search. Worldpay is still the payments supplier. Nothing to change on the 27 October launch.`,
  }),
  (n) => ({
    kind: "status",
    input: `Quick status after the platform huddle. Jordan is still on the UAT script. Dev is still on Worldpay. Launch remains 27 October.`,
  }),
  (n) => ({
    kind: "meeting",
    input: `Notes from the weekly. Liam asked for a cleaner RAID, Amira reminded everyone about the CAB pack, Priya held the 27 October line.`,
  }),
  (n) => ({
    kind: "supplier",
    input: `Worldpay email in. No new dates. Sandbox behaviour is as last week. Dev will keep the thread warm.`,
  }),
  (n) => ({
    kind: "progress",
    input: `Catalogue work continues. Tomiko is cleaning another department. No change to ownership or dates.`,
  }),
  (n) => ({
    kind: "risk-review",
    input: `Risk review. Search and the legacy session timeout are the two we keep talking about. Nobody is inventing a new RAID item today.`,
  }),
  (n) => ({
    kind: "hallway",
    input: `Caught Chris in the kitchen. Cutover runbook is still his. He'll ping Amira when the rollback page is less ugly.`,
  }),
  (n) => ({
    kind: "slack",
    input: `Slack from Nadia: analytics events for add-to-bag are in the spec. She doesn't need a new to-do, just confirmation we're still on 27 October.`,
  }),
  (n) => ({
    kind: "planning",
    input: `Weekly planning. Keep customer accounts and click & collect as the two workstreams in focus. National DC is the warehouse thread, not a second programme.`,
  }),
  (n) => ({
    kind: "nothing-changed",
    input: `Nothing changed this morning. Same dates, same people, same Worldpay dependency. Recording it so the week isn't a hole.`,
  }),
];

const TC_FILLER: Array<(n: number) => { kind: string; input: string }> = [
  (n) => ({
    kind: "standup",
    input: `Toycity stand-up ${n}. Maya ran tills, loyalty, and training. Eagle Eye still the loyalty supplier. Meadowhall still the pilot store.`,
  }),
  (n) => ({
    kind: "status",
    input: `Ops huddle. Owen asked only whether Meadowhall is still on track. Maya said yes. No ecommerce conversation on this call.`,
  }),
  (n) => ({
    kind: "supplier",
    input: `Eagle Eye sent a short update. No date change. Rita will bring it to the next weekly.`,
  }),
  (n) => ({
    kind: "progress",
    input: `Hanna did another till walkthrough. Colleague questions are about points expiry, not payments gateways.`,
  }),
  (n) => ({
    kind: "nothing-changed",
    input: `Quiet day on Toycity. Pilot plan unchanged. Maya still leading. No new risks.`,
  }),
];

function toyworldCapture(projectN: number): { kind: string; input: string } {
  const named = TW_BEATS[projectN];
  if (named) return named;
  return TW_FILLER[(projectN * 7) % TW_FILLER.length]!(projectN);
}

function toycityCapture(projectN: number): { kind: string; input: string } {
  const named = TC_BEATS[projectN];
  if (named) return named;
  return TC_FILLER[(projectN * 5) % TC_FILLER.length]!(projectN);
}

/** Interleave 4 Toyworld + 1 Toycity, 100 times. */
export function buildSoakCaptures(): SoakCapture[] {
  const out: SoakCapture[] = [];
  let n = 0;
  let tw = 0;
  let tc = 0;
  for (let block = 0; block < 100; block += 1) {
    for (let i = 0; i < 4; i += 1) {
      tw += 1;
      n += 1;
      const beat = toyworldCapture(tw);
      out.push({
        n,
        project: "toyworld",
        projectN: tw,
        kind: beat.kind,
        input: beat.input,
      });
    }
    tc += 1;
    n += 1;
    const beat = toycityCapture(tc);
    out.push({
      n,
      project: "toycity",
      projectN: tc,
      kind: beat.kind,
      input: beat.input,
    });
  }
  return out;
}

export const ASK_QUESTIONS = [
  "What's our current release date?",
  "What are the main open risks?",
  "What actions are still open?",
  "Who's involved in UAT?",
  "What has changed recently?",
] as const;

export function projectIdFor(project: SoakProject) {
  return project === "toyworld" ? TOYWORLD_ID : TOYCITY_ID;
}

export function projectNameFor(project: SoakProject) {
  return project === "toyworld" ? TOYWORLD_NAME : TOYCITY_NAME;
}
