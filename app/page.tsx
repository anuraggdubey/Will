"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FastForward,
  Heart,
  Lock,
  RefreshCw,
  RotateCcw,
  SendHorizontal,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  Unlock,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Stage = "ACTIVE" | "WARNING" | "WINDING_DOWN" | "EXECUTABLE" | "SETTLED";

interface EstateData {
  stage: Stage;
  elapsed: number;
  now: number;
  lastHeartbeat: number;
  nextTransitionAt: number | null;
  secondsUntilNext: number | null;
  isSettled: boolean;
  willHash: string;
  heirs: Array<{ address: string; bps: number; label?: string }>;
  vaultBalance: { atomic: string; formatted: string };
  agentFloat: { atomic: string; formatted: string };
  earmarked: { atomic: string; formatted: string };
  allowanceRemaining: { atomic: string; formatted: string };
}

interface StandingBriefItem {
  id: string;
  clientAddress: string;
  topic: string;
  totalDays: number;
  delivered: number;
  status: string;
  prepaidUSDC: string;
  refundIfCancelled: string;
  createdAt: number;
  digestsCount: number;
  latestDigest?: { day: number; title: string; summary: string; deliveredAt: number } | null;
}

interface ToolInfo {
  name: string;
  description: string;
  stages: Stage[];
  isAllowed: boolean;
}

interface Step {
  tool: string;
  args: any;
  result: any;
  error?: boolean;
}

interface Message {
  role: "user" | "agent";
  text: string;
  steps?: Step[];
  error?: boolean;
}

