import { truncAddr } from "@/helpers";
import type { ModalType, ModalContext } from "@/types";
import { Modal } from "./Modal";

export function Modals({
  modal,
  modalContext,
  modalAmount,
  setModalAmount,
  modalTokenId,
  setModalTokenId,
  loading,
  onClose,
  doDeposit,
  doWithdraw,
  doClaim,
  doIssue,
  doFund,
}: {
  modal: ModalType;
  modalContext: ModalContext;
  modalAmount: string;
  setModalAmount: (v: string) => void;
  modalTokenId: string;
  setModalTokenId: (v: string) => void;
  loading: boolean;
  onClose: () => void;
  doDeposit: () => void;
  doWithdraw: () => void;
  doClaim: () => void;
  doIssue: () => void;
  doFund: () => void;
}) {
  if (!modal) return null;

  const titles: Record<string, string> = {
    deposit: "Deposit sUSDS",
    withdraw: "Withdraw sUSDS",
    claim: `Claim from NFAT #${modalContext.tokenId || ""}`,
    issue: "Issue NFAT",
    fund: `Repay NFAT #${modalContext.tokenId || ""}`,
  };

  return (
    <Modal title={titles[modal] || ""} onClose={onClose}>
      {/* Deposit Modal */}
      {modal === "deposit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              placeholder="Amount (sUSDS)"
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              onClick={() => setModalAmount(modalContext.maxAmount || "0")}
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, padding: "8px 12px" }}
            >
              MAX
            </button>
          </div>
          <button
            onClick={doDeposit}
            disabled={loading || !modalAmount}
            style={{ background: "var(--accent)", color: "#fff", padding: "10px 16px" }}
          >
            {loading ? "Processing..." : "Deposit"}
          </button>
        </div>
      )}

      {/* Withdraw Modal */}
      {modal === "withdraw" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              placeholder="Amount (sUSDS)"
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              onClick={() => setModalAmount(modalContext.maxAmount || "0")}
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, padding: "8px 12px" }}
            >
              MAX
            </button>
          </div>
          <button
            onClick={doWithdraw}
            disabled={loading || !modalAmount}
            style={{ background: "var(--accent)", color: "#fff", padding: "10px 16px" }}
          >
            {loading ? "Processing..." : "Withdraw"}
          </button>
        </div>
      )}

      {/* Claim Modal */}
      {modal === "claim" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              placeholder="Amount (sUSDS)"
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              onClick={() => setModalAmount(modalContext.maxAmount || "0")}
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, padding: "8px 12px" }}
            >
              MAX
            </button>
          </div>
          <button
            onClick={doClaim}
            disabled={loading || !modalAmount}
            style={{ background: "var(--accent)", color: "#fff", padding: "10px 16px" }}
          >
            {loading ? "Processing..." : "Claim"}
          </button>
        </div>
      )}

      {/* Issue Modal */}
      {modal === "issue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Depositor:{" "}
            <code style={{ color: "var(--text-secondary)" }}>
              {modalContext.depositor ? truncAddr(modalContext.depositor) : ""}
            </code>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              placeholder="Amount (sUSDS)"
              style={{ flex: 1 }}
            />
            <button
              onClick={() => setModalAmount(modalContext.maxAmount || "0")}
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, padding: "8px 12px" }}
            >
              MAX
            </button>
          </div>
          <input
            value={modalTokenId}
            onChange={(e) => setModalTokenId(e.target.value)}
            placeholder="Token ID"
            autoFocus
          />
          <button
            onClick={doIssue}
            disabled={loading || !modalAmount || !modalTokenId}
            style={{ background: "var(--accent)", color: "#fff", padding: "10px 16px" }}
          >
            {loading ? "Processing..." : "Issue NFAT"}
          </button>
        </div>
      )}

      {/* Fund Modal */}
      {modal === "fund" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              placeholder="Amount (sUSDS)"
              style={{ flex: 1 }}
              autoFocus
            />
            <button
              onClick={() => setModalAmount(modalContext.maxAmount || "0")}
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 12, padding: "8px 12px" }}
            >
              MAX
            </button>
          </div>
          <button
            onClick={doFund}
            disabled={loading || !modalAmount}
            style={{ background: "var(--accent)", color: "#fff", padding: "10px 16px" }}
          >
            {loading ? "Processing..." : "Repay"}
          </button>
        </div>
      )}
    </Modal>
  );
}
