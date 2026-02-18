"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/config";
import { useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" data-theme="dark">
      <head>
        <title>NFAT Demo</title>
        <style>{`
          [data-theme="dark"] {
            --bg-base: #0a0e14;
            --bg-card: #111820;
            --bg-elevated: #1a2332;
            --bg-inset: #080c12;
            --border: #1c2736;
            --border-subtle: #141c28;
            --border-hover: #2a3a4e;
            --text-primary: #e2e8f0;
            --text-secondary: #8899aa;
            --text-muted: #5a6f82;
            --text-dim: #3d5166;
            --accent: #3b82f6;
            --positive: #34d399;
            --facility-senior: #34d399;
            --facility-mezzanine: #818cf8;
            --facility-structured: #f472b6;
            --overlay: rgba(4,10,20,0.7);
          }
          [data-theme="light"] {
            --bg-base: #f0f4f8;
            --bg-card: #ffffff;
            --bg-elevated: #dce4ed;
            --bg-inset: #e8eef4;
            --border: #c4d0dc;
            --border-subtle: #dae2ec;
            --border-hover: #8899aa;
            --text-primary: #0a0e14;
            --text-secondary: #3d5166;
            --text-muted: #5a6f82;
            --text-dim: #8899aa;
            --accent: #2563eb;
            --positive: #16a364;
            --facility-senior: #16a364;
            --facility-mezzanine: #6366d0;
            --facility-structured: #d63a84;
            --overlay: rgba(4,10,20,0.5);
          }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: var(--bg-base); color: var(--text-primary); }
          input { font-family: inherit; font-size: 14px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-primary); outline: none; }
          input:focus { border-color: var(--accent); }
          button { font-family: inherit; font-size: 14px; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: opacity 0.15s; }
          button:hover { opacity: 0.85; }
          button:disabled { opacity: 0.4; cursor: not-allowed; }
          .main-layout { display: flex; gap: 20px; }
          .left-panel { flex: 1; min-width: 0; }
          .right-panel { flex: 0 1 340px; min-width: 260px; display: flex; flex-direction: column; gap: 0; }
          .facility-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
          .modal-overlay { position: fixed; inset: 0; background: var(--overlay); display: flex; align-items: center; justify-content: center; z-index: 1000; }
          .modal-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; min-width: 360px; max-width: 480px; width: 100%; }
          @media (max-width: 900px) {
            .main-layout { flex-direction: column; }
            .right-panel { width: 100%; }
            .facility-grid { grid-template-columns: 1fr; }
          }
        `}</style>
      </head>
      <body>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