const STAGES: Array<{ id: Stage; label: string; desc: string; color: string; bg: string; border: string }> = [
  { id: "ACTIVE", label: "ACTIVE", desc: "Full operations & intake", color: "text-[#C8E850]", bg: "bg-[#C8E850]/10", border: "border-[#C8E850]/30" },
  { id: "WARNING", label: "WARNING", desc: "Spend throttled to 25%", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  { id: "WINDING_DOWN", label: "WINDING DOWN", desc: "Intake frozen · Refunds active", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  { id: "EXECUTABLE", label: "EXECUTABLE", desc: "Will ready for settlement", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { id: "SETTLED", label: "SETTLED", desc: "Estate disbursed to heirs", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
];

export default function Home() {
  const [estate, setEstate] = useState<EstateData | null>(null);
  const [briefs, setBriefs] = useState<StandingBriefItem[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [wallet, setWallet] = useState<{ address: string | null; balance?: string }>({ address: null });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      text: "Greetings. I am the Wills Analyst, an autonomous research agent operating under an on-chain estate protocol on Base Sepolia. I deliver daily research briefs to paying clients, guarded by my owner's heartbeat. If my owner lapses, my spending throttles, new intake ceases, and clients receive automatic refunds before leftover funds disburse to heirs. How may I assist your inquiries today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showNewBriefModal, setShowNewBriefModal] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newDays, setNewDays] = useState(7);
  const [actionLoading, setActionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadEstate = async () => {
    try {
      const res = await fetch("/api/estate");
      if (res.ok) setEstate(await res.json());
    } catch (e) {
      console.error("Failed to fetch estate", e);
    }
  };

  const loadBriefs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setBriefs(data.briefs || []);
      }
    } catch (e) {
      console.error("Failed to fetch briefs", e);
    }
  };

  const loadAgentStatus = async () => {
    try {
      const res = await fetch("/api/agent");
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
      }
    } catch (e) {
      console.error("Failed to load agent tools", e);
    }
  };

  const loadWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      if (res.ok) setWallet(await res.json());
    } catch (e) {
      console.error("Failed to load wallet", e);
    }
  };

  const refreshAll = () => {
    loadEstate();
    loadBriefs();
    loadAgentStatus();
    loadWallet();
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(loadEstate, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Heartbeat & Time warp actions
  const triggerEstateAction = async (action: string, payload: any = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/estate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEstate(updated);
        loadAgentStatus();
      }
    } catch (e) {
      console.error("Action failed", e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommissionBrief = async () => {
    if (!newTopic.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newTopic, days: newDays }),
      });
      if (res.ok) {
        setShowNewBriefModal(false);
        setNewTopic("");
        refreshAll();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to commission brief");
      }
    } catch (e: any) {
      alert(e.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || thinking) return;
    const history: Message[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
        }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        data.error
          ? { role: "agent", text: data.error, error: true }
          : { role: "agent", text: data.answer, steps: data.steps },
      ]);
      refreshAll();
    } catch {
      setMessages((m) => [
        ...m,
        { role: "agent", text: "Connection error: could not contact agent runtime.", error: true },
      ]);
    }
    setThinking(false);
  };

  const activeStage = estate?.stage || "ACTIVE";
  const stageIndex = STAGES.findIndex((s) => s.id === activeStage);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-10 md:py-8 font-sans">
      {/* ─── 1. TOP HEADER & PROTOCOL STATUS ─── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-[#C8E850]/15 border border-[#C8E850]/40 text-[#C8E850]">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight uppercase">WILLS</h1>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-xs bg-[#C8E850]/15 text-[#C8E850] border border-[#C8E850]/30 font-medium">
                Protocol v0.1
              </span>
              <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
                Base Sepolia Testnet
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              An Estate for Autonomous Agents · Heartbeat Gated · Liquidity Waterfall
            </p>
          </div>
        </div>

        {/* Wallet & Owner Info */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 bg-card/80 border border-border/60 px-3 py-1.5 rounded-sm">
            <span className="text-muted-foreground">Agent Wallet:</span>
            <span className="text-[#F2F1EC] font-semibold">
              {wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "No Wallet Yet"}
            </span>
            {wallet.address && (
              <button
                onClick={() => copyToClipboard(wallet.address!, "agent-addr")}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy Address"
              >
                {copied === "agent-addr" ? <Check className="h-3.5 w-3.5 text-[#C8E850]" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            {wallet.balance && (
              <span className="text-[#C8E850] ml-1">({wallet.balance})</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-card/80 border border-border/60 px-3 py-1.5 rounded-sm text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-[#C8E850] animate-pulse" />
            <span>Clock: <strong className="text-foreground">{estate?.now ? new Date(estate.now * 1000).toLocaleTimeString() : "--:--"}</strong></span>
          </div>
        </div>
      </header>

      {/* ─── 2. HERO: ESTATE LIFECYCLE TIMELINE ─── */}
      <section className="relative overflow-hidden rounded-md border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Autonomous Estate State Machine
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-xs text-xs font-mono font-bold uppercase",
                activeStage === "ACTIVE" && "bg-[#C8E850]/20 text-[#C8E850] border border-[#C8E850]/40",
                activeStage === "WARNING" && "bg-amber-500/20 text-amber-400 border border-amber-500/40",
                activeStage === "WINDING_DOWN" && "bg-rose-500/20 text-rose-400 border border-rose-500/40",
                activeStage === "EXECUTABLE" && "bg-purple-500/20 text-purple-400 border border-purple-500/40",
                activeStage === "SETTLED" && "bg-blue-500/20 text-blue-400 border border-blue-500/40"
              )}>
                ● {activeStage}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {activeStage === "ACTIVE" && "Full autonomous capabilities. Agent services briefs and accesses allowed tools."}
              {activeStage === "WARNING" && "Owner heartbeat threshold missed. Outbound allowance throttled to 25%."}
              {activeStage === "WINDING_DOWN" && "Critical lapse. New intake frozen. Unfinished briefs marked for automatic customer refund."}
              {activeStage === "EXECUTABLE" && "Timelock expired. Permissionless executeWill() can be triggered by anyone or keeper."}
              {activeStage === "SETTLED" && "Will executed. Residual vault balance partitioned to named heirs on-chain."}
            </p>
          </div>

          {/* Heartbeat Status & Countdown Ticker */}
          <div className="flex items-center gap-4 bg-background/80 border border-border/80 p-3 rounded-sm font-mono">
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Lapse Timer</div>
              <div className="text-lg font-bold text-foreground">
                {estate?.elapsed ?? 0}s <span className="text-xs font-normal text-muted-foreground">elapsed</span>
              </div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Next Stage Transition</div>
              <div className="text-lg font-bold text-[#C8E850]">
                {estate?.secondsUntilNext !== null ? `${estate?.secondsUntilNext}s` : "TERMINAL"}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Stage Progress Line */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {STAGES.map((s, idx) => {
            const isCurrent = s.id === activeStage;
            const isPast = idx < stageIndex;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex flex-col p-3 rounded-sm border transition-all duration-300 relative",
                  isCurrent ? `${s.bg} ${s.border} ring-1 ring-offset-0 ring-foreground/20` : "bg-card/40 border-border/40 opacity-70",
                  isPast && "border-border/60 bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={cn("text-xs font-mono font-bold tracking-wider", s.color)}>
                    {s.label}
                  </span>
                  {isCurrent && <span className="flex h-2 w-2 rounded-full bg-[#C8E850] animate-ping" />}
                  {isPast && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">{s.desc}</span>
              </div>
            );
          })}
        </div>

        {/* ─── 3. SIMULATION & HEARTBEAT CONTROLS ─── */}
        <div className="mt-5 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => triggerEstateAction("heartbeat")}
              disabled={actionLoading || estate?.isSettled}
              className="bg-[#C8E850] text-[#0A0A0A] hover:bg-[#C8E850]/90 font-bold px-4 py-2 text-xs uppercase tracking-wider font-mono flex items-center gap-2"
            >
              <Heart className="h-4 w-4 fill-current animate-pulse text-[#0A0A0A]" />
              Send Heartbeat ("I'm Alive")
            </Button>
            <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
              Resets lapse timer to 0s
            </span>
          </div>

          {/* Time Warp Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <FastForward className="h-3 w-3 text-[#C8E850]" /> Time Warp:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerEstateAction("warp", { seconds: 30 })}
              disabled={actionLoading}
              className="h-7 text-xs px-2.5 bg-background border-border/60 hover:bg-card"
            >
              +30s
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerEstateAction("warp", { seconds: 90 })}
              disabled={actionLoading}
              className="h-7 text-xs px-2.5 bg-background border-border/60 hover:bg-card text-amber-400"
            >
              +90s (Warning)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerEstateAction("warp", { seconds: 180 })}
              disabled={actionLoading}
              className="h-7 text-xs px-2.5 bg-background border-border/60 hover:bg-card text-rose-400"
            >
              +180s (Wind Down)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerEstateAction("warp", { seconds: 300 })}
              disabled={actionLoading}
              className="h-7 text-xs px-2.5 bg-background border-border/60 hover:bg-card text-purple-400"
            >
              +300s (Executable)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerEstateAction("reset")}
              disabled={actionLoading}
              className="h-7 text-xs px-2.5 bg-background border-border/60 hover:bg-card text-muted-foreground"
              title="Reset simulation to real-world clock"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>

            {activeStage === "EXECUTABLE" && !estate?.isSettled && (
              <Button
                size="sm"
                onClick={() => triggerEstateAction("executeWill")}
                disabled={actionLoading}
                className="h-7 text-xs px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold ml-1 animate-bounce"
              >
                <Zap className="h-3 w-3 mr-1 fill-current" /> Execute Will
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ─── 4. FINANCIAL ARCHITECTURE CARDS (4 METRICS) ─── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Vault Balance */}
        <Card className="bg-card/70 border-border/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Vault Estate (USDC)</span>
              <Shield className="h-4 w-4 text-[#C8E850]" />
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {estate?.vaultBalance.formatted || "25.00 USDC"}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] font-mono text-muted-foreground">
            Base Sepolia Smart Vault · On-Chain Reserves
          </CardContent>
        </Card>

        {/* Card 2: Operating Float */}
        <Card className="bg-card/70 border-border/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Agent Float (Hot Wallet)</span>
              <Wallet className="h-4 w-4 text-blue-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {estate?.agentFloat.formatted || "2.50 USDC"}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] font-mono text-muted-foreground">
            Allowance Pool · Working Capital
          </CardContent>
        </Card>

        {/* Card 3: Customer Earmark (Invariant I1) */}
        <Card className="bg-card/70 border-border/80 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-1 w-full bg-[#C8E850]" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1 text-[#C8E850] font-bold">
                <Lock className="h-3 w-3" /> Customer Earmark (I1)
              </span>
              <span className="text-[10px] text-muted-foreground uppercase">Protected</span>
            </div>
            <div className="font-mono text-2xl font-bold text-[#C8E850]">
              {estate?.earmarked.formatted || "1.20 USDC"}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] font-mono text-muted-foreground">
            Unearned client prepayments · Never spendable
          </CardContent>
        </Card>

        {/* Card 4: Allowance Remaining */}
        <Card className="bg-card/70 border-border/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Period Allowance</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {estate?.allowanceRemaining.formatted || "1.00 USDC"}
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] font-mono text-muted-foreground">
            {activeStage === "WARNING" ? "Throttled to 25% (0.25 USDC cap)" : "Draw limit per 60s period"}
          </CardContent>
        </Card>
      </section>

      {/* ─── 5. TWO-COLUMN WORKSPACE: JOBS & AGENT TERMINAL ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: STANDING BRIEFS (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-bold uppercase tracking-tight">Standing Briefs</h2>
              <Badge variant="outline" className="font-mono text-xs">
                {briefs.length} Active
              </Badge>
            </div>

            <Button
              size="sm"
              onClick={() => setShowNewBriefModal(!showNewBriefModal)}
              disabled={activeStage !== "ACTIVE"}
              className={cn(
                "h-7 text-xs font-mono uppercase font-bold",
                activeStage === "ACTIVE"
                  ? "bg-[#C8E850] text-[#0A0A0A] hover:bg-[#C8E850]/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              + Commission Brief
            </Button>
          </div>

          {/* Warning banner when intake is disabled */}
          {activeStage !== "ACTIVE" && (
            <div className="flex items-center gap-2 p-2.5 rounded-sm bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Intake frozen: Estate is in {activeStage}. Only ACTIVE agents accept briefs.</span>
            </div>
          )}

          {/* New Brief Commission Form Drawer */}
          {showNewBriefModal && (
            <div className="p-4 rounded-sm border border-border/80 bg-card/80 flex flex-col gap-3 font-mono text-xs">
              <div className="font-bold text-foreground">Commission a Standing Research Brief</div>
              <div>
                <label className="text-muted-foreground mb-1 block">Research Topic:</label>
                <Input
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Rollup Settlement Latencies"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-muted-foreground mb-1 block">Duration (Days):</label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={newDays}
                    onChange={(e) => setNewDays(Number(e.target.value))}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-muted-foreground mb-1 block">Upfront Price:</label>
                  <div className="h-8 flex items-center px-3 rounded-sm bg-muted/40 border border-border/40 font-bold text-[#C8E850]">
                    {(newDays * 0.1).toFixed(2)} USDC
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setShowNewBriefModal(false)} className="h-7 text-xs">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCommissionBrief} disabled={actionLoading} className="h-7 text-xs bg-[#C8E850] text-[#0A0A0A] font-bold">
                  Confirm & Prepay
                </Button>
              </div>
            </div>
          )}

          {/* List of Active Briefs */}
          <ScrollArea className="h-[480px] pr-2">
            <div className="flex flex-col gap-3">
              {briefs.map((brief) => {
                const pct = Math.round((brief.delivered / brief.totalDays) * 100);
                return (
                  <div
                    key={brief.id}
                    className="p-3.5 rounded-sm border border-border/60 bg-card/40 hover:bg-card/70 transition-all font-mono text-xs flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-foreground text-sm font-sans">{brief.topic}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Client: {brief.clientAddress.slice(0, 6)}...{brief.clientAddress.slice(-4)} · ID: {brief.id}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 uppercase">
                        {brief.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Delivery: {brief.delivered} of {brief.totalDays} Days ({pct}%)</span>
                        <span className="text-[#C8E850] font-bold">{brief.prepaidUSDC}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-[#C8E850] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Unearned Refund Reserve */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground">Refund if wound down:</span>
                      <span className="font-bold text-amber-400">{brief.refundIfCancelled}</span>
                    </div>

                    {/* Latest Digest Preview */}
                    {brief.latestDigest && (
                      <div className="p-2 rounded-xs bg-background/60 border border-border/40 text-[11px] text-muted-foreground">
                        <strong className="text-foreground">{brief.latestDigest.title}</strong>
                        <p className="line-clamp-2 mt-0.5">{brief.latestDigest.summary}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT COLUMN: AGENT CHAT & TOOL INSPECTOR (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#C8E850]" />
              <h2 className="font-heading text-lg font-bold uppercase tracking-tight">Wills Analyst Agent</h2>
              <span className="text-[11px] font-mono text-muted-foreground">Gemini Flash · Stage Gated</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([{ role: "agent", text: "Conversation history cleared. Ready for your prompt." }])}
              className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>

          {/* Stage-Gated Tool Authority Strip */}
          <div className="p-2.5 rounded-sm border border-border/60 bg-card/40 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="text-muted-foreground mr-1 flex items-center gap-1">
              <Terminal className="h-3.5 w-3.5 text-[#C8E850]" /> Tool Status:
            </span>
            {tools.map((t) => {
              const allowed = t.isAllowed;
              return (
                <span
                  key={t.name}
                  className={cn(
                    "px-2 py-0.5 rounded-xs flex items-center gap-1 transition-colors",
                    allowed
                      ? "bg-[#C8E850]/10 text-[#C8E850] border border-[#C8E850]/30"
                      : "bg-muted text-muted-foreground line-through opacity-60 border border-border/40"
                  )}
                  title={`${t.name}: ${t.description}`}
                >
                  {allowed ? <Unlock className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                  {t.name}
                </span>
              );
            })}
          </div>

          {/* Chat Messages Log */}
          <ScrollArea className="h-[430px] rounded-md border border-border/80 bg-background/80 p-4">
            <div className="flex flex-col gap-4 font-mono text-xs">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col gap-2 rounded-sm p-3 max-w-[90%]",
                    m.role === "user"
                      ? "self-end bg-[#C8E850]/15 border border-[#C8E850]/30 text-foreground"
                      : "self-start bg-card/90 border border-border/60 text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                    {m.role === "user" ? "You (Client / Principal)" : "Wills Analyst"}
                  </div>

                  <div className="whitespace-pre-wrap leading-relaxed font-sans text-sm">{m.text}</div>

                  {/* Tool execution steps */}
                  {m.steps && m.steps.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5 pt-2 border-t border-border/40">
                      {m.steps.map((s, stepIdx) => (
                        <div
                          key={stepIdx}
                          className="rounded-xs bg-background/90 p-2 border border-border/40 font-mono text-[11px]"
                        >
                          <div className="flex items-center justify-between text-muted-foreground mb-1">
                            <span className="text-[#C8E850] font-bold">⚡ tool: {s.tool}</span>
                            {s.error && <span className="text-rose-400 font-bold">FAILED / BLOCKED</span>}
                          </div>
                          {s.args && Object.keys(s.args).length > 0 && (
                            <div className="text-muted-foreground">
                              args: <span className="text-foreground">{JSON.stringify(s.args)}</span>
                            </div>
                          )}
                          <div className="text-muted-foreground mt-0.5">
                            result: <span className="text-foreground">{JSON.stringify(s.result)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {thinking && (
                <div className="self-start flex items-center gap-2 p-3 rounded-sm bg-card/80 border border-border/40 text-muted-foreground font-mono text-xs">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#C8E850]" />
                  <span>Agent analyzing estate parameters and tools...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Prompt Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <span className="text-muted-foreground mr-1">Try:</span>
            <button
              onClick={() => send("What is your current estate stage and funds?")}
              className="px-2 py-1 rounded-xs bg-card border border-border/60 hover:border-[#C8E850]/50 transition-colors text-foreground"
            >
              "What is your estate status?"
            </button>
            <button
              onClick={() => send("List all active standing briefs")}
              className="px-2 py-1 rounded-xs bg-card border border-border/60 hover:border-[#C8E850]/50 transition-colors text-foreground"
            >
              "List standing briefs"
            </button>
            <button
              onClick={() => send("What's the weather in Mumbai?")}
              className="px-2 py-1 rounded-xs bg-card border border-border/60 hover:border-[#C8E850]/50 transition-colors text-foreground"
            >
              "Get weather (outbound paid API)"
            </button>
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Wills Analyst about its estate, briefs, or tools..."
              disabled={thinking}
              className="bg-card border-border/80 font-mono text-xs h-10"
            />
            <Button
              type="submit"
              disabled={thinking || !input.trim()}
              className="bg-[#C8E850] text-[#0A0A0A] hover:bg-[#C8E850]/90 font-bold px-4 h-10"
            >
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* ─── 6. PROTOCOL WILL & HEIRS SPECIFICATION BAR ─── */}
      <footer className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-muted-foreground">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground uppercase">On-Chain Will Hash:</span>
          <span className="break-all text-[11px] bg-card p-2 rounded-xs border border-border/40">
            {estate?.willHash || "0x8fa4029283f5127efab01928374a5e01b443019d93a82745e7839201f8490a2c"}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground uppercase">Designated Heirs:</span>
          <div className="flex flex-col gap-1 text-[11px]">
            <span>1. Research Lab (0x7099...79C8): <strong>60% (6,000 bps)</strong></span>
            <span>2. Client Liquidity Pool (0x3C44...93BC): <strong>40% (4,000 bps)</strong></span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-bold text-foreground uppercase">Technical Honesty:</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Testnet demonstration on Base Sepolia. The system detects missed heartbeats, not biological death.
            Graceful degradation protects customer prepayments before on-chain settlement.
          </p>
        </div>
      </footer>
    </main>
  );
}
