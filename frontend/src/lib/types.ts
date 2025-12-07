

export type Role = "user" | "assistant";

export type Source = {
  file: string;
  docType: string;
  score: number;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: Source[];
  chunks?: string[];
};

export type AskResponse = {
  answer: string;
  chunks: string[];
  sources: Source[];
};
