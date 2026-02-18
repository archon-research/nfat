import { formatUnits } from "viem";
import { fmt } from "@/helpers";
import type { NfatInfo, DepositQueueEntry, ModalType, ModalContext } from "@/types";

export function PrimePane({
  meta,
  myQueueEntry,
  myNfats,
  walletBalance,
  loading,
  openModal,
}: {
  meta: { label: string; color: string };
  myQueueEntry: DepositQueueEntry | undefined;
  myNfats: NfatInfo[];
  walletBalance: bigint | undefined;
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ background: meta.color, width: 10, height: 10, borderRadius: "50%", display: "inline-block" }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Deposit Queue</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>{meta.label}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Queued Balance</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              {myQueueEntry ? fmt(myQueueEntry.balance) : "0"}{" "}
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-secondary)" }}>sUSDS</span>
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() =>
                openModal("deposit", {
                  maxAmount: walletBalance !== undefined
                    ? formatUnits(walletBalance, 18)
                    : "0",
                })
              }
              disabled={loading}
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Deposit
            </button>
            <button
              onClick={() =>
                openModal("withdraw", {
                  maxAmount: myQueueEntry
                    ? formatUnits(myQueueEntry.balance, 18)
                    : "0",
                })
              }
              disabled={loading || !myQueueEntry || myQueueEntry.balance === 0n}
              style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
            >
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* My NFATs Card */}
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
          <span style={{ fontWeight: 600, fontSize: 15 }}>My NFATs</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: "auto" }}>{meta.label}</span>
        </div>

        {myNfats.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
            No NFATs for this facility
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px", fontWeight: 600 }}>ID</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Principal</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Claimable</th>
                <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {myNfats.map((n) => (
                <tr key={n.tokenId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px", fontWeight: 600 }}>#{n.tokenId}</td>
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
                        openModal("claim", {
                          tokenId: n.tokenId,
                          maxAmount: formatUnits(n.claimable, 18),
                        })
                      }
                      disabled={loading || n.claimable === 0n}
                      style={{
                        background: n.claimable > 0n ? "var(--accent)" : "var(--bg-elevated)",
                        color: n.claimable > 0n ? "#fff" : "var(--text-muted)",
                        fontSize: 12,
                        padding: "4px 12px",
                        borderRadius: 4,
                      }}
                    >
                      Claim
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
