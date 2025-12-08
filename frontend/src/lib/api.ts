
import { AskResponse } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function askQuestion(
  question: string,
  history?: { role: string; content: string }[]
): Promise<AskResponse> {
  const payload: Record<string, unknown> = { question };
  if (history && history.length > 0) {
    payload.history = history.map(({ role, content }) => ({ role, content }));
  }

  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  return {
    answer:
      typeof data.answer === "string"
        ? data.answer
        : String(data.answer ?? ""),
    chunks: data.chunks || [],
    sources: data.sources || [],
    suggestions: data.suggestions,
    meta: data.meta,
  };
}
