
import { AskResponse } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function askQuestion(question: string): Promise<AskResponse> {
  const res = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
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
  };
}
