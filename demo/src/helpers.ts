import { formatUnits } from "viem";
import { ROLES } from "@/config";

export function fmt(value: bigint) {
  const s = formatUnits(value, 18);
  if (s.includes(".")) {
    const trimmed = s.replace(/\.?0+$/, "");
    return trimmed || "0";
  }
  return s;
}

export function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function labelForAddr(addr: string): string {
  const lower = addr.toLowerCase();
  for (const [, role] of Object.entries(ROLES)) {
    if (role.address.toLowerCase() === lower) return role.label;
  }
  return truncAddr(addr);
}
