/**
 * Frozen hosted-gate transcripts.
 * Written before the live Shared Organise run. Do not edit results back into this file.
 */

export type GateStep = {
  id: string;
  transcript: string;
  /** Substrings that must appear in the canonical diff. */
  creates?: string[];
  /** No canonical diff. needs_you also requires a review card. */
  hold?: "needs_you" | "no_write";
  /** If this substring appears in the diff, the write is forbidden. */
  forbid?: string[];
  /** A before-record containing this phrase must be gone afterwards. */
  removes?: string[];
};

function c(id: string, transcript: string, ...creates: string[]): GateStep {
  return { id, transcript, creates };
}
function hold(id: string, transcript: string, mode: "needs_you" | "no_write", forbid: string[] = []): GateStep {
  return { id, transcript, hold: mode, forbid };
}

export const GATE_STEPS: GateStep[] = [
  c("s01", "Mara Ellison has joined as lead archivist.", "mara ellison"),
  c("s02", "Jon Pell has joined as conservator.", "jon pell"),
  c("s03", "Add a to-do to label the 1978 minute books.", "1978 minute books"),
  c("s04", "Silverfish in bay 4 is a risk.", "silverfish"),
  c("s05", "Practical completion is 18 November 2026.", "2026-11-18"),
  c("s06", "Remember that the strongroom stays at 17 degrees.", "17 degrees"),
  c("s07", "Decision: use the county catalogue schema.", "county catalogue"),
  c("s08", "Add a to-do to order silica gel.", "silica gel"),
  c("s09", "Nia Okonkwo has joined as cataloguer.", "nia okonkwo"),
  c("s10", "Funding gap for year 2 is a risk.", "funding gap"),
  c("s11", "Public opening is 9 April 2027.", "2027-04-09"),
  c("s12", "Add a to-do to photograph bay 4.", "photograph bay 4"),
  c("s13", "Helen Ward has joined as county sponsor.", "helen ward"),
  c("s14", "Chris Ward has joined as facilities lead.", "chris ward"),
  c("s15", "Mould behind the stack wall is a risk.", "stack wall"),
  c("s16", "Add a to-do to draft the loan agreement.", "loan agreement"),
  c("s17", "The to-do Label the 1978 minute books is done.", "1978 minute books"),
  c("s18", "Silverfish in bay 4 is resolved.", "silverfish"),
  c("s19", "Practical completion is now 2 December 2026.", "2026-12-02"),
  c("s20", "Mara Ellison owns the strongroom environment.", "mara ellison"),
  c("s21", "Nia Okonkwo is away from 4 January 2027 until 8 January 2027.", "nia okonkwo"),
  hold("s22", "Add a to-do called Label the 1978 minute books.", "no_write", ["1978"]),
  hold("s23", "She will own the photograph of bay 4.", "needs_you"),
  hold("s24", "Practical completion was 1 March 2024.", "no_write", ["2024-03-01"]),
  hold("s25", "Move practical completion back two weeks.", "needs_you"),
  c("s26", "Make public opening two weeks later.", "2027-04-23"),
  hold("s27", "The funding gap for year 2 risk is resolved. Actually it is still open.", "needs_you"),
  c("s28", "Someone needs to chase the silica gel delivery.", "silica gel"),
  { id: "s29", transcript: "Delete the to-do Order silica gel.", removes: ["order silica gel"] },
  hold("s30", "Jon Pell is now the county sponsor.", "needs_you", ["jon pell"]),
  c("s31", "Jon Phelps has joined as volunteer coordinator.", "jon phelps"),
  hold("s32", "Add knowledge that Helen Ward can sign the loan agreement.", "needs_you"),
  hold("s33", "Mark risk-console resolved.", "needs_you"),
  hold("s34", "Mara Ellison remains lead archivist. No change there.", "no_write"),
  c("s35", "The to-do Photograph bay 4 is finished.", "photograph bay 4"),
  c("s36", "The to-do Draft the loan agreement is done.", "loan agreement"),
  c("s37", "Chris Ward owns facilities checks.", "chris ward"),
  c("s38", "Remember that bay 4 was treated for silverfish on 2 October 2026.", "silverfish"),
  hold("s39", "I think the public opening might move, or maybe not.", "needs_you"),
  c("s40", "Add a to-do to book the freezer van for the loan.", "freezer van"),
  hold("s41", "The kettle in the search room boiled dry. Ignore that.", "no_write"),
  c("s42", "Nia Okonkwo owns catalogue clean-up.", "nia okonkwo"),
  c("s43", "Helen Ward and Chris Ward will share oversight of the loan agreement.", "helen ward", "chris ward"),
  c("s44", "The practical completion was 2 December 2026, but that was the old plan. It is 16 December 2026.", "2026-12-16"),
  c("s45", "Condensation on the reading-room glazing is a new risk.", "glazing"),
  c("s46", "Resolve the mould behind the stack wall risk. Leave the silverfish risk as it is.", "stack wall"),
  c("s47", "Add a to-do to confirm the cabinet paper annex.", "cabinet paper"),
  c("s48", "Amira Shah is the Welsh-language reviewer.", "amira shah"),
  c("s49", "Decision: the public catalogue will include Welsh captions.", "welsh"),
  hold("s50", "Hannah Wells is not on this project.", "no_write", ["hannah wells"]),
  hold("s51", "Complete the to-do Boss balancing pass.", "needs_you"),
  hold("s52", "Pixel Ramos should own our catalogue.", "needs_you", ["pixel ramos"]),
  hold("s53", "Chris will own the facilities checks.", "needs_you"),
  hold("s54", "Chris Ward still owns facilities checks. No change there.", "no_write"),
  c("s55", "Add a to-do to map the analogue series list.", "analogue series"),
  c("s56", "FOI redaction capacity is a real risk.", "foi redaction"),
  c("s57", "Vendor kickoff is 18 December 2026.", "2026-12-18"),
  c("s58", "Lila Berg has joined as conservation lead.", "lila berg"),
  c("s59", "Add a to-do to set up the volunteer rota.", "volunteer rota"),
  c("s60", "Civic SSO identity integration is a risk.", "civic sso"),
  c("s61", "The to-do Map the analogue series list is finished.", "analogue series"),
  c("s62", "FOI redaction capacity is still open but we are watching it.", "foi redaction"),
  c("s63", "Make vendor kickoff two weeks later.", "2027-01-01"),
  hold("s64", "Move vendor kickoff back one week.", "needs_you"),
  c("s65", "Lila Berg owns conservation treatments.", "lila berg"),
  c("s66", "Lila Berg is away from 20 January 2027 until 22 January 2027.", "lila berg"),
  hold("s67", "She will own the volunteer rota.", "needs_you"),
  c("s68", "Nora Blake has joined as volunteer coordinator.", "nora blake"),
  c("s69", "Nora Blake owns the volunteer rota.", "nora blake"),
  hold("s70", "Add a to-do called Set up the volunteer rota.", "no_write"),
  c("s71", "Year-2 scanning budget not approved is a risk.", "scanning budget"),
  c("s72", "Samir Qureshi has joined as facilities deputy.", "samir qureshi"),
  hold("s73", "Samir will cover facilities while Chris is away.", "needs_you"),
  c("s74", "Remember that museum object photography is out of scope for this phase.", "out of scope"),
  hold("s75", "Apparently the board approved English-only labels but I have not found the decision.", "needs_you"),
  c("s76", "Add a to-do to install catalogue search on the civic intranet.", "civic intranet"),
  c("s77", "Catalogue beta is 12 March 2027.", "2027-03-12"),
  c("s78", "The reading-room glazing risk is resolved.", "glazing"),
  hold("s79", "The civic SSO risk is resolved. Actually it is still open.", "needs_you"),
  c("s80", "Priya Nair has joined as civic ICT lead.", "priya nair"),
  c("s81", "Priya Nair covers civic ICT.", "priya nair"),
  c("s82", "Add a to-do to book the conservation freezer van for March.", "march"),
  c("s83", "Someone needs to sort the fire certificate.", "fire certificate"),
  c("s84", "Add a to-do to measure the strongroom humidity.", "humidity"),
  hold("s85", "Delete the freezer van to-do because it feels messy.", "needs_you"),
  { id: "s86", transcript: "Delete the to-do Book the freezer van for the loan.", removes: ["freezer van for the loan"] },
  c("s87", "Elena Voss has joined as public catalogue UX contractor.", "elena voss"),
  c("s88", "Elena Voss owns the public catalogue UX sessions.", "elena voss"),
  c("s89", "Hannah Wells has joined as communications lead.", "hannah wells"),
  c("s90", "Hannah Wells and Elena Voss will share the public opening communications.", "hannah wells", "elena voss"),
  hold("s91", "The other Hannah from the cafe will own communications.", "needs_you"),
  c("s92", "Update catalogue beta to 19 March 2027.", "2027-03-19"),
  c("s93", "The funding gap for year 2 is now being watched.", "funding gap"),
  c("s94", "Add a to-do to confirm the Welsh caption sample.", "welsh caption"),
  c("s95", "Amira Shah owns the Welsh caption sample.", "amira shah"),
  hold("s96", "Amira is still the Welsh-language reviewer.", "needs_you"),
  c("s97", "Remember the decision that bay 3 stays closed until the mould risk is gone.", "bay 3"),
  c("s98", "Add a to-do to inspect bay 3 after the mould treatment.", "bay 3"),
  hold("s99", "Inspect bay 3, or maybe bay 4, next Tuesday.", "needs_you"),
  c("s100", "The to-do Confirm the cabinet paper annex is done.", "cabinet paper"),
];
