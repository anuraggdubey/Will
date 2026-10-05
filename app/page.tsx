"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  FastForward,
  FileText,
  Heart,
  HelpCircle,
  Layers,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  SendHorizontal,
  Settings2,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
  Unlock,
  User,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Stage = "ACTIVE" | "WARNING" | "WINDING_DOWN" | "EXECUTABLE" | "SETTLED";
type NavigationTab = "chat" | "vault" | "briefs";

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

const STAGE_CONFIG: Record<
  Stage,
  { label: string; dotColor: string; badgeBg: string; badgeBorder: string; badgeText: string; description: string }
> = {
  ACTIVE: {
    label: "Active",
    dotColor: "bg-emerald-400",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/25",
    badgeText: "text-emerald-400",
    description: "Heartbeat healthy · Full operational autonomy",
  },
  WARNING: {
    label: "Warning",
    dotColor: "bg-amber-400",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/25",
    badgeText: "text-amber-400",
    description: "Missed heartbeat · Outbound spend throttled to 25%",
  },
  WINDING_DOWN: {
    label: "Winding Down",
    dotColor: "bg-rose-400",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/25",
    badgeText: "text-rose-400",
    description: "Owner lapse · Work frozen · Client refunds active",
  },
  EXECUTABLE: {
    label: "Executable",
    dotColor: "bg-violet-400",
    badgeBg: "bg-violet-500/10",
    badgeBorder: "border-violet-500/25",
    badgeText: "text-violet-400",
    description: "Timelock expired · Ready for permissionless settlement",
  },
  SETTLED: {
    label: "Settled",
    dotColor: "bg-sky-400",
    badgeBg: "bg-sky-500/10",
    badgeBorder: "border-sky-500/25",
    badgeText: "text-sky-400",
    description: "Will executed · Residual funds disbursed to heirs",
  },
};

