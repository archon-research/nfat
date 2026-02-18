import { formatUnits } from "viem";
import { fmt, truncAddr, labelForAddr } from "@/helpers";
import type { NfatInfo, DepositQueueEntry, ModalType, ModalContext } from "@/types";

export function HaloPane({
  meta,
  queue,
  facilityNfats,
  haloBalance,
  loading,
  openModal,
}: {
  meta: { label: string; color: string };
  queue: DepositQueueEntry[];
  facilityNfats: NfatInfo[];
  haloBalance: bigint | undefined;
  loading: boolean;
  openModal: (type: ModalType, ctx?: ModalContext) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Deposit Queue Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ background: meta.color, width: 10, height: 10, borderRadius: "50%", display: "inline-block" }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Deposit Queue</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>{meta.label}</span>
        </div>

        {queue.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
            No queued deposits
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>Depositor</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Queued</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((d) => (
                <tr key={d.depositor} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
                    {truncAddr(d.depositor)}{" "}
                    <span style={{ color: "var(--text-dim)", fontFamily: "sans-serif" }}>
                      ({labelForAddr(d.depositor)})
                    </span>
                  </td>
                  <td style={{ padding: "8px", fontFamily: "monospace", textAlign: "right", color: "var(--positive)" }}>
                    {fmt(d.balance)} sUSDS
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <button
                      onClick={() =>
                        openModal("issue", {
                          depositor: d.depositor,
                          prefillAmount: formatUnits(d.balance, 18),
                          maxAmount: formatUnits(d.balance, 18),
                        })
                      }
                      disabled={loading}
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 12,
                        padding: "4px 12px",
                        borderRadius: 4,
                      }}
                    >
                      Issue NFAT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Facility NFATs Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ background: meta.color, width: 10, height: 10, borderRadius: "50%", display: "inline-block" }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Facility NFATs</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>{meta.label}</span>
        </div>

        {facilityNfats.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
            No NFATs for this facility
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>ID</th>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>Depositor</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Principal</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Claimable</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {facilityNfats.map((n) => (
                <tr key={n.tokenId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", fontWeight: 600 }}>#{n.tokenId}</td>
                  <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
                    {truncAddr(n.depositor)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "right", fontFamily: "monospace" }}>
                    {fmt(n.principal)} sUSDS
                  </td>
                  <td
                    style={{
                      padding: "8px",
                      textAlign: "right",
                      fontFamily: "monospace",
                      color: n.claimable > 0n ? "var(--positive)" : "var(--text-muted)",
                    }}
                  >
                    {fmt(n.claimable)} sUSDS
                  </td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    <button
                      onClick={() =>
                        openModal("fund", {
                          tokenId: n.tokenId,
                          maxAmount: haloBalance !== undefined
                            ? formatUnits(haloBalance, 18)
                            : "0",
                        })
                      }
                      disabled={loading}
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: 12,
                        padding: "4px 12px",
                        borderRadius: 4,
                      }}
                    >
                      Repay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
