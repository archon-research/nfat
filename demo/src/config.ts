import { http, createConfig, createStorage } from "wagmi";
import { defineChain } from "viem";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

export const config = createConfig({
  chains: [anvil],
  transports: {
    [anvil.id]: http(),
  },
  storage: createStorage({ storage: typeof window !== "undefined" ? window.localStorage : undefined }),
  ssr: true,
});

export const ROLES = {
  depositor: {
    label: "Depositor",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`,
    key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as `0x${string}`,
  },
  operator: {
    label: "Operator",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
    key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`,
  },
  halo: {
    label: "Halo",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
    key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`,
  },
} as const;

export type RoleKey = keyof typeof ROLES;
