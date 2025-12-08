

export type Role = "user" | "assistant";

export type Source = {
  file: string;
  docType: string;
  rrfScore?: number;
  embeddingScore?: number;
  bm25Score?: number;
  index?: number;
  chunk?: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: Source[];
  chunks?: string[];
  suggestions?: string[];
  isInfoNotFound?: boolean;
  weakSignal?: boolean;
};

export type AskResponse = {
  answer: string;
  chunks: string[];
  sources: Source[];
  suggestions?: {
    suggestedQueries: string[];
    availableFiles: string[];
  };
  meta?: {
    cacheHitRate?: string | number;
    searchCount?: number;
    weakSignal?: boolean;
  };
};

export type MetricsSummary = {
  totalQueries: number;
  avgResponseTime: number;
  cacheHits: number;
  cacheMisses: number;
  docCount: number;
  chunkCount?: number;
  cacheHitRate?: string | number;
};
