import { FACILITY_KEYS, FACILITIES, type FacilityKey } from "@/addresses";
import { FACILITY_META } from "@/constants";
import { truncAddr } from "@/helpers";
import { SectionHeader } from "./SectionHeader";

export function FacilityGrid({
  activeFacility,
  onSelect,
}: {
  activeFacility: FacilityKey;
  onSelect: (key: FacilityKey) => void;
}) {
  return (
    <>
      <SectionHeader>NFAT Facilities</SectionHeader>
      <div className="facility-grid">
        {FACILITY_KEYS.map((key) => {
          const m = FACILITY_META[key];
          const isActive = activeFacility === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                background: isActive ? "var(--bg-card)" : "var(--bg-inset)",
                border: isActive
                  ? `1px solid ${m.color}`
                  : "1px solid var(--border)",
                borderRadius: 10,
                padding: 20,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: m.color,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {m.label}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 12 }}>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>APY </span>
                  <span style={{ color: isActive ? m.color : "var(--text-secondary)", fontWeight: 600 }}>
                    {m.apy}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>Term </span>
                  <span style={{ color: "var(--text-secondary)" }}>{m.term}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>Asset </span>
                  <span style={{ color: "var(--text-secondary)" }}>sUSDS</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-dim)" }}>Contract </span>
                  <span style={{ color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 11 }}>
                    {truncAddr(FACILITIES[key])}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
