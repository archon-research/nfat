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
            --bg-base: #09090b;
            --bg-card: #18181b;
            --bg-elevated: #27272a;
            --bg-inset: #0f0f12;
            --border: #27272a;
            --border-subtle: #1e1e22;
            --border-hover: #3f3f46;
            --text-primary: #fafafa;
            --text-secondary: #a1a1aa;
            --text-muted: #71717a;
            --text-dim: #52525b;
            --accent: #a78bfa;
            --positive: #4ade80;
            --facility-senior: #34d399;
            --facility-mezzanine: #fbbf24;
            --facility-structured: #a78bfa;
          }
          [data-theme="light"] {
            --bg-base: #fafafa;
            --bg-card: #ffffff;
            --bg-elevated: #e4e4e7;
            --bg-inset: #f4f4f5;
            --border: #d4d4d8;
            --border-subtle: #e4e4e7;
            --border-hover: #a1a1aa;
            --text-primary: #09090b;
            --text-secondary: #52525b;
            --text-muted: #71717a;
            --text-dim: #a1a1aa;
            --accent: #7c3aed;
            --positive: #16a34a;
            --facility-senior: #059669;
            --facility-mezzanine: #d97706;
            --facility-structured: #7c3aed;
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
          .right-panel { width: 400px; flex-shrink: 0; display: flex; flex-direction: column; gap: 0; }
          .facility-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
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
