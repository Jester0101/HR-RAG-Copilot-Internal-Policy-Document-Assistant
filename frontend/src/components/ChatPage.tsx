"use client";

import React, { useState, useEffect } from "react";
import { askQuestion } from "@/lib/api";
import type { Message, Source, MetricsSummary } from "@/lib/types";
import { MessageList } from "@/components/MessageList";
import { ChatInput } from "@/components/ChatInput";
import { Header } from "@/components/Header";
import { QuickStart } from "@/components/QuickStart";
import { StatsPanel } from "@/components/StatsPanel";
import { isInfoNotFoundResponse } from "@/lib/messageUtils";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function parseAnswerAndSources(answer: string, sources: Source[] = [], chunks: string[] = []) {
  const sourceLineMatch = answer.match(/Sources:\s*(.*)/i);
  const sourceLine = sourceLineMatch ? sourceLineMatch[0] : "";
  const cleanedAnswer = answer.replace(/^\s*Sources:.*$/gmi, "").trim();

  const matches = sourceLine
    ? Array.from(sourceLine.matchAll(/#?(\d+)/g)).map(m => Number(m[1])).filter(Boolean)
    : [];
  const uniqueIds = Array.from(new Set(matches));

  const sourcesWithIndex: Source[] = sources.map((s, idx) => ({
    ...s,
    index: idx + 1,
    chunk: chunks[idx] || "",
  }));

  const filteredSources = uniqueIds.length > 0
    ? sourcesWithIndex.filter(s => s.index && uniqueIds.includes(s.index))
    : sourcesWithIndex;

  return { cleanedAnswer, filteredSources };
}

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm the BluePeak HR assistant. Ask me about company policies, org structure, NDA, probation, vacation, and more.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MetricsSummary>({
    totalQueries: 0,
    avgResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    docCount: 0,
  });
  const [showQuickStart, setShowQuickStart] = useState(true);
  const [useHistory, setUseHistory] = useState(true);
  const [showHistoryInfo, setShowHistoryInfo] = useState(false);

  useEffect(() => {
    const handleQuickQuestion = (e: CustomEvent) => {
      setInput(e.detail);
      setShowQuickStart(false);
      setTimeout(() => {
        handleSend();
      }, 100);
    };

    window.addEventListener('quick-question', handleQuickQuestion as EventListener);
    return () => {
      window.removeEventListener('quick-question', handleQuickQuestion as EventListener);
    };
  }, []);

  useEffect(() => {
    // Скрыть QuickStart при начале ввода
    if (input.trim().length > 0) {
      setShowQuickStart(false);
    }
  }, [input]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_URL}/metrics`);
        if (!res.ok) return;
        const data = await res.json();
        setStats(prev => ({
          ...prev,
          cacheHits: data.cacheStats?.hits ?? prev.cacheHits,
          cacheMisses: data.cacheStats?.misses ?? prev.cacheMisses,
          docCount: data.docCount ?? prev.docCount,
        }));
      } catch (err) {
        console.error("Metrics fetch failed", err);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setError(null);
    setInput("");
    setShowQuickStart(false);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const startTime = Date.now();

    try {
      const historyPayload = useHistory
        ? [...messages, userMessage]
            .filter(m => (m.role === "user" || m.role === "assistant") && m.id !== "welcome")
            .map(m => ({ role: m.role, content: m.content }))
            .slice(-6)
        : [];

      const { answer, sources, chunks, suggestions, meta } = await askQuestion(question, historyPayload);
      
      const responseTime = Date.now() - startTime;
      setStats(prev => ({
        totalQueries: prev.totalQueries + 1,
        avgResponseTime: (prev.avgResponseTime * prev.totalQueries + responseTime) / (prev.totalQueries + 1),
        cacheHits: prev.cacheHits,
        cacheMisses: prev.cacheMisses,
        docCount: prev.docCount,
      }));

      const parsed = parseAnswerAndSources(answer, sources, chunks);
      const deduped = [];
      const seen = new Set<string>();
      for (const s of parsed.filteredSources) {
        if (seen.has(s.file)) continue;
        seen.add(s.file);
        deduped.push(s);
      }
      parsed.filteredSources = deduped;

      const isInfoNotFound = isInfoNotFoundResponse(parsed.cleanedAnswer) 
        || Boolean(meta?.weakSignal)
        || parsed.filteredSources.length === 0;

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: parsed.cleanedAnswer,
        sources: isInfoNotFound ? [] : parsed.filteredSources,
        chunks: isInfoNotFound ? [] : parsed.filteredSources.map(s => s.chunk || ""),
        isInfoNotFound,
        weakSignal: Boolean(meta?.weakSignal),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const suggestedQueries = suggestions?.suggestedQueries?.filter(Boolean) || [];

      if (isInfoNotFound && suggestedQueries.length) {
        const suggestionMessage: Message = {
          id: `assistant-suggest-${Date.now()}`,
          role: "assistant",
          content: "Try asking about:\n- " + suggestedQueries.join("\n- "),
          sources: [],
          chunks: [],
          isInfoNotFound: true,
        };
        setMessages((prev) => [...prev, suggestionMessage]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Unable to connect to the AI assistant. Please try again.");
      const errorMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: "I apologize, but I'm having trouble accessing the information right now. Please try your question again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen bg-black text-gray-100 flex flex-col relative overflow-hidden">
      <Header stats={stats} />
      
      <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 md:px-6 py-6 gap-6 min-h-0">
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            <MessageList messages={messages} loading={loading} />
            
            {showQuickStart && messages.length <= 1 && (
              <QuickStart />
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2 text-red-300">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">History</span>
                <button
                  type="button"
                  onClick={() => setUseHistory(prev => !prev)}
                  className={`relative w-14 h-7 rounded-full border border-white/20 transition-colors duration-300 ${useHistory ? "bg-white/10" : "bg-transparent"}`}
                  aria-pressed={useHistory}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-300 ${useHistory ? "right-0.5" : "left-0.5 bg-gray-600"}`}
                  />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowHistoryInfo(v => !v)}
                    className="w-6 h-6 rounded-full border border-white/20 text-xs text-gray-300 hover:text-white transition-colors"
                    aria-label="History help"
                  >
                    ?
                  </button>
                  {showHistoryInfo && (
                    <div className="absolute z-20 mt-2 w-64 text-xs text-gray-200 bg-black/90 border border-white/10 rounded-lg p-3 shadow-lg right-0">
                      When on, the last few chat turns are sent with your question so follow-ups stay on topic. Turn off to send single, stateless questions.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <ChatInput
              value={input}
              loading={loading}
              onChange={setInput}
              onSend={handleSend}
            />
          </div>
          
          <StatsPanel stats={stats} />
        </div>
      </main>

      <footer className="border-t border-white/10 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 text-center text-sm text-gray-400">
          <p>BluePeak AI Assistant v1.0 {new Date().getFullYear()}</p>
          <p className="mt-1">Answers are based on uploaded company documents and are for informational purposes only.</p>
        </div>
      </footer>
    </div>
  );
};
