import type { FacilityKey } from "@/addresses";

export type NfatInfo = {
  tokenId: string;
  depositor: string;
  principal: bigint;
  claimable: bigint;
  mintedAt: number;
  owner: string;
  facility: FacilityKey;
};

export type EventEntry = {
  facility: FacilityKey;
  action: "Deposited" | "Withdrawn" | "Issued" | "Funded" | "Claimed";
  args: Record<string, unknown>;
  blockNumber: bigint;
  tokenId?: string;
};

export type DepositQueueEntry = {
  depositor: string;
  balance: bigint;
  facility: FacilityKey;
};

export type ViewKey = "prime1" | "prime2" | "halo" | "nfats";
export type ModalType = "deposit" | "withdraw" | "claim" | "issue" | "fund" | null;
export type ModalContext = {
  depositor?: string;
  tokenId?: string;
  maxAmount?: string;
  prefillAmount?: string;
};

export function emptyRecord<T>(val: T): Record<FacilityKey, T> {
  return { senior1: val, senior2: val, senior3: val };
}
