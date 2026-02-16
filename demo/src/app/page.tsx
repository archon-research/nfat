"use client";

import { useState, useCallback } from "react";
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
    color: "#34d399",
    description: "First-lien position with priority claim on collateral",
  },
  mezzanine: {
    label: "Mezzanine",
    term: "12-24 months",
    apy: "12-18%",
    color: "#fbbf24",
    description: "Subordinated debt with enhanced yield",
  },
  structured: {
    label: "Structured",
    term: "Negotiated",
    apy: "Risk-adjusted",
    color: "#a78bfa",
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

function emptyRecord<T>(val: T): Record<FacilityKey, T> {
  return { senior: val, mezzanine: val, structured: val };
}

// ── Main Component ──────────────────────────────────────────────

export default function Home() {
  const [role, setRole] = useState<RoleKey>("depositor");
  const [loading, setLoading] = useState(false);

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

  // Right pane state
  const [rightTab, setRightTab] = useState<"nfats" | "events">("nfats");
  const [selectedNfat, setSelectedNfat] = useState<{
    facility: FacilityKey;
    tokenId: string;
  } | null>(null);

  // Facility on-chain names
  const [facilityNames, setFacilityNames] = useState<
    Record<FacilityKey, string>
  >(emptyRecord(""));

  // Inputs
  const [depositAmt, setDepositAmt] = useState("1000");
  const [withdrawAmt, setWithdrawAmt] = useState("500");
  const [issueDepositor, setIssueDepositor] = useState<string>(
    ROLES.depositor.address,
  );
  const [issueAmt, setIssueAmt] = useState("1000");
  const [issueTokenId, setIssueTokenId] = useState("1");
  const [fundTokenId, setFundTokenId] = useState("1");
  const [fundAmt, setFundAmt] = useState("500");
  const [claimTokenId, setClaimTokenId] = useState("1");
  const [claimAmt, setClaimAmt] = useState("500");

  // ── Refresh: fetch events + state from chain ──────────────────

  const refresh = useCallback(async () => {
    try {
      // Token balances
      const addrList = [
        { label: "Depositor", addr: ROLES.depositor.address },
        { label: "Halo", addr: ROLES.halo.address },
        {
          label: "Recipient",
          addr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as `0x${string}`,
        },
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
        args: [parseUnits(depositAmt, 18)],
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
        args: [parseUnits(withdrawAmt, 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  const doIssue = () =>
    exec(async () => {
      const wc = walletClient("operator");
      const hash = await wc.writeContract({
        address: facilityAddr,
        abi: facilityAbi,
        functionName: "issue",
        args: [
          issueDepositor as `0x${string}`,
          parseUnits(issueAmt, 18),
          BigInt(issueTokenId),
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
        args: [BigInt(fundTokenId), parseUnits(fundAmt, 18)],
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
        args: [BigInt(claimTokenId), parseUnits(claimAmt, 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    });

  // ── Derived data ──────────────────────────────────────────────

  const active = ROLES[role];
  const allNfats = FACILITY_KEYS.flatMap((k) => nfats[k]);

  // Events for detail view
  const selectedNfatInfo =
    selectedNfat &&
    nfats[selectedNfat.facility].find(
      (n) => n.tokenId === selectedNfat.tokenId,
    );
  const selectedNfatEvents = selectedNfat
    ? events.filter(
        (e) =>
          e.facility === selectedNfat.facility &&
          e.tokenId === selectedNfat.tokenId,
      )
    : [];

  // Deposit queue for active facility
  const activeFacilityQueue = depositQueue.filter(
    (d) => d.facility === activeFacility,
  );

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1340, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        NFAT Demo
      </h1>
      <p style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 20 }}>
        Interactive walkthrough on local Anvil testchain
      </p>

      <div style={{ display: "flex", gap: 20 }}>
        {/* ── Left Panel ─────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Role Switcher */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 20,
              padding: 16,
              background: "#18181b",
              borderRadius: 8,
            }}
          >
            {(Object.keys(ROLES) as RoleKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setRole(k)}
                style={{
                  background: role === k ? "#60a5fa" : "#27272a",
                  color: role === k ? "#fafafa" : "#a1a1aa",
                  padding: "8px 20px",
                  borderRadius: 6,
                }}
              >
                {ROLES[k].label}
              </button>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 13, color: "#a1a1aa" }}>
              <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                {active.label}
              </span>{" "}
              <code style={{ fontSize: 12 }}>{truncAddr(active.address)}</code>
              {balances[active.label] !== undefined && (
                <span style={{ marginLeft: 12 }}>
                  {fmt(balances[active.label])} sUSDS
                </span>
              )}
            </div>
          </div>

          {/* Facility Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {FACILITY_KEYS.map((key) => {
              const m = FACILITY_META[key];
              const isActive = activeFacility === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveFacility(key)}
                  style={{
                    background: isActive ? "#18181b" : "#0f0f12",
                    border: isActive
                      ? `2px solid ${m.color}`
                      : "2px solid #27272a",
                    borderRadius: 10,
                    padding: 20,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
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
                        color: isActive ? "#fafafa" : "#a1a1aa",
                      }}
                    >
                      {m.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#71717a",
                      marginBottom: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {m.description}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px 16px",
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span style={{ color: "#52525b" }}>APY </span>
                      <span style={{ color: isActive ? m.color : "#a1a1aa", fontWeight: 600 }}>
                        {m.apy}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#52525b" }}>Term </span>
                      <span style={{ color: "#a1a1aa" }}>{m.term}</span>
                    </div>
                    <div>
                      <span style={{ color: "#52525b" }}>Asset </span>
                      <span style={{ color: "#a1a1aa" }}>sUSDS</span>
                    </div>
                    <div>
                      <span style={{ color: "#52525b" }}>Contract </span>
                      <span
                        style={{
                          color: "#a1a1aa",
                          fontFamily: "monospace",
                          fontSize: 11,
                        }}
                      >
                        {truncAddr(FACILITIES[key])}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Role Actions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Depositor */}
            {role === "depositor" && (
              <>
                <ActionCard title="Deposit" color={meta.color} facility={meta.label}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <LabeledInput label="Amount (sUSDS)" value={depositAmt} onChange={setDepositAmt} width={140} />
                    <button onClick={doDeposit} disabled={loading} style={{ background: "#27272a", color: "#fafafa" }}>
                      {loading ? "..." : "Deposit"}
                    </button>
                  </div>
                </ActionCard>

                <ActionCard title="Withdraw" color={meta.color} facility={meta.label}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <LabeledInput label="Amount (sUSDS)" value={withdrawAmt} onChange={setWithdrawAmt} width={140} />
                    <button onClick={doWithdraw} disabled={loading} style={{ background: "#27272a", color: "#fafafa" }}>
                      {loading ? "..." : "Withdraw"}
                    </button>
                  </div>
                </ActionCard>

                <ActionCard title="Claim" color={meta.color} facility={meta.label}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <LabeledInput label="Token ID" value={claimTokenId} onChange={setClaimTokenId} width={80} />
                    <LabeledInput label="Amount (sUSDS)" value={claimAmt} onChange={setClaimAmt} width={140} />
                    <button onClick={doClaim} disabled={loading} style={{ background: "#27272a", color: "#fafafa" }}>
                      {loading ? "..." : "Claim"}
                    </button>
                  </div>
                </ActionCard>
              </>
            )}

            {/* Operator */}
            {role === "operator" && (
              <>
                {/* Deposit Queue */}
                <div
                  style={{
                    background: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <SectionHeader>Deposit Queue — {meta.label}</SectionHeader>
                  {activeFacilityQueue.length === 0 ? (
                    <div style={{ color: "#52525b", fontSize: 13 }}>
                      No queued deposits
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: "#71717a", textAlign: "left" }}>
                          <th style={{ padding: "4px 8px", fontWeight: 600 }}>Depositor</th>
                          <th style={{ padding: "4px 8px", fontWeight: 600, textAlign: "right" }}>Queued (sUSDS)</th>
                          <th style={{ padding: "4px 8px", fontWeight: 600 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeFacilityQueue.map((d) => (
                          <tr key={d.depositor} style={{ borderTop: "1px solid #27272a" }}>
                            <td style={{ padding: "8px", fontFamily: "monospace", fontSize: 12 }}>
                              {truncAddr(d.depositor)}{" "}
                              <span style={{ color: "#52525b", fontFamily: "sans-serif" }}>
                                ({labelForAddr(d.depositor)})
                              </span>
                            </td>
                            <td style={{ padding: "8px", fontFamily: "monospace", textAlign: "right", color: "#4ade80" }}>
                              {fmt(d.balance)}
                            </td>
                            <td style={{ padding: "8px", textAlign: "right" }}>
                              <button
                                onClick={() => {
                                  setIssueDepositor(d.depositor);
                                  setIssueAmt(formatUnits(d.balance, 18));
                                }}
                                style={{
                                  background: "#27272a",
                                  color: "#a1a1aa",
                                  fontSize: 11,
                                  padding: "4px 10px",
                                  borderRadius: 4,
                                }}
                              >
                                Use
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <ActionCard title="Issue NFAT" color={meta.color} facility={meta.label}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <LabeledInput label="Depositor Address" value={issueDepositor} onChange={setIssueDepositor} width={320} />
                    <LabeledInput label="Amount (sUSDS)" value={issueAmt} onChange={setIssueAmt} width={140} />
                    <LabeledInput label="Token ID" value={issueTokenId} onChange={setIssueTokenId} width={80} />
                    <button onClick={doIssue} disabled={loading} style={{ background: "#27272a", color: "#fafafa" }}>
                      {loading ? "..." : "Issue"}
                    </button>
                  </div>
                </ActionCard>
              </>
            )}

            {/* Halo */}
            {role === "halo" && (
              <ActionCard title="Fund" color={meta.color} facility={meta.label}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <LabeledInput label="Token ID" value={fundTokenId} onChange={setFundTokenId} width={80} />
                  <LabeledInput label="Amount (sUSDS)" value={fundAmt} onChange={setFundAmt} width={140} />
                  <button onClick={doFund} disabled={loading} style={{ background: "#27272a", color: "#fafafa" }}>
                    {loading ? "..." : "Fund"}
                  </button>
                </div>
              </ActionCard>
            )}
          </div>
        </div>

        {/* ── Right Panel ────────────────────────────────────── */}
        <div
          style={{
            width: 400,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", marginBottom: 0 }}>
            {(["nfats", "events"] as const).map((tab) => {
              const isActive =
                selectedNfat === null ? rightTab === tab : false;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setRightTab(tab);
                    setSelectedNfat(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: isActive ? "#18181b" : "#0f0f12",
                    color: isActive ? "#fafafa" : "#71717a",
                    borderBottom: isActive
                      ? "2px solid #60a5fa"
                      : "2px solid transparent",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {tab === "nfats" ? `NFATs (${allNfats.length})` : `Events (${events.length})`}
                </button>
              );
            })}
          </div>

          {/* Right pane content */}
          <div
            style={{
              background: "#18181b",
              borderRadius: "0 0 8px 8px",
              padding: 16,
              minHeight: 400,
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
            }}
          >
            {/* NFAT Detail View */}
            {selectedNfat && selectedNfatInfo ? (
              <div>
                <button
                  onClick={() => setSelectedNfat(null)}
                  style={{
                    background: "none",
                    color: "#60a5fa",
                    fontSize: 12,
                    padding: 0,
                    marginBottom: 12,
                    cursor: "pointer",
                  }}
                >
                  &larr; Back to list
                </button>

                <div
                  style={{
                    borderLeft: `3px solid ${FACILITY_META[selectedNfatInfo.facility].color}`,
                    paddingLeft: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#fafafa" }}>
                    NFAT #{selectedNfatInfo.tokenId}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: FACILITY_META[selectedNfatInfo.facility].color,
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    {FACILITY_META[selectedNfatInfo.facility].label}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <DetailStat label="Principal" value={`${fmt(selectedNfatInfo.principal)} sUSDS`} />
                  <DetailStat
                    label="Claimable"
                    value={`${fmt(selectedNfatInfo.claimable)} sUSDS`}
                    highlight={selectedNfatInfo.claimable > 0n}
                  />
                  <DetailStat label="Depositor" value={truncAddr(selectedNfatInfo.depositor)} mono />
                  <DetailStat label="Owner" value={truncAddr(selectedNfatInfo.owner)} mono />
                  <DetailStat
                    label="Minted"
                    value={new Date(selectedNfatInfo.mintedAt * 1000).toLocaleString()}
                  />
                </div>

                <SectionHeader>Event History</SectionHeader>
                {selectedNfatEvents.length === 0 ? (
                  <div style={{ color: "#52525b", fontSize: 12 }}>No events</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {selectedNfatEvents.map((ev, i) => (
                      <EventRow key={i} ev={ev} />
                    ))}
                  </div>
                )}
              </div>
            ) : rightTab === "nfats" ? (
              /* All NFATs list */
              allNfats.length === 0 ? (
                <div style={{ color: "#52525b", fontSize: 13, padding: 8 }}>
                  No NFATs minted yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {allNfats.map((n) => (
                    <button
                      key={`${n.facility}-${n.tokenId}`}
                      onClick={() =>
                        setSelectedNfat({
                          facility: n.facility,
                          tokenId: n.tokenId,
                        })
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: "#0f0f12",
                        border: "1px solid #27272a",
                        borderRadius: 6,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.1s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.borderColor = "#3f3f46")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.borderColor = "#27272a")
                      }
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: FACILITY_META[n.facility].color,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fafafa" }}>
                          NFAT #{n.tokenId}
                          <span
                            style={{
                              fontSize: 11,
                              color: FACILITY_META[n.facility].color,
                              marginLeft: 8,
                              fontWeight: 400,
                            }}
                          >
                            {FACILITY_META[n.facility].label}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#71717a",
                            marginTop: 2,
                          }}
                        >
                          {fmt(n.principal)} sUSDS principal
                          {n.claimable > 0n && (
                            <span style={{ color: "#4ade80", marginLeft: 8 }}>
                              {fmt(n.claimable)} claimable
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ color: "#52525b", fontSize: 16 }}>&rsaquo;</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              /* Events log */
              events.length === 0 ? (
                <div style={{ color: "#52525b", fontSize: 13, padding: 8 }}>
                  No events yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[...events].reverse().map((ev, i) => (
                    <EventRow
                      key={i}
                      ev={ev}
                      onClick={
                        ev.tokenId
                          ? () =>
                              setSelectedNfat({
                                facility: ev.facility,
                                tokenId: ev.tokenId!,
                              })
                          : undefined
                      }
                    />
                  ))}
                </div>
              )
            )}
          </div>

          {/* Bottom bar: balances + refresh */}
          <div
            style={{
              background: "#18181b",
              borderRadius: 8,
              padding: 16,
              marginTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <SectionHeader style={{ margin: 0 }}>Balances</SectionHeader>
              <button
                onClick={() => refresh()}
                style={{
                  background: "#27272a",
                  color: "#a1a1aa",
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 4,
                }}
              >
                Refresh
              </button>
            </div>

            {["Depositor", "Halo", "Recipient"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#71717a" }}>{label}</span>
                <span style={{ color: "#a1a1aa" }}>
                  {balances[label] !== undefined ? fmt(balances[label]) : "—"} sUSDS
                </span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #1e1e22", marginTop: 6, paddingTop: 6 }}>
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
                  <span style={{ color: FACILITY_META[key].color }}>
                    {FACILITY_META[key].label}
                  </span>
                  <span style={{ color: "#a1a1aa" }}>
                    {balances[`Facility:${key}`] !== undefined
                      ? fmt(balances[`Facility:${key}`])
                      : "—"}{" "}
                    sUSDS
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────

function EventRow({
  ev,
  onClick,
}: {
  ev: EventEntry;
  onClick?: () => void;
}) {
  let detail = "";

  if (ev.action === "Deposited" || ev.action === "Withdrawn") {
    const amt = ev.args.amount as bigint;
    const dep = ev.args.depositor as string;
    detail = `${labelForAddr(dep)} — ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Issued") {
    const amt = ev.args.amount as bigint;
    const dep = ev.args.depositor as string;
    detail = `#${ev.tokenId} to ${labelForAddr(dep)} — ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Funded") {
    const amt = ev.args.amount as bigint;
    const funder = ev.args.funder as string;
    detail = `#${ev.tokenId} by ${labelForAddr(funder)} — ${fmt(amt)} sUSDS`;
  } else if (ev.action === "Claimed") {
    const amt = ev.args.amount as bigint;
    const claimer = ev.args.claimer as string;
    detail = `#${ev.tokenId} by ${labelForAddr(claimer)} — ${fmt(amt)} sUSDS`;
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
        background: "#0f0f12",
        cursor: onClick ? "pointer" : "default",
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: FACILITY_META[ev.facility].color,
          flexShrink: 0,
        }}
      />
      <span style={{ color: "#fafafa", fontWeight: 600, width: 72, flexShrink: 0 }}>
        {ev.action}
      </span>
      <span style={{ color: "#a1a1aa", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {detail}
      </span>
      {onClick && <span style={{ color: "#52525b", fontSize: 14 }}>&rsaquo;</span>}
    </div>
  );
}

function DetailStat({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: "#0f0f12",
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: highlight ? "#4ade80" : "#d4d4d8",
          fontFamily: mono ? "monospace" : "inherit",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  title,
  color,
  facility,
  children,
}: {
  title: string;
  color: string;
  facility: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            background: color,
            width: 10,
            height: 10,
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        <span style={{ fontSize: 11, color: "#52525b", marginLeft: "auto" }}>
          {facility}
        </span>
      </div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "#71717a", fontWeight: 500 }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
      />
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
        color: "#71717a",
        textTransform: "uppercase",
        letterSpacing: 1,
        ...style,
      }}
    >
      {children}
    </h3>
  );
}
