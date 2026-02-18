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
  prime1: {
    label: "Prime 1",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`,
    key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as `0x${string}`,
  },
  prime2: {
    label: "Prime 2",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as `0x${string}`,
    key: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as `0x${string}`,
  },
  halo: {
    label: "Halo",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
    key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`,
  },
} as const;

export type RoleKey = keyof typeof ROLES;
