"use client";

import { useState, useCallback } from "react";
import { type Log } from "viem";
import { ROLES } from "@/config";
import {
  FACILITIES,
  FACILITY_KEYS,
  TOKEN_ADDRESS,
  type FacilityKey,
} from "@/addresses";
import { facilityAbi, erc20Abi } from "@/abi";
import { publicClient } from "@/clients";
import { FACILITY_META } from "@/constants";
import { emptyRecord, type NfatInfo, type EventEntry, type DepositQueueEntry } from "@/types";

export function useFacilityData() {
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [nfats, setNfats] = useState<Record<FacilityKey, NfatInfo[]>>(
    emptyRecord([] as NfatInfo[]),
  );
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [depositQueue, setDepositQueue] = useState<DepositQueueEntry[]>([]);
  const [facilityNames, setFacilityNames] = useState<
    Record<FacilityKey, string>
  >(emptyRecord(""));

  const refresh = useCallback(async () => {
    try {
      // Token balances
      const addrList = [
        { label: "Prime 1", addr: ROLES.prime1.address },
        { label: "Prime 2", addr: ROLES.prime2.address },
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

      // Build deposit queue
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

  return { balances, nfats, events, depositQueue, facilityNames, refresh };
}