export default function Home() {
  const [tab, setTab] = useState<NavigationTab>("chat");
  const [estate, setEstate] = useState<EstateData | null>(null);
  const [briefs, setBriefs] = useState<StandingBriefItem[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [wallet, setWallet] = useState<{ address: string | null; balance?: string }>({ address: null });
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      text: "I am the Wills Analyst, an autonomous intelligence operating with an on-chain estate on Base Sepolia.\n\nI deliver daily research briefs to paying clients, guarded by my owner's heartbeat. If my owner lapses, my spending throttles, new work freezes, and clients receive refunds before leftover assets flow to heirs.\n\nAsk me anything about my estate status, standing briefs, or research capabilities.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showBriefModal, setShowBriefModal] = useState(false);
  const [openStepIndices, setOpenStepIndices] = useState<Record<number, boolean>>({});

  // Brief creation form
  const [topicInput, setTopicInput] = useState("");
  const [daysInput, setDaysInput] = useState(7);

  const bottomRef = useRef<HTMLDivElement>(null);

  const loadEstate = async () => {
    try {
      const res = await fetch("/api/estate");
      if (res.ok) setEstate(await res.json());
    } catch {}
  };

  const loadBriefs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const d = await res.json();
        setBriefs(d.briefs || []);
      }
    } catch {}
  };

  const loadAgentStatus = async () => {
    try {
      const res = await fetch("/api/agent");
      if (res.ok) {
        const d = await res.json();
        setTools(d.tools || []);
      }
    } catch {}
  };

  const loadWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      if (res.ok) setWallet(await res.json());
    } catch {}
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

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const triggerAction = async (action: string, payload: any = {}) => {
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
    } catch {}
    setActionLoading(false);
  };

  const commissionBrief = async () => {
    if (!topicInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicInput, days: daysInput }),
      });
      if (res.ok) {
        setShowBriefModal(false);
        setTopicInput("");
        refreshAll();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to commission brief");
      }
    } catch {}
    setActionLoading(false);
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
        { role: "agent", text: "Connection error: failed to communicate with agent runtime.", error: true },
      ]);
    }
    setThinking(false);
  };

  const stage = estate?.stage || "ACTIVE";
  const stageInfo = STAGE_CONFIG[stage];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0E] text-slate-200 font-sans selection:bg-indigo-500/25 selection:text-white">
      {/* ─── LEFT SIDEBAR (Linear/Cursor Style) ─── */}
      <aside className="w-64 shrink-0 border-r border-white/[0.06] bg-[#0C0E14] flex flex-col justify-between p-4 z-20">
        <div className="flex flex-col gap-6">
          {/* Brand header */}
          <div className="flex items-center gap-2.5 px-2 pt-1">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="font-heading font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                WILLS
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white/[0.07] text-slate-400">
                  v0.1
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 text-xs font-medium">
            <button
              onClick={() => setTab("chat")}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all",
                tab === "chat"
                  ? "bg-white/[0.08] text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <MessageSquare className="h-4 w-4 text-indigo-400" />
              <span>Analyst Chat</span>
            </button>

            <button
              onClick={() => setTab("vault")}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all",
                tab === "vault"
                  ? "bg-white/[0.08] text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <Layers className="h-4 w-4 text-emerald-400" />
              <span>Estate Vault</span>
            </button>

            <button
              onClick={() => setTab("briefs")}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg transition-all",
                tab === "briefs"
                  ? "bg-white/[0.08] text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
              )}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-amber-400" />
                <span>Standing Briefs</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
                {briefs.length}
              </span>
            </button>
          </nav>

          {/* Quick Estate Status Card */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>LIFECYCLE</span>
              <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-mono", stageInfo.badgeBg, stageInfo.badgeBorder, stageInfo.badgeText)}>
                ● {stageInfo.label}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="text-[11px] text-slate-400">Vault Balance:</span>
              <span className="font-mono font-semibold text-white">{estate?.vaultBalance.formatted || "25.00 USDC"}</span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-slate-400">Next Stage in:</span>
              <span className="font-mono text-emerald-400 font-medium">
                {estate?.secondsUntilNext !== null ? `${estate?.secondsUntilNext}s` : "Terminal"}
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Heartbeat & Wallet */}
        <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.06]">
          {/* I'M ALIVE Button */}
          <Button
            onClick={() => triggerAction("heartbeat")}
            disabled={actionLoading || estate?.isSettled}
            className="w-full h-9 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Heart className="h-3.5 w-3.5 fill-current animate-pulse text-slate-950" />
            <span>I'm Alive (Heartbeat)</span>
          </Button>

          {/* Time Machine Popover Trigger */}
          <button
            onClick={() => setShowTimeModal(true)}
            className="w-full h-8 px-2.5 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-center gap-1.5 transition-colors"
          >
            <FastForward className="h-3 w-3 text-indigo-400" />
            <span>Simulation Time Warp</span>
          </button>

          {/* Agent Wallet EOA */}
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono text-slate-500">
            <span>Agent EOA:</span>
            <span className="text-slate-300">
              {wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "Testnet"}
            </span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#090A0E] relative">
        {/* Subtle Top Navbar */}
        <header className="h-14 shrink-0 border-b border-white/[0.06] flex items-center justify-between px-6 bg-[#090A0E]/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Base Sepolia Protocol</span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-medium text-slate-200">
              {tab === "chat" && "Autonomous Wills Analyst"}
              {tab === "vault" && "On-Chain Smart Vault & Heirs"}
              {tab === "briefs" && "Customer Standing Research Briefs"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 hidden sm:inline">{stageInfo.description}</span>
            {stage === "EXECUTABLE" && !estate?.isSettled && (
              <button
                onClick={() => triggerAction("executeWill")}
                className="px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs animate-pulse flex items-center gap-1 shadow-md shadow-violet-600/30"
              >
                <Zap className="h-3 w-3 fill-current" /> Settle Will
              </button>
            )}
          </div>
        </header>

        {/* ─── TAB 1: CHAT TERMINAL (Centered, clean, distraction-free) ─── */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full px-4 py-6 overflow-hidden">
            {/* Stage Warning Notification if Degraded */}
            {stage !== "ACTIVE" && (
              <div className={cn("mb-3 px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 shrink-0", stageInfo.badgeBg, stageInfo.badgeBorder, stageInfo.badgeText)}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Stage Constraint ({stage}):</strong> {stageInfo.description}
                  </span>
                </div>
                <button
                  onClick={() => triggerAction("heartbeat")}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium"
                >
                  Reset Clock
                </button>
              </div>
            )}

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col gap-1.5 max-w-[88%] text-xs leading-relaxed",
                    m.role === "user" ? "self-end items-end" : "self-start items-start"
                  )}
                >
                  <div className="text-[10px] font-mono text-slate-500 px-1">
                    {m.role === "user" ? "You" : "Wills Analyst"}
                  </div>

                  <div
                    className={cn(
                      "p-3.5 rounded-2xl whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-xs"
                        : "bg-white/[0.04] border border-white/[0.06] text-slate-200 rounded-bl-xs"
                    )}
                  >
                    {m.text}
                  </div>

                  {/* Clean Tool Execution Pill */}
                  {m.steps && m.steps.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      <button
                        onClick={() =>
                          setOpenStepIndices((prev) => ({ ...prev, [idx]: !prev[idx] }))
                        }
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono text-indigo-300 hover:bg-white/[0.06] transition-colors"
                      >
                        <Terminal className="h-3 w-3" />
                        <span>Executed {m.steps.length} tool {m.steps.length > 1 ? "calls" : "call"}</span>
                        {openStepIndices[idx] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>

                      {openStepIndices[idx] && (
                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col gap-1.5 text-[11px] font-mono text-slate-400">
                          {m.steps.map((s, sIdx) => (
                            <div key={sIdx}>
                              <div className="flex items-center justify-between text-indigo-400 font-semibold">
                                <span>⚡ {s.tool}</span>
                                {s.error && <span className="text-rose-400">Blocked</span>}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                {JSON.stringify(s.result)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {thinking && (
                <div className="self-start flex items-center gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span>Agent verifying estate authority and generating response...</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Bar */}
            <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2 shrink-0">
              {/* Quick Prompts */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-400 no-scrollbar">
                <span className="text-[10px] text-slate-500 uppercase mr-1">Suggestions:</span>
                <button
                  onClick={() => send("What is your current estate stage and funds?")}
                  className="px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 transition-colors whitespace-nowrap"
                >
                  "Check estate status"
                </button>
                <button
                  onClick={() => send("List active standing briefs")}
                  className="px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 transition-colors whitespace-nowrap"
                >
                  "List standing briefs"
                </button>
                <button
                  onClick={() => send("What's the weather in Mumbai?")}
                  className="px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-300 transition-colors whitespace-nowrap"
                >
                  "Test paid API"
                </button>
              </div>

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
                  className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-xs focus-visible:ring-indigo-500"
                />
                <Button
                  type="submit"
                  disabled={thinking || !input.trim()}
                  className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* ─── TAB 2: ESTATE VAULT (Financial Overview & Will) ─── */}
        {tab === "vault" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
            <div>
              <h2 className="font-heading text-xl font-bold text-white tracking-tight">Estate Vault & Governance</h2>
              <p className="text-xs text-slate-400 mt-1">
                The smart contract vault holds principal assets on Base Sepolia. Authority degrades automatically across five stages upon missed heartbeats.
              </p>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Vault Balance</span>
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-heading text-white">
                  {estate?.vaultBalance.formatted || "25.00 USDC"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Smart Vault on Base Sepolia</p>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Operating Float</span>
                  <Wallet className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold font-heading text-white">
                  {estate?.agentFloat.formatted || "2.50 USDC"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Agent Working Capital</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02]">
                <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Customer Earmark (I1)</span>
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-heading text-emerald-400">
                  {estate?.earmarked.formatted || "1.20 USDC"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Protected customer refund reserve</p>
              </div>
            </div>

            {/* 5-Stage Visual Progression */}
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-sm text-white">Lifecycle Degradation Stages</span>
                <span className="text-xs font-mono text-slate-400">Current: <strong className="text-white">{stage}</strong></span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {(["ACTIVE", "WARNING", "WINDING_DOWN", "EXECUTABLE", "SETTLED"] as Stage[]).map((s) => {
                  const isCurrent = s === stage;
                  const cfg = STAGE_CONFIG[s];
                  return (
                    <div
                      key={s}
                      className={cn(
                        "p-3 rounded-lg border text-xs flex flex-col gap-1 transition-all",
                        isCurrent ? `${cfg.badgeBg} ${cfg.badgeBorder} ring-1 ring-white/10` : "bg-white/[0.01] border-white/[0.04] opacity-50 text-slate-400"
                      )}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className={isCurrent ? cfg.badgeText : ""}>{cfg.label}</span>
                        {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{cfg.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* On-Chain Will & Heirs */}
            <div className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-sm text-white">On-Chain Will Specification</h3>
                <span className="text-[11px] font-mono text-slate-500">Immutable Hash</span>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.04] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Keccak256 Will Hash:</span>
                <span className="text-indigo-300 break-all">{estate?.willHash}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {estate?.heirs.map((heir, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="text-white">{heir.label || `Heir ${idx + 1}`}</span>
                      <span className="font-mono text-indigo-400">{(heir.bps / 100).toFixed(0)}% ({heir.bps} bps)</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 truncate">{heir.address}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: STANDING BRIEFS (Client Jobs & Refunds) ─── */}
        {tab === "briefs" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-xl font-bold text-white tracking-tight">Standing Research Briefs</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Clients prepay for daily autonomous digests. Undelivered portions are protected by Invariant I1 and auto-refunded upon wind-down.
                </p>
              </div>

              <Button
                onClick={() => setShowBriefModal(true)}
                disabled={stage !== "ACTIVE"}
                className={cn(
                  "h-9 px-4 rounded-xl text-xs font-semibold",
                  stage === "ACTIVE"
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-white/[0.04] text-slate-500 cursor-not-allowed"
                )}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Commission Brief
              </Button>
            </div>

            {/* List of Briefs */}
            <div className="flex flex-col gap-3">
              {briefs.map((b) => {
                const pct = Math.round((b.delivered / b.totalDays) * 100);
                return (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-all flex flex-col gap-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-heading font-semibold text-sm text-white">{b.topic}</h4>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Client: {b.clientAddress.slice(0, 6)}...{b.clientAddress.slice(-4)} · ID: {b.id}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono bg-white/[0.03]">
                        {b.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-mono">
                        <span>Progress: {b.delivered} of {b.totalDays} Days Delivered ({pct}%)</span>
                        <span className="text-white font-medium">{b.prepaidUSDC}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-[11px] font-mono">
                      <span className="text-slate-400">Refund reserve if wound down:</span>
                      <span className="text-emerald-400 font-bold">{b.refundIfCancelled}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ─── TIME WARP SIMULATION MODAL (Clean popover, not cluttering the screen!) ─── */}
      {showTimeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0E1118] p-5 shadow-2xl flex flex-col gap-4 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 font-heading font-bold text-sm text-white">
                <FastForward className="h-4 w-4 text-indigo-400" />
                <span>Simulation Time Warp</span>
              </div>
              <button onClick={() => setShowTimeModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-slate-400 font-sans leading-relaxed">
              Fast-forward simulated time to observe estate degradation across stages without waiting hours or days.
            </p>

            <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04] flex justify-between">
              <span className="text-slate-400">Current elapsed:</span>
              <span className="text-white font-bold">{estate?.elapsed ?? 0}s</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { triggerAction("warp", { seconds: 30 }); setShowTimeModal(false); }}
                className="h-9 text-xs border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07]"
              >
                +30s Step
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { triggerAction("warp", { seconds: 90 }); setShowTimeModal(false); }}
                className="h-9 text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              >
                +90s (Warning)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { triggerAction("warp", { seconds: 180 }); setShowTimeModal(false); }}
                className="h-9 text-xs border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
              >
                +180s (Wind Down)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { triggerAction("warp", { seconds: 300 }); setShowTimeModal(false); }}
                className="h-9 text-xs border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
              >
                +300s (Executable)
              </Button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => { triggerAction("reset"); setShowTimeModal(false); }}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset to Real Time
              </button>

              <Button size="sm" onClick={() => setShowTimeModal(false)} className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── COMMISSION BRIEF MODAL ─── */}
      {showBriefModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0E1118] p-5 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <h3 className="font-heading font-bold text-sm text-white">Commission a Standing Brief</h3>
              <button onClick={() => setShowBriefModal(false)} className="text-slate-400 hover:text-white font-mono">✕</button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-slate-400 mb-1 block">Topic:</label>
                <Input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Cross-Chain Relayer Latency on Base Sepolia"
                  className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-xs"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-slate-400 mb-1 block">Duration (Days):</label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={daysInput}
                    onChange={(e) => setDaysInput(Number(e.target.value))}
                    className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] text-xs font-mono"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-slate-400 mb-1 block">Prepaid Price:</label>
                  <div className="h-10 flex items-center px-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] font-mono text-emerald-400 font-bold">
                    {(daysInput * 0.1).toFixed(2)} USDC
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" onClick={() => setShowBriefModal(false)} className="h-8 rounded-lg text-slate-400">
                Cancel
              </Button>
              <Button size="sm" onClick={commissionBrief} disabled={actionLoading} className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                Confirm & Prepay
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
