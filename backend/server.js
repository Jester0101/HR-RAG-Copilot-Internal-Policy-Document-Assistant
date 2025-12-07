import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";

// ===== BM25 Implementation =====
class BM25 {
  constructor(documents, k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.documents = documents;
    this.docCount = documents.length;
    this.avgDocLength = 0;
    this.docLengths = [];
    this.idf = {};
    this.tokenizedDocs = [];
    
    this._buildIndex();
  }

  _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  _buildIndex() {
    // Tokenize all documents
    this.tokenizedDocs = this.documents.map(doc => this._tokenize(doc));
    
    // Calculate document lengths
    this.docLengths = this.tokenizedDocs.map(tokens => tokens.length);
    this.avgDocLength = this.docLengths.reduce((a, b) => a + b, 0) / this.docCount;
    
    // Calculate IDF for each term
    const docFreq = {};
    this.tokenizedDocs.forEach(tokens => {
      const uniqueTokens = [...new Set(tokens)];
      uniqueTokens.forEach(token => {
        docFreq[token] = (docFreq[token] || 0) + 1;
      });
    });
    
    // IDF formula: log((N - df + 0.5) / (df + 0.5) + 1)
    for (const term in docFreq) {
      const df = docFreq[term];
      this.idf[term] = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);
    }
  }

  search(query, topN = 80) {
    const queryTokens = this._tokenize(query);
    const scores = [];

    for (let i = 0; i < this.docCount; i++) {
      let score = 0;
      const docLength = this.docLengths[i];
      const docTokens = this.tokenizedDocs[i];
      
      // Count term frequencies in document
      const termFreq = {};
      docTokens.forEach(token => {
        termFreq[token] = (termFreq[token] || 0) + 1;
      });

      // Calculate BM25 score
      queryTokens.forEach(term => {
        if (term in this.idf) {
          const tf = termFreq[term] || 0;
          const idf = this.idf[term];
          const normalization = 1 - this.b + this.b * (docLength / this.avgDocLength);
          score += idf * (tf * (this.k1 + 1)) / (tf + this.k1 * normalization);
        }
      });

      scores.push({ index: i, score });
    }

    // Sort by score and return top N
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topN);
  }
}

// ===== SETTINGS =====
const DATA_DIR = "./data";
const PORT = 3001;
const MODEL_NAME = "gpt-4o-mini";
const BM25_CANDIDATES = 80; // Number of candidates from BM25
const FINAL_RESULTS = 20;   // Final results after rerank

const app = express();
app.use(cors());
app.use(express.json());

// ===== DOC TYPE DETECTION =====
function detectDocType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("policies") || lower.includes("manual")) return "HR_POLICY";
  if (lower.includes("handbook")) return "EMPLOYEE_HANDBOOK";
  if (lower.includes("job")) return "JOB_DESCRIPTIONS";
  if (lower.includes("org") && lower.includes("chart")) return "ORG_CHART";
  if (lower.includes("onboarding")) return "ONBOARDING";
  if (lower.includes("exit")) return "EXIT";
  if (lower.includes("contract")) return "CONTRACT";
  if (lower.includes("nda")) return "NDA";
  return "OTHER";
}

// ===== DETECT ORG CHART QUERIES =====
// Единственная оставшаяся keyword-проверка для спец-режима ORG_CHART
function isOrgChartQuery(question) {
  const q = question.toLowerCase();
  const orgKeywords = [
    "job", "jobs", "role", "roles", "position", "positions",
    "org chart", "organizational chart", "organization chart",
    "structure", "organizational structure", "department", "departments",
    "team", "teams", "what type of jobs", "list of jobs",
    "list roles", "types of jobs", "who reports to"
  ];
  return orgKeywords.some(key => q.includes(key));
}

// ===== COSINE SIMILARITY =====
function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===== BUILD VECTOR INDEX WITH BM25 =====
async function buildVectorIndex() {
  console.log("📄 Loading documents from:", DATA_DIR);
  const files = fs.readdirSync(DATA_DIR);
  const rawDocs = [];

  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".txt")) continue;
    const fullPath = path.join(DATA_DIR, file);
    const text = fs.readFileSync(fullPath, "utf8");
    rawDocs.push({
      pageContent: text,
      metadata: {
        sourceFile: file,
        docType: detectDocType(file),
      },
    });
  }

  console.log(`📚 Loaded ${rawDocs.length} documents. Splitting...`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 900,
    chunkOverlap: 150,
  });

  const docs = await splitter.splitDocuments(rawDocs);
  console.log(`🧩 Total chunks: ${docs.length}`);

  // Build BM25 index
  console.log("🔍 Building BM25 index...");
  const bm25Texts = docs.map(d => d.pageContent);
  const bm25Index = new BM25(bm25Texts);
  console.log("✅ BM25 index ready");

  // Compute embeddings
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("🧠 Computing embeddings...");
  const vectors = await embeddings.embedDocuments(bm25Texts);

  const vectorIndex = docs.map((doc, i) => ({
    embedding: vectors[i],
    pageContent: doc.pageContent,
    metadata: doc.metadata,
  }));

  console.log("✅ Vector index ready");

  return { bm25Index, vectorIndex, embeddings, docs };
}

