import type { FacilityKey } from "@/addresses";

export const FACILITY_META: Record<
  FacilityKey,
  {
    label: string;
    term: string;
    apy: string;
    color: string;
    description: string;
  }
> = {
  senior1: {
    label: "Senior 1",
    term: "1 year",
    apy: "5.5%",
    color: "var(--facility-senior)",
    description: "First-priority senior tranche with lowest risk",
  },
  senior2: {
    label: "Senior 2",
    term: "2 years",
    apy: "7%",
    color: "var(--facility-mezzanine)",
    description: "Second-priority senior tranche with moderate duration",
  },
  senior3: {
    label: "Senior 3",
    term: "3 years",
    apy: "9.5%",
    color: "var(--facility-structured)",
    description: "Third-priority senior tranche with longest duration",
  },
};
