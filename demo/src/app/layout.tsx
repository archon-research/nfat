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
    <html lang="en">
      <head>
        <title>NFAT Demo</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #09090b; color: #e0e0e0; }
          input { font-family: inherit; font-size: 14px; padding: 8px 12px; border: 1px solid #27272a; border-radius: 6px; background: #18181b; color: #e0e0e0; outline: none; }
          input:focus { border-color: #60a5fa; }
          button { font-family: inherit; font-size: 14px; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: opacity 0.15s; }
          button:hover { opacity: 0.85; }
          button:disabled { opacity: 0.4; cursor: not-allowed; }
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
