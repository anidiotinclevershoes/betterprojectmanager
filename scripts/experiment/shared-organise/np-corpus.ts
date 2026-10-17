/**
 * Bounded New Project corpus from existing fixtures and seam strings.
 * Not a new puzzle set.
 */
import { NEW_PROJECT_MESSY_INPUT } from "@/lib/experiments/worlds";
import { NEW_PROJECT_NOTES } from "../../../e2e-hosted-longrun/new-project";

export type NewProjectExperimentCase = {
  id: string;
  title: string;
  source: string;
};

export const NEW_PROJECT_EXPERIMENT_CASES: NewProjectExperimentCase[] = [
  {
    id: "np-mobilisation-notes",
    title: "Riverside mobilisation notes",
    source: NEW_PROJECT_NOTES,
  },
  {
    id: "np-messy-candyland",
    title: "Messy Candyland parade dump",
    source: NEW_PROJECT_MESSY_INPUT,
  },
  {
    id: "np-bob-mike",
    title: "Bob and Mike organise fixture",
    source: "bob is the ba\nmike handles the legacy builds",
  },
  {
    id: "np-maybe-owns",
    title: "Ambiguous ownership",
    source: "Priya maybe owns UAT",
  },
  {
    id: "np-used-to-own",
    title: "Historical ownership",
    source: "Sarah Kim used to own UAT last year",
  },
  {
    id: "np-someone-owns",
    title: "Unnamed owner",
    source: "someone owns the scan spec",
  },
  {
    id: "np-not-on-project",
    title: "Explicit exclusion plus chatter",
    source:
      "Pixel Ramos is not on this project — she's on GamingStudio5000. The lobby cabinets were blasting chiptunes all morning.",
  },
];
