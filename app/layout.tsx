import "./globals.css";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

// Same fonts as agentmaxxin.xyz
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata = {
  title: "WILLS — An Estate for Autonomous Agents",
  description: "Autonomous estate protocol for AI agents: heartbeat gating, customer refunds, and on-chain wills.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans antialiased", spaceGrotesk.variable, jetBrainsMono.variable)}>
      <body>{children}</body>
    </html>
  );
}
