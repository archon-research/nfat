"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROLES, type RoleKey, anvil } from "@/config";
import {
  FACILITIES,
  FACILITY_KEYS,
  TOKEN_ADDRESS,
  type FacilityKey,
} from "@/addresses";
import { facilityAbi, erc20Abi } from "@/abi";

// ── Clients ─────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

function walletClient(role: RoleKey) {
  return createWalletClient({
    account: privateKeyToAccount(ROLES[role].key),
    chain: anvil,
    transport: http(),
  });
}

// ── Helpers ─────────────────────────────────────────────────────

function fmt(value: bigint) {
  const s = formatUnits(value, 18);
  if (s.includes(".")) {
    const trimmed = s.replace(/\.?0+$/, "");
    return trimmed || "0";
  }
  return s;
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function labelForAddr(addr: string): string {
  const lower = addr.toLowerCase();
  for (const [, role] of Object.entries(ROLES)) {
    if (role.address.toLowerCase() === lower) return role.label;
  }
  return truncAddr(addr);
}

// ── Facility metadata ───────────────────────────────────────────

const FACILITY_META: Record<
  FacilityKey,
  {
    label: string;
    term: string;
    apy: string;
    color: string;
    description: string;
  }
> = {
  senior: {
    label: "Senior Secured",
    term: "6-12 months",
    apy: "8-12%",
    color: "var(--facility-senior)",
    description: "First-lien position with priority claim on collateral",
  },
  mezzanine: {
    label: "Mezzanine",
    term: "12-24 months",
    apy: "12-18%",
    color: "var(--facility-mezzanine)",
    description: "Subordinated debt with enhanced yield",
  },
  structured: {
    label: "Structured",
    term: "6 months",
    apy: "8%",
    color: "var(--facility-structured)",
    description: "Bespoke tranching with tailored risk-return profile",
  },
};

// ── Types ───────────────────────────────────────────────────────

type NfatInfo = {
  tokenId: string;
  depositor: string;
  principal: bigint;
  claimable: bigint;
  mintedAt: number;
  owner: string;
  facility: FacilityKey;
};

type EventEntry = {
  facility: FacilityKey;
  action: "Deposited" | "Withdrawn" | "Issued" | "Funded" | "Claimed";
  args: Record<string, unknown>;
  blockNumber: bigint;
  tokenId?: string;
};

type DepositQueueEntry = {
  depositor: string;
  balance: bigint;
  facility: FacilityKey;
};

type ViewKey = "depositor" | "halo" | "nfats";
type ModalType = "deposit" | "withdraw" | "claim" | "issue" | "fund" | null;
type ModalContext = {
  depositor?: string;
  tokenId?: string;
  maxAmount?: string;
  prefillAmount?: string;
};

function emptyRecord<T>(val: T): Record<FacilityKey, T> {
  return { senior: val, mezzanine: val, structured: val };
}

// ── Main Component ──────────────────────────────────────────────

export default function Home() {
  const [role, setRole] = useState<RoleKey>("depositor");
  const [view, setView] = useState<ViewKey>("depositor");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [modalContext, setModalContext] = useState<ModalContext>({});
  const [modalAmount, setModalAmount] = useState("");
  const [modalTokenId, setModalTokenId] = useState("");

  // NFATs tab: expanded row
  const [expandedNfat, setExpandedNfat] = useState<string | null>(null);

  // Theme: read from localStorage on mount, sync to document
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
    useState<FacilityKey>("senior");

  // Wallet balances
  const [balances, setBalances] = useState<Record<string, bigint>>({});

  // Per-facility NFAT data
  const [nfats, setNfats] = useState<Record<FacilityKey, NfatInfo[]>>(
    emptyRecord([] as NfatInfo[]),
  );

  // Event log (from on-chain events)
  const [events, setEvents] = useState<EventEntry[]>([]);

  // Deposit queue (computed from events + on-chain deposits mapping)
  const [depositQueue, setDepositQueue] = useState<DepositQueueEntry[]>([]);

  // Facility on-chain names
  const [facilityNames, setFacilityNames] = useState<
    Record<FacilityKey, string>
  >(emptyRecord(""));

  // ── Modal helpers ──────────────────────────────────────────────

  function openModal(type: ModalType, ctx: ModalContext = {}) {
    setModal(type);
    setModalContext(ctx);
    setModalAmount(ctx.prefillAmount || "");
    setModalTokenId("");
  }

  // ── Refresh: fetch events + state from chain ──────────────────

  const refresh = useCallback(async () => {
    try {
      // Token balances
      const addrList = [
        { label: "Depositor", addr: ROLES.depositor.address },
        { label: "Halo", addr: ROLES.halo.address },
      ];
      const newBalances: Record<string, bigint> = {};
      for (const { label, addr } of addrList) {
        newBalances[label] = await publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addr],
        });
      }
      for (const key of FACILITY_KEYS) {
        newBalances[`Facility:${key}`] = await publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [FACILITIES[key]],
        });
      }
      setBalances(newBalances);

      // Fetch events from all facilities
      const allEvents: EventEntry[] = [];
      const discoveredTokenIds: Record<FacilityKey, Set<string>> =
        emptyRecord(null) as unknown as Record<FacilityKey, Set<string>>;
      for (const key of FACILITY_KEYS) discoveredTokenIds[key] = new Set();

      // Track depositors per facility from events
      const depositorSets: Record<FacilityKey, Set<string>> =
        emptyRecord(null) as unknown as Record<FacilityKey, Set<string>>;
      for (const key of FACILITY_KEYS) depositorSets[key] = new Set();

      for (const key of FACILITY_KEYS) {
        const facilityAddr = FACILITIES[key];
        const logs = await publicClient.getContractEvents({
          address: facilityAddr,
          abi: facilityAbi,
          fromBlock: 0n,
        });

        for (const log of logs as Log[]) {
          const ev = log as unknown as {
            eventName: string;
            args: Record<string, unknown>;
            blockNumber: bigint;
          };
          const action = ev.eventName as EventEntry["action"];
          const entry: EventEntry = {
            facility: key,
            action,
            args: ev.args,
            blockNumber: ev.blockNumber,
          };

          if (action === "Deposited" || action === "Withdrawn") {
            const dep = ev.args.depositor as string;
            depositorSets[key].add(dep);
          }
          if (action === "Issued") {
            const tid = String(ev.args.tokenId);
            entry.tokenId = tid;
            discoveredTokenIds[key].add(tid);
            const dep = ev.args.depositor as string;
            depositorSets[key].add(dep);
          }
          if (action === "Funded" || action === "Claimed") {
            entry.tokenId = String(ev.args.tokenId);
          }

          allEvents.push(entry);
        }
      }

      // Sort events by block number
      allEvents.sort((a, b) => Number(a.blockNumber - b.blockNumber));
      setEvents(allEvents);

      // Build deposit queue — query on-chain deposits for discovered depositors
      const queue: DepositQueueEntry[] = [];
      for (const key of FACILITY_KEYS) {
        for (const dep of depositorSets[key]) {
          const bal = await publicClient.readContract({
            address: FACILITIES[key],
            abi: facilityAbi,
            functionName: "deposits",
            args: [dep as `0x${string}`],
          });
          if (bal > 0n) {
            queue.push({ depositor: dep, balance: bal, facility: key });
          }
        }
      }
      setDepositQueue(queue);

      // Fetch NFAT data for discovered token IDs
      const newNfats = emptyRecord([] as NfatInfo[]);
      for (const key of FACILITY_KEYS) {
        const facilityAddr = FACILITIES[key];
        const infos: NfatInfo[] = [];
        for (const tidStr of discoveredTokenIds[key]) {
          const tid = BigInt(tidStr);
          try {
            const [data, owner, cl] = await Promise.all([
              publicClient.readContract({
                address: facilityAddr,
                abi: facilityAbi,
                functionName: "nfatData",
                args: [tid],
              }),
              publicClient.readContract({
                address: facilityAddr,
                abi: facilityAbi,
                functionName: "ownerOf",
                args: [tid],
              }),
              publicClient.readContract({
                address: facilityAddr,
                abi: facilityAbi,
                functionName: "claimable",
                args: [tid],
              }),
            ]);
            infos.push({
              tokenId: tidStr,
              depositor: data[1],
              principal: data[2],
              claimable: cl,
              mintedAt: Number(data[0]),
              owner,
              facility: key,
            });
          } catch {
            /* burned or invalid */
          }
        }
        newNfats[key] = infos;
      }
      setNfats(newNfats);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("could not detect network")) {
        console.error("Refresh error:", msg);
      }
    }
  }, []);

  // Load facility names on mount
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    refresh();
    for (const key of FACILITY_KEYS) {
      publicClient
        .readContract({
          address: FACILITIES[key],
          abi: facilityAbi,
          functionName: "name",
        })
        .then((n) => setFacilityNames((prev) => ({ ...prev, [key]: n })))
        .catch(() =>
          setFacilityNames((prev) => ({
            ...prev,
            [key]: FACILITY_META[key].label,
          })),
        );
    }
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
      const wc = walletClient("depositor");
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
      const wc = walletClient("depositor");
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
      const wc = walletClient("depositor");
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

  // Deposit queue for active facility
  const activeFacilityQueue = depositQueue.filter(
    (d) => d.facility === activeFacility,
  );

  // Depositor's own queue entry for active facility
  const depositorQueue = activeFacilityQueue.find(
    (d) => d.depositor.toLowerCase() === ROLES.depositor.address.toLowerCase(),
  );

  // NFATs for active facility only
  const activeFacilityNfats = nfats[activeFacility];

  // Depositor's own NFATs for active facility
  const depositorNfats = activeFacilityNfats.filter(
    (n) => n.depositor.toLowerCase() === ROLES.depositor.address.toLowerCase(),
  );

  // ── Tab switching ─────────────────────────────────────────────

  function switchView(v: ViewKey) {
    setView(v);
    if (v === "depositor") setRole("depositor");
    else if (v === "halo") setRole("halo");
  }

  // ── Render ────────────────────────────────────────────────────

  const modalTitles: Record<string, string> = {
    deposit: "Deposit sUSDS",
    withdraw: "Withdraw sUSDS",
    claim: `Claim from NFAT #${modalContext.tokenId || ""}`,
    issue: "Issue NFAT",
    fund: `Fund NFAT #${modalContext.tokenId || ""}`,
  };

  return (
    <div style={{ maxWidth: 1340, margin: "0 auto", padding: "24px 16px" }}>
      {/* ── NFATs Tab (full width) ────────────────────────────── */}
      {view === "nfats" ? (
        <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>NFAT Dashboard</h1>
        <button
          onClick={toggleTheme}
          style={{
            background: "none",
            color: "var(--text-muted)",
            padding: "6px",
            borderRadius: 6,
            marginLeft: "auto",
            lineHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

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
        {(["depositor", "halo", "nfats"] as ViewKey[]).map((v) => (
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
            {v === "depositor" ? "Depositor" : v === "halo" ? "Halo" : "NFATs"}
          </button>
        ))}
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
        /* ── Depositor / Halo Tabs (with right panel) ─────────── */
        <>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>NFAT Dashboard</h1>
          <button
            onClick={toggleTheme}
            style={{
              background: "none",
              color: "var(--text-muted)",
              padding: "6px",
              borderRadius: 6,
              marginLeft: "auto",
              lineHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>

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
              {(["depositor", "halo", "nfats"] as ViewKey[]).map((v) => (
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
                  {v === "depositor" ? "Depositor" : v === "halo" ? "Halo" : "NFATs"}
                </button>
              ))}
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

            {/* Facility Cards */}
            <SectionHeader>NFAT Facilities</SectionHeader>
            <div className="facility-grid">
              {FACILITY_KEYS.map((key) => {
                const m = FACILITY_META[key];
                const isActive = activeFacility === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFacility(key)}
                    style={{
                      background: isActive ? "var(--bg-card)" : "var(--bg-inset)",
                      border: isActive
                        ? `1px solid ${m.color}`
                        : "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 20,
                      minHeight: 160,
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
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.4 }}>
                      {m.description}
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

            {/* ── Depositor Pane ─────────────────────────────── */}
            {view === "depositor" && (
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
                        {depositorQueue ? fmt(depositorQueue.balance) : "0"}{" "}
                        <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-secondary)" }}>sUSDS</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button
                        onClick={() =>
                          openModal("deposit", {
                            maxAmount: balances["Depositor"] !== undefined
                              ? formatUnits(balances["Depositor"], 18)
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
                            maxAmount: depositorQueue
                              ? formatUnits(depositorQueue.balance, 18)
                              : "0",
                          })
                        }
                        disabled={loading || !depositorQueue || depositorQueue.balance === 0n}
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

                  {depositorNfats.length === 0 ? (
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
                        {depositorNfats.map((n) => (
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
            )}

            {/* ── Halo Pane ──────────────────────────────────── */}
            {view === "halo" && (
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

                  {activeFacilityQueue.length === 0 ? (
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
                        {activeFacilityQueue.map((d) => (
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

                  {activeFacilityNfats.length === 0 ? (
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
                        {activeFacilityNfats.map((n) => (
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
                                    maxAmount: balances["Halo"] !== undefined
                                      ? formatUnits(balances["Halo"], 18)
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
                                Fund
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel ──────────────────────────────────── */}
          <div className="right-panel">
            {/* Balances Card (on top) */}
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <SectionHeader style={{ margin: 0 }}>Balances</SectionHeader>
                <button
                  onClick={() => refresh()}
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    padding: "4px 12px",
                    borderRadius: 4,
                  }}
                >
                  Refresh
                </button>
              </div>

              {["Depositor", "Halo"].map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {balances[label] !== undefined ? fmt(balances[label]) : "\u2014"} sUSDS
                  </span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 6, paddingTop: 6 }}>
                {FACILITY_KEYS.map((key) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      {FACILITY_META[key].label}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {balances[`Facility:${key}`] !== undefined
                        ? fmt(balances[`Facility:${key}`])
                        : "\u2014"}{" "}
                      sUSDS
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Events Card */}
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 16,
                minHeight: 300,
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
              }}
            >
              <SectionHeader>Events ({events.length})</SectionHeader>
              {events.length === 0 ? (
                <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 8 }}>
                  No events yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[...events].reverse().map((ev, i) => (
                    <EventRow key={i} ev={ev} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {/* ── Modal ────────────────────────────────────────────── */}
      {modal && (
        <Modal title={modalTitles[modal] || ""} onClose={() => setModal(null)}>
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
                {loading ? "Processing..." : "Fund"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              color: "var(--text-muted)",
              fontSize: 18,
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            {"\u2715"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NfatTableRow({
  n,
  isExpanded,
  nfatEvents,
  onToggle,
}: {
  n: NfatInfo;
  isExpanded: boolean;
  nfatEvents: EventEntry[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderTop: "1px solid var(--border)",
          cursor: "pointer",
          background: isExpanded ? "var(--bg-inset)" : "transparent",
        }}
      >
        <td style={{ padding: "8px", fontWeight: 600 }}>#{n.tokenId}</td>
        <td style={{ padding: "8px" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: FACILITY_META[n.facility].color,
              display: "inline-block",
              marginRight: 6,
            }}
          />
          {FACILITY_META[n.facility].label}
        </td>
        <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
          {truncAddr(n.depositor)}{" "}
          <span style={{ color: "var(--text-dim)", fontFamily: "sans-serif" }}>
            ({labelForAddr(n.depositor)})
          </span>
        </td>
        <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
          {truncAddr(n.owner)}{" "}
          <span style={{ color: "var(--text-dim)", fontFamily: "sans-serif" }}>
            ({labelForAddr(n.owner)})
          </span>
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
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: "12px 16px", background: "var(--bg-inset)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
              Minted {new Date(n.mintedAt * 1000).toLocaleString()}
            </div>
            <h4
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Event History
            </h4>
            {nfatEvents.length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No events</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {nfatEvents.map((ev, i) => (
                  <EventRow key={i} ev={ev} showDot={false} />
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function EventRow({
  ev,
  onClick,
  showDot = true,
}: {
  ev: EventEntry;
  onClick?: () => void;
  showDot?: boolean;
}) {
  let detail = "";

  if (ev.action === "Deposited" || ev.action === "Withdrawn") {
    const amt = ev.args.amount as bigint;
    const dep = ev.args.depositor as string;
    detail = `${labelForAddr(dep)} \u2014 ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Issued") {
    const amt = ev.args.amount as bigint;
    const dep = ev.args.depositor as string;
    detail = `#${ev.tokenId} to ${labelForAddr(dep)} \u2014 ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Funded") {
    const amt = ev.args.amount as bigint;
    const funder = ev.args.funder as string;
    detail = `#${ev.tokenId} by ${labelForAddr(funder)} \u2014 ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Claimed") {
    const amt = ev.args.amount as bigint;
    const claimer = ev.args.claimer as string;
    detail = `#${ev.tokenId} by ${labelForAddr(claimer)} \u2014 ${fmt(amt)} sUSDS`;
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 4,
        cursor: onClick ? "pointer" : "default",
        fontSize: 12,
      }}
    >
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: FACILITY_META[ev.facility].color,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ color: "var(--text-primary)", fontWeight: 600, width: 72, flexShrink: 0 }}>
        {ev.action}
      </span>
      <span style={{ color: "var(--text-secondary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {detail}
      </span>
      {onClick && <span style={{ color: "var(--text-dim)", fontSize: 14 }}>&rsaquo;</span>}
    </div>
  );
}

function SectionHeader({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <h3
      style={{
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 10,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: 1,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}
