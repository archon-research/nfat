import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROLES, type RoleKey, anvil } from "@/config";

export const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

export function walletClient(role: RoleKey) {
  return createWalletClient({
    account: privateKeyToAccount(ROLES[role].key),
    chain: anvil,
    transport: http(),
  });
}
