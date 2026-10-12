/**
 * Thin New Project adapter.
 * Collated onboarding text is the Organise source. There is no second prompt.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply/types";
import { runSharedOrganiseFromModelJson, type SharedOrganiseRun } from "./run";

export type NewProjectOnboardingPacket = {
  name: string;
  code: string;
  collated: string;
  projectId: string;
  world: CaptureApplyWorld;
  referenceDate?: string;
};

export function organiseNewProjectPacket(
  packet: NewProjectOnboardingPacket,
  rawModelJson: unknown,
): SharedOrganiseRun {
  const source = [
    `Project name: ${packet.name}`,
    `Project code: ${packet.code}`,
    "",
    packet.collated.trim(),
  ].join("\n");
  return runSharedOrganiseFromModelJson({
    transcript: source,
    rawModelJson,
    world: packet.world,
    projectId: packet.projectId,
    referenceDate: packet.referenceDate,
  });
}
