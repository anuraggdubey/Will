"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  FastForward,
  FileText,
  Heart,
  HelpCircle,
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
type ActiveTab = "chat" | "vault" | "briefs";

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

const STAGES_META: Record<
  Stage,
  { label: string; badge: string; border: string; glow: string; desc: string }
> = {
  ACTIVE: {
    label: "Active",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    border: "border-emerald-500/40",
    glow: "shadow-emerald-500/10",
    desc: "Full autonomy · Accepting briefs & servicing digests",
  },
  WARNING: {
    label: "Warning",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-amber-500/40",
    glow: "shadow-amber-500/10",
    desc: "Missed heartbeat · Outbound allowance throttled to 25%",
  },
  WINDING_DOWN: {
    label: "Winding Down",
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    border: "border-rose-500/40",
    glow: "shadow-rose-500/10",
    desc: "Critical lapse · Intake frozen · Auto-refunds active",
  },
  EXECUTABLE: {
    label: "Executable",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    border: "border-purple-500/40",
    glow: "shadow-purple-500/10",
    desc: "Timelock reached · Permissionless executeWill() ready",
  },
  SETTLED: {
    label: "Settled",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    border: "border-blue-500/40",
    glow: "shadow-blue-500/10",
    desc: "Will executed · Residual funds partitioned to heirs",
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [estate, setEstate] = useState<EstateData | null>(null);
  const [briefs, setBriefs] = useState<StandingBriefItem[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [wallet, setWallet] = useState<{ address: string | null; balance?: string }>({ address: null });
  const [showWarpDrawer, setShowWarpDrawer] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      text: "Hello. I am the Wills Analyst, an autonomous research agent operating under an on-chain estate. My funds sit in a smart vault on Base Sepolia gated by my owner's heartbeat. If my owner goes silent, my spending throttles, new work freezes, and clients receive refunds before leftover assets flow to heirs. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // New brief state
  const [newTopic, setNewTopic] = useState("");
  const [newDays, setNewDays] = useState(7);

  const bottomRef = useRef<HTMLDivElement>(null);

  const loadEstate = async () => {
    try {
      const res = await fetch("/api/estate");
      if (res.ok) setEstate(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadBriefs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const d = await res.json();
        setBriefs(d.briefs || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAgentStatus = async () => {
    try {
      const res = await fetch("/api/agent");
      if (res.ok) {
        const d = await res.json();
        setTools(d.tools || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadWallet = async () => {
    try {
      const res = await fetch("/api/wallet");
      if (res.ok) setWallet(await res.json());
    } catch (e) {
      console.error(e);
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

  const copyText = (text: string, id: string) => {
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
    } catch (e) {
      console.error(e);
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
        setShowCommissionModal(false);
        setNewTopic("");
        refreshAll();
      } else {
        const err = await res.json();
        alert(err.error || "Failed");
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

  const stage = estate?.stage || "ACTIVE";
  const stageMeta = STAGES_META[stage];

  return (
    <div className="min-h-screen text-slate-100 flex flex-col justify-between selection:bg-indigo-500/20">
      {/* ─── TOP NAVBAR (Clean, uncluttered, focused) ─── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0B0D13]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Status */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-base tracking-tight text-white">WILLS</span>
                <span className={cn("text-[11px] font-mono px-2 py-0.5 rounded-full border", stageMeta.badge)}>
                  ● {stageMeta.label}
                </span>
              </div>
            </div>
          </div>

          {/* Center Tabs: Clear Segregation of Concerns */}
          <nav className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/[0.06] text-xs font-medium">
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all",
                activeTab === "chat" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Analyst Chat</span>
            </button>
            <button
              onClick={() => setActiveTab("vault")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all",
                activeTab === "vault" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Estate Vault</span>
            </button>
            <button
              onClick={() => setActiveTab("briefs")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all",
                activeTab === "briefs" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Standing Briefs ({briefs.length})</span>
            </button>
          </nav>

          {/* Right Action: Heartbeat & Time Drawer */}
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => triggerAction("heartbeat")}
              disabled={actionLoading || estate?.isSettled}
              size="sm"
              className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Heart className="h-3.5 w-3.5 fill-current animate-pulse text-slate-950" />
              <span className="hidden sm:inline">I'm Alive</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWarpDrawer(!showWarpDrawer)}
              className={cn(
                "h-8 px-2.5 rounded-lg text-xs border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 flex items-center gap-1.5",
                showWarpDrawer && "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
              )}
              title="Time Machine / Fast-Forward Simulation"
            >
              <FastForward className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden md:inline">Time Warp</span>
            </Button>
          </div>
        </div>

        {/* ─── TIME WARP DRAWER (Clean popdown for testing stage machine) ─── */}
        {showWarpDrawer && (
          <div className="border-t border-white/[0.06] bg-slate-950/95 py-3 px-4 backdrop-blur-2xl">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-400">
                <FastForward className="h-3.5 w-3.5 text-indigo-400" />
                <span>Simulate Owner Inaction:</span>
                <span className="text-slate-200">Elapsed {estate?.elapsed ?? 0}s</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => triggerAction("warp", { seconds: 30 })}
                  className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.06]"
                >
                  +30s
                </button>
                <button
                  onClick={() => triggerAction("warp", { seconds: 90 })}
                  className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                >
                  +90s (Warning)
                </button>
                <button
                  onClick={() => triggerAction("warp", { seconds: 180 })}
                  className="px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
                >
                  +180s (Wind Down)
                </button>
                <button
                  onClick={() => triggerAction("warp", { seconds: 300 })}
                  className="px-2.5 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30"
                >
                  +300s (Executable)
                </button>
                <button
                  onClick={() => triggerAction("reset")}
                  className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 border border-white/[0.06] flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>

                {stage === "EXECUTABLE" && !estate?.isSettled && (
                  <button
                    onClick={() => triggerAction("executeWill")}
                    className="px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1 shadow-lg shadow-purple-600/30 animate-pulse"
                  >
                    <Zap className="h-3 w-3 fill-current" /> Execute Will
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── STAGE PROGRESS STRIP (Sleek, minimal, informative) ─── */}
      <div className="border-b border-white/[0.06] bg-slate-900/30 py-2 px-4 text-xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-mono">Stage:</span>
            <span className="font-medium text-slate-200">{stageMeta.desc}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            {estate?.secondsUntilNext !== null ? (
              <span>Next transition in: <strong className="text-white">{estate?.secondsUntilNext}s</strong></span>
            ) : (
              <span className="text-purple-400">Terminal stage reached</span>
            )}
            <span>·</span>
            <span>Vault: <strong className="text-emerald-400">{estate?.vaultBalance.formatted}</strong></span>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT VIEW (Tabs switch gracefully) ─── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col">
        {/* ========================================================================= */}
        {/* TAB 1: AGENT CHAT (Minimalist, elegant, conversational focus)             */}
        {/* ========================================================================= */}
        {activeTab === "chat" && (
          <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full gap-4">
            {/* Stage Warning Notification if not Active */}
            {stage !== "ACTIVE" && (
              <div
                className={cn(
                  "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all",
                  stageMeta.badge
                )}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Stage Constraint ({stage}):</strong> {stageMeta.desc}
                  </span>
                </div>
                <button
                  onClick={() => triggerAction("heartbeat")}
                  className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium shrink-0"
                >
                  Send Heartbeat
                </button>
              </div>
            )}

            {/* Chat Conversation Scroll Area */}
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/40 p-4 sm:p-6 flex-1 min-h-[500px] flex flex-col justify-between">
              <div className="flex flex-col gap-5 overflow-y-auto max-h-[540px] pr-2">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-col gap-2 rounded-2xl p-4 max-w-[85%] text-sm leading-relaxed",
                      m.role === "user"
                        ? "self-end bg-indigo-600/90 text-white rounded-br-xs shadow-md shadow-indigo-600/10"
                        : "self-start bg-white/[0.04] border border-white/[0.07] text-slate-200 rounded-bl-xs"
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono opacity-60">
                      <span>{m.role === "user" ? "You" : "Wills Analyst"}</span>
                      {m.steps && m.steps.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className="hover:opacity-100 flex items-center gap-1 text-indigo-300"
                        >
                          <span>{m.steps.length} tool {m.steps.length > 1 ? "calls" : "call"}</span>
                          {expandedSteps[idx] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </div>

                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {/* Collapsible Tool Execution Details */}
                    {m.steps && m.steps.length > 0 && expandedSteps[idx] && (
                      <div className="mt-2 pt-2 border-t border-white/[0.08] flex flex-col gap-2 font-mono text-xs">
                        {m.steps.map((s, stepIdx) => (
                          <div key={stepIdx} className="bg-black/30 p-2 rounded-lg border border-white/[0.05]">
                            <div className="flex items-center justify-between text-indigo-300 font-bold mb-1">
                              <span>⚡ {s.tool}</span>
                              {s.error && <span className="text-rose-400">Blocked / Failed</span>}
                            </div>
                            <div className="text-[11px] text-slate-400 break-all">
                              {JSON.stringify(s.result)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {thinking && (
                  <div className="self-start flex items-center gap-2.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                    <span>Analyst evaluating estate stage & tools...</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Chat Input & Suggested Prompts */}
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-col gap-2.5">
                {/* Clean Prompt Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-[11px] mr-1">Ask:</span>
                  <button
                    onClick={() => send("What is your current estate stage and funds?")}
                    className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 transition-colors"
                  >
                    "What's your estate status?"
                  </button>
                  <button
                    onClick={() => send("List all active standing briefs and client balances")}
                    className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 transition-colors"
                  >
                    "Show standing briefs"
                  </button>
                  <button
                    onClick={() => send("What's the weather in Mumbai?")}
                    className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 transition-colors"
                  >
                    "Test paid weather API"
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
                    placeholder="Ask the Wills Analyst anything..."
                    disabled={thinking}
                    className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-sm focus-visible:ring-indigo-500"
                  />
                  <Button
                    type="submit"
                    disabled={thinking || !input.trim()}
                    className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    <SendHorizontal className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ESTATE VAULT (Financial metrics & on-chain wills)                  */}
        {/* ========================================================================= */}
        {activeTab === "vault" && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Vault Estate</span>
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-heading text-white">
                  {estate?.vaultBalance.formatted || "25.00 USDC"}
                </div>
                <p className="text-xs text-slate-400 mt-1">Smart Vault on Base Sepolia</p>
              </div>

              <div className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Operating Float</span>
                  <Wallet className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold font-heading text-white">
                  {estate?.agentFloat.formatted || "2.50 USDC"}
                </div>
                <p className="text-xs text-slate-400 mt-1">Agent Hot Wallet Balance</p>
              </div>

              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] backdrop-blur-xl">
                <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Customer Earmark (I1)</span>
                  <Lock className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-heading text-emerald-400">
                  {estate?.earmarked.formatted || "1.20 USDC"}
                </div>
                <p className="text-xs text-slate-400 mt-1">Guaranteed client refund reserve</p>
              </div>
            </div>

            {/* Heartbeat Status & Lifecycle Visualizer */}
            <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-heading font-bold text-lg text-white">Owner Heartbeat Mechanism</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    The agent monitors the owner's liveness on-chain. If heartbeats cease, the estate degrades automatically.
                  </p>
                </div>
                <Button
                  onClick={() => triggerAction("heartbeat")}
                  disabled={actionLoading || estate?.isSettled}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 rounded-xl text-xs h-9 flex items-center gap-2"
                >
                  <Heart className="h-4 w-4 fill-current animate-pulse text-slate-950" />
                  Send Heartbeat ("I'm Alive")
                </Button>
              </div>

              {/* 5 Stage Progress */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {(["ACTIVE", "WARNING", "WINDING_DOWN", "EXECUTABLE", "SETTLED"] as Stage[]).map((s) => {
                  const isCurrent = s === stage;
                  const meta = STAGES_META[s];
                  return (
                    <div
                      key={s}
                      className={cn(
                        "p-3 rounded-xl border text-xs transition-all",
                        isCurrent
                          ? `${meta.badge} ring-1 ring-white/20 font-bold`
                          : "bg-white/[0.02] border-white/[0.05] text-slate-400 opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span>{meta.label}</span>
                        {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />}
                      </div>
                      <p className="text-[11px] font-normal text-slate-400 leading-tight">{meta.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* On-Chain Will & Heirs Allocation */}
            <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] flex flex-col gap-4">
              <div>
                <h3 className="font-heading font-bold text-lg text-white">On-Chain Will & Heirs Specification</h3>
                <p className="text-xs text-slate-400">
                  When settled, leftover funds are trustlessly distributed according to these signed basis points.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
                <span className="text-slate-400">Will Hash (Keccak256):</span>
                <span className="text-indigo-300 break-all">{estate?.willHash}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {estate?.heirs.map((heir, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{heir.label || `Heir ${idx + 1}`}</span>
                      <span className="text-indigo-400 font-mono font-bold">{(heir.bps / 100).toFixed(0)}% ({heir.bps} bps)</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 truncate">{heir.address}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: STANDING BRIEFS (Client Jobs, Delivery & Refund Reserves)          */}
        {/* ========================================================================= */}
        {activeTab === "briefs" && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <h2 className="font-heading font-bold text-xl text-white">Client Standing Briefs</h2>
                <p className="text-xs text-slate-400">
                  Prepaid daily research digests. Unearned remainder is protected by Invariant I1 and automatically refunded upon wind-down.
                </p>
              </div>
              <Button
                onClick={() => setShowCommissionModal(true)}
                disabled={stage !== "ACTIVE"}
                className={cn(
                  "h-9 px-4 rounded-xl text-xs font-semibold",
                  stage === "ACTIVE"
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "bg-white/[0.05] text-slate-500 cursor-not-allowed"
                )}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Commission Brief
              </Button>
            </div>

            {/* Modal Drawer to Commission Brief */}
            {showCommissionModal && (
              <div className="p-5 rounded-2xl border border-indigo-500/30 bg-slate-900/90 backdrop-blur-xl flex flex-col gap-4 text-xs">
                <h3 className="font-heading font-bold text-base text-white">Commission a Standing Research Brief</h3>
                <div>
                  <label className="text-slate-400 mb-1 block">Topic:</label>
                  <Input
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="e.g. Base Sepolia Cross-Chain Relayer Latency"
                    className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-slate-400 mb-1 block">Duration (Days):</label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={newDays}
                      onChange={(e) => setNewDays(Number(e.target.value))}
                      className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-slate-400 mb-1 block">Prepaid Price (0.10 USDC/day):</label>
                    <div className="h-10 flex items-center px-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] font-mono text-emerald-400 font-bold">
                      {(newDays * 0.1).toFixed(2)} USDC
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCommissionModal(false)}
                    className="h-8 rounded-lg text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCommissionBrief}
                    disabled={actionLoading}
                    className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    Confirm & Prepay
                  </Button>
                </div>
              </div>
            )}

            {/* List of Briefs */}
            <div className="grid grid-cols-1 gap-4">
              {briefs.map((b) => {
                const pct = Math.round((b.delivered / b.totalDays) * 100);
                return (
                  <div
                    key={b.id}
                    className="p-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.03] transition-all flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-heading font-bold text-base text-white">{b.topic}</h4>
                        <span className="text-xs font-mono text-slate-400">
                          Client: {b.clientAddress.slice(0, 6)}...{b.clientAddress.slice(-4)} · ID: {b.id}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono uppercase bg-white/[0.04]">
                        {b.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-mono">
                        <span>Progress: {b.delivered} of {b.totalDays} Days Delivered ({pct}%)</span>
                        <span className="text-white font-semibold">{b.prepaidUSDC}</span>
                      </div>
                      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs font-mono">
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

      {/* ─── MINIMAL FOOTER ─── */}
      <footer className="border-t border-white/[0.06] py-4 px-4 text-center text-xs text-slate-500 font-mono">
        <span>WILLS · Autonomous Agent Estate Protocol · Base Sepolia Testnet</span>
      </footer>
    </div>
  );
}