const indexPromise = buildVectorIndex();

// ===== HYBRID SEARCH FUNCTION =====
async function hybridSearch(question, filterFn, { bm25Index, vectorIndex, embeddings }) {
  // Step 1: Get candidates from BM25
  console.log(`🔍 BM25 search for top ${BM25_CANDIDATES} candidates...`);
  const bm25Results = bm25Index.search(question, BM25_CANDIDATES);
  
  // Filter candidates by docType if needed (only for ORG_CHART special mode)
  let candidates = bm25Results;
  if (filterFn) {
    candidates = bm25Results.filter(result => {
      const doc = vectorIndex[result.index];
      return filterFn(doc);
    });
    console.log(`🎯 Filtered to ${candidates.length} candidates by docType`);
  }

  if (candidates.length === 0) {
    console.log("⚠️ No candidates after filtering");
    return [];
  }

  // Step 2: Rerank with embeddings (semantic similarity)
  console.log("🧠 Reranking with embeddings...");
  const queryEmbedding = await embeddings.embedQuery(question);
  
  const reranked = candidates.map(candidate => {
    const doc = vectorIndex[candidate.index];
    const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
    return {
      pageContent: doc.pageContent,
      metadata: doc.metadata,
      score: similarity,
      bm25Score: candidate.score,
    };
  });

  // Sort by cosine similarity (embeddings decide relevance)
  reranked.sort((a, b) => b.score - a.score);

  // Return top results
  return reranked.slice(0, FINAL_RESULTS);
}

// ===== /ask ENDPOINT =====
app.post("/ask", async (req, res) => {
  try {
    const question = req.body.question;
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required" });
    }

    const indexData = await indexPromise;
    let results;

    // ===== SPECIAL MODE: ORG_CHART =====
    // Единственный случай, когда мы используем keyword-фильтрацию
    if (isOrgChartQuery(question)) {
      console.log("🏢 Org-chart query detected. Searching ORG_CHART docs first...");
      
      // Try hybrid search with ORG_CHART filter
      results = await hybridSearch(
        question,
        doc => doc.metadata.docType === "ORG_CHART",
        indexData
      );

      // Fallback if no results
      if (results.length === 0) {
        console.log("⚠️ No ORG_CHART results, falling back to full hybrid search");
        results = await hybridSearch(question, null, indexData);
      }
    } else {
      // ===== NORMAL MODE: PURE HYBRID SEARCH =====
      // Никаких keyword-фильтров! BM25 + embeddings сами найдут релевантные документы
      console.log("🔍 Running full hybrid search (BM25 + embeddings)...");
      results = await hybridSearch(question, null, indexData);
    }

    // ===== BUILD CONTEXT =====
    const contextBlocks = results.map((doc, idx) => {
      const preview = doc.pageContent.slice(0, 500).replace(/\s+/g, " ");
      return `[#${idx + 1}] SOURCE_FILE: ${doc.metadata.sourceFile} | DOC_TYPE: ${doc.metadata.docType}\n${preview}`;
    });

    const context = contextBlocks.join("\n\n");

    // ===== CALL LLM =====
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: MODEL_NAME,
      temperature: 0,
    });

    const prompt = `You are an internal HR assistant for BluePeak Creative Group.

Your job:
1) Understand the employee's question.
2) Carefully read the CONTEXT below (these are snippets from company documents).
3) Answer ONLY based on the information in the CONTEXT.

Mandatory rules:
- Never use outside knowledge or assumptions.
- Do NOT invent or guess policies, numbers, or missing details.
- If the answer is not clearly and explicitly supported by the CONTEXT, or the information is incomplete, reply exactly: "Information not found in company documents."
- If multiple snippets disagree or are ambiguous, reply: "Information not found in company documents."

LIST QUESTIONS (roles, jobs, departments, org chart, benefits, steps, items):
- Extract ALL items that appear in the CONTEXT — never partial.
- Group items by department or manager when possible.
- Do NOT summarise as "various roles". List them explicitly.

POLICY QUESTIONS:
- Summarise clearly using bullet points.
- Include exact conditions, limits, and numbers found in CONTEXT.
- Do NOT infer missing information.

Formatting:
- Answer in clear, professional English.
- Use short paragraphs or bullet points.
- At the end write: "Sources: [#X], [#Y]".

CONTEXT:
${context}

QUESTION: ${question}`.trim();

    const response = await model.invoke(prompt);

    res.json({
      answer: response.content,
      chunks: contextBlocks,
      sources: results.map(doc => ({
        file: doc.metadata.sourceFile,
        docType: doc.metadata.docType,
        score: doc.score,
        bm25Score: doc.bm25Score,
      })),
    });
  } catch (err) {
    console.error("❌ Error in /ask:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});