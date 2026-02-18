"use client";

import { useState, useEffect } from "react";
import { parseUnits } from "viem";
import { ROLES, type RoleKey } from "@/config";
import { FACILITIES, FACILITY_KEYS, type FacilityKey } from "@/addresses";
import { facilityAbi } from "@/abi";
import { publicClient, walletClient } from "@/clients";
import { FACILITY_META } from "@/constants";
import { fmt, truncAddr } from "@/helpers";
import { useFacilityData } from "@/hooks/useFacilityData";
import type { ViewKey, ModalType, ModalContext } from "@/types";
import { Header } from "@/components/Header";
import { FacilityGrid } from "@/components/FacilityGrid";
import { PrimePane } from "@/components/PrimePane";
import { HaloPane } from "@/components/HaloPane";
import { RightPanel } from "@/components/RightPanel";
import { Modals } from "@/components/Modals";
import { SectionHeader } from "@/components/SectionHeader";
import { NfatTableRow } from "@/components/NfatTableRow";

// ── Main Component ──────────────────────────────────────────────

export default function Home() {
  const [role, setRole] = useState<RoleKey>("prime1");
  const [view, setView] = useState<ViewKey>("prime1");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [modalContext, setModalContext] = useState<ModalContext>({});
  const [modalAmount, setModalAmount] = useState("");
  const [modalTokenId, setModalTokenId] = useState("");

  // NFATs tab: expanded row
  const [expandedNfat, setExpandedNfat] = useState<string | null>(null);

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  }

  // Active facility
  const [activeFacility, setActiveFacility] =
    useState<FacilityKey>("senior1");

  // Facility data from hook
  const { balances, nfats, events, depositQueue, refresh } =
    useFacilityData();

  // ── Modal helpers ──────────────────────────────────────────────

  function openModal(type: ModalType, ctx: ModalContext = {}) {
    setModal(type);
    setModalContext(ctx);
    setModalAmount(ctx.prefillAmount || "");
    setModalTokenId("");
  }

  // ── Action helpers ────────────────────────────────────────────

  async function exec(fn: () => Promise<void>) {
    setLoading(true);
    try {
      await fn();
      await refresh();
      setModal(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Action error:", msg);
    } finally {
      setLoading(false);
    }
  }

  const facilityAddr = FACILITIES[activeFacility];
  const meta = FACILITY_META[activeFacility];

  const doDeposit = () =>
    exec(async () => {
      const wc = walletClient(role);
      const hash = await wc.writeContract({
        address: facilityAddr,
        abi: facilityAbi,
        functionName: "deposit",
        args: [parseUnits(modalAmount, 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  const doWithdraw = () =>
    exec(async () => {
      const wc = walletClient(role);
      const hash = await wc.writeContract({
        address: facilityAddr,
        abi: facilityAbi,
        functionName: "withdraw",
        args: [parseUnits(modalAmount, 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  const doIssue = () =>
    exec(async () => {
      const wc = walletClient("halo");
      const hash = await wc.writeContract({
        address: facilityAddr,
        abi: facilityAbi,
        functionName: "issue",
        args: [
          modalContext.depositor as `0x${string}`,
          parseUnits(modalAmount, 18),
          BigInt(modalTokenId),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  const doFund = () =>
    exec(async () => {
      const wc = walletClient("halo");
      const hash = await wc.writeContract({
        address: facilityAddr,
        abi: facilityAbi,
        functionName: "fund",
        args: [BigInt(modalContext.tokenId!), parseUnits(modalAmount, 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  const doClaim = () =>
    exec(async () => {
      const wc = walletClient(role);
      const hash = await wc.writeContract({
        address: facilityAddr,
        abi: facilityAbi,
        functionName: "claim",
        args: [BigInt(modalContext.tokenId!), parseUnits(modalAmount, 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  // ── Derived data ──────────────────────────────────────────────

  const allNfats = FACILITY_KEYS.flatMap((k) => nfats[k]);

  const activeFacilityQueue = depositQueue.filter(
    (d) => d.facility === activeFacility,
  );

  const myQueueEntry = activeFacilityQueue.find(
    (d) => d.depositor.toLowerCase() === ROLES[role].address.toLowerCase(),
  );

  const activeFacilityNfats = nfats[activeFacility];

  const myNfats = activeFacilityNfats.filter(
    (n) => n.depositor.toLowerCase() === ROLES[role].address.toLowerCase(),
  );

  // ── Tab switching ─────────────────────────────────────────────

  function switchView(v: ViewKey) {
    setView(v);
    if (v === "prime1") setRole("prime1");
    else if (v === "prime2") setRole("prime2");
    else if (v === "halo") setRole("halo");
  }

  // ── Tab buttons (shared between both views) ───────────────────

  const tabButtons = (["prime1", "prime2", "halo", "nfats"] as ViewKey[]).map((v) => (
    <button
      key={v}
      onClick={() => switchView(v)}
      style={{
        background: view === v ? "var(--accent)" : "var(--bg-elevated)",
        color: view === v ? "#fff" : "var(--text-secondary)",
        padding: "8px 20px",
        borderRadius: 6,
      }}
    >
      {v === "prime1" ? "Prime 1" : v === "prime2" ? "Prime 2" : v === "halo" ? "Halo" : "NFATs"}
    </button>
  ));

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1340, margin: "0 auto", padding: "24px 16px" }}>
      {/* ── NFATs Tab (full width) ────────────────────────────── */}
      {view === "nfats" ? (
        <>
          <Header theme={theme} onToggleTheme={toggleTheme} />
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
              padding: 16,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            {tabButtons}
          </div>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <SectionHeader>All NFATs ({allNfats.length})</SectionHeader>
            {allNfats.length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 8 }}>
                No NFATs minted yet
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>ID</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Facility</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Depositor</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>Owner</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Principal</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Claimable</th>
                  </tr>
                </thead>
                <tbody>
                  {allNfats.map((n) => {
                    const rowKey = `${n.facility}-${n.tokenId}`;
                    const isExpanded = expandedNfat === rowKey;
                    const nfatEvents = events.filter(
                      (e) => e.facility === n.facility && e.tokenId === n.tokenId,
                    );
                    return (
                      <NfatTableRow
                        key={rowKey}
                        n={n}
                        isExpanded={isExpanded}
                        nfatEvents={nfatEvents}
                        onToggle={() => setExpandedNfat(isExpanded ? null : rowKey)}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* ── Prime / Halo Tabs (with right panel) ─────────────── */
        <>
          <Header theme={theme} onToggleTheme={toggleTheme} />
          <div className="main-layout">
            {/* ── Left Panel ───────────────────────────────────── */}
            <div className="left-panel">
              {/* Tab Switcher */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 20,
                  padding: 16,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                {tabButtons}
                <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-secondary)" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {ROLES[role].label}
                  </span>{" "}
                  <code style={{ fontSize: 12 }}>{truncAddr(ROLES[role].address)}</code>
                  {balances[ROLES[role].label] !== undefined && (
                    <span style={{ marginLeft: 12 }}>
                      {fmt(balances[ROLES[role].label])} sUSDS
                    </span>
                  )}
                </div>
              </div>

              <FacilityGrid activeFacility={activeFacility} onSelect={setActiveFacility} />

              {(view === "prime1" || view === "prime2") && (
                <PrimePane
                  meta={meta}
                  myQueueEntry={myQueueEntry}
                  myNfats={myNfats}
                  walletBalance={balances[ROLES[role].label]}
                  loading={loading}
                  openModal={openModal}
                />
              )}

              {view === "halo" && (
                <HaloPane
                  meta={meta}
                  queue={activeFacilityQueue}
                  facilityNfats={activeFacilityNfats}
                  haloBalance={balances["Halo"]}
                  loading={loading}
                  openModal={openModal}
                />
              )}
            </div>

            <RightPanel balances={balances} events={events} onRefresh={refresh} />
          </div>
        </>
      )}

      <Modals
        modal={modal}
        modalContext={modalContext}
        modalAmount={modalAmount}
        setModalAmount={setModalAmount}
        modalTokenId={modalTokenId}
        setModalTokenId={setModalTokenId}
        loading={loading}
        onClose={() => setModal(null)}
        doDeposit={doDeposit}
        doWithdraw={doWithdraw}
        doClaim={doClaim}
        doIssue={doIssue}
        doFund={doFund}
      />
    </div>
  );
}
