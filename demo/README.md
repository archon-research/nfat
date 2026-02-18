# NFAT Demo

Interactive dashboard for the NFAT (Non-Fungible Agreement Token) facility contracts. Deploys three senior facility contracts to a local Anvil chain and provides a web UI to deposit, withdraw, issue NFATs, repay, and claim.

## Requirements

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast`)
- [Node.js](https://nodejs.org/) >= 18

## Quick Start

From the repo root:

```bash
cd demo
npm install
./start.sh
```

This single command:

1. Starts a local Anvil chain on `http://127.0.0.1:8545`
2. Deploys the MockERC20 token and three NFATFacility contracts
3. Mints 500M sUSDS to each test account (Prime 1, Prime 2, Halo)
4. Approves all facilities for all accounts
5. Writes deployed addresses to `src/addresses.ts`
6. Starts the Next.js dev server at `http://localhost:3000`

Press `Ctrl+C` to shut down both Anvil and the dev server.

## Test Accounts

All accounts use Anvil's default deterministic keys:

| Role    | Address                                      |
| ------- | -------------------------------------------- |
| Prime 1 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| Prime 2 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| Halo    | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |

## UI Tabs

- **Prime 1 / Prime 2** -- Deposit into the queue, withdraw, and claim funded NFATs
- **Halo** -- View the deposit queue, issue NFATs, and repay them
- **NFATs** -- Browse all minted NFATs across facilities
