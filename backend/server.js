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
    const stopWords = new Set([
      "the","a","an","and","or","but","if","to","of","in","on","for","with","as","at",
      "by","from","this","that","these","those","is","are","was","were","be","been",
      "it","its","he","she","they","them","we","you","your","our","their","i","me",
      "my","mine","ours","yours","theirs","about","into","over","under","up","down",
      "so","no","not","can","could","would","should","do","does","did"
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 2 && !stopWords.has(token));
  }

  _buildIndex() {
    this.tokenizedDocs = this.documents.map(doc => this._tokenize(doc));
    this.docLengths = this.tokenizedDocs.map(tokens => tokens.length);
    this.avgDocLength = this.docLengths.reduce((a, b) => a + b, 0) / this.docCount;
    
    const docFreq = {};
    this.tokenizedDocs.forEach(tokens => {
      const uniqueTokens = [...new Set(tokens)];
      uniqueTokens.forEach(token => {
        docFreq[token] = (docFreq[token] || 0) + 1;
      });
    });
    
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
      
      const termFreq = {};
      docTokens.forEach(token => {
        termFreq[token] = (termFreq[token] || 0) + 1;
      });

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

    scores.sort((a, b) => b.score - a.score);

    console.log('[BM25] top results', scores.slice(0, 5).map(r => ({
      index: r.index,
      score: r.score,
      preview: this.documents[r.index]?.slice(0, 80)
    })));
    return scores.slice(0, topN);
  }
}




// ===== QUERY CACHE =====
class QueryCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const normalized = key.toLowerCase().trim();
    const has = this.cache.has(normalized);
    console.log("[CACHE GET]", {
      raw: key,
      normalized,
      hit: has,
    });

    if (has) {
      this.hits++;
      return this.cache.get(normalized);
    }
    this.misses++;
    return null;
  }

  set(key, value) {
    const normalized = key.toLowerCase().trim();
    console.log("[CACHE SET]", {
      raw: key,
      normalized,
    });

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(normalized, value);
  }

  getHitRate() {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total * 100).toFixed(2) : 0;
  }
}



// ===== SEMANTIC RETRIEVAL CACHE =====
class SemanticRetrievalCache {
  constructor(maxSize = 100) {
    this.entries = [];
    this.maxSize = maxSize;
  }

  // entry: { embedding: number[], question: string, expandedQuery: string, results: any[] }
  findSimilar(queryEmbedding, similarityFn, threshold = 0.70) {
    if (this.entries.length === 0) return null;

    let best = null;
    let bestScore = -1;

    for (const entry of this.entries) {
      const score = similarityFn(queryEmbedding, entry.embedding);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (bestScore >= threshold) {
      console.log("[SemanticCache] HIT", { bestScore, question: best.question });
      return best;
    }

    console.log("[SemanticCache] MISS", { bestScore });
    return null;
  }

  add(entry) {
    if (this.entries.length >= this.maxSize) {
      this.entries.shift(); // simple FIFO
    }
    this.entries.push(entry);
  }
}


// ===== SETTINGS =====
const DATA_DIR = "./data";
const PORT = 3001;
const MODEL_NAME = "gpt-4o-mini";
const BM25_CANDIDATES = 50;
const FINAL_RESULTS = 5;
const RRF_K = 10;
let docCount = 0;
let chunkCount = 0;

const app = express();
app.use(cors());
app.use(express.json());

const embeddingCache = new QueryCache(500);
const semanticRetrievalCache = new SemanticRetrievalCache(100);

const metrics = {
  searches: 0,
  totalLatency: 0,
  avgScores: [],
  cacheHits: 0,
  cacheMisses: 0,
};


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

// ===== QUERY EXPANSION =====
function expandQuery(question) {
  const synonyms = {
    'vacation': ['vacation', 'holiday', 'pto', 'time off', 'leave', 'annual leave'],
    'salary': ['salary', 'compensation', 'pay', 'wage', 'remuneration', 'payment'],
    'boss': ['boss', 'manager', 'supervisor', 'line manager', 'report to'],
    'remote': ['remote', 'work from home', 'wfh', 'telecommute', 'distributed'],
    'benefits': ['benefits', 'perks', 'health insurance', 'insurance', 'wellness'],
  };
  
  const lower = question.toLowerCase();
  let expanded = question;
  
  for (const [key, expansionList] of Object.entries(synonyms)) {
    if (lower.includes(key)) {
      expanded += ' ' + expansionList.slice(1).join(' ');
      break; // Добавляем только один набор синонимов
    }
  }
  
  return expanded;
}

// ===== DETECT ORG CHART QUERIES =====
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

// ===== SUGGESTIONS BUILDER =====
function buildSuggestions(vectorIndex) {
  const docTypeCounts = {};
  const files = new Set();

  vectorIndex.forEach(doc => {
    const type = doc.metadata.docType || "OTHER";
    docTypeCounts[type] = (docTypeCounts[type] || 0) + 1;
    if (doc.metadata.sourceFile) files.add(doc.metadata.sourceFile);
  });

  const topDocTypes = Object.entries(docTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type.replace(/_/g, " ").toLowerCase());

  const suggestedQueries = topDocTypes.map(type => `Ask about ${type}`);

  return {
    suggestedQueries,
    availableFiles: Array.from(files),
  };
}

// ===== COSINE SIMILARITY =====
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===== RECIPROCAL RANK FUSION (RRF) =====
function reciprocalRankFusion(bm25Results, embeddingScores, k = RRF_K) {
  const rrfScores = new Map();
  
  // BM25 ranks
  bm25Results.forEach((item, rank) => {
    const id = item.index;
    const rrfScore = 1 / (k + rank + 1);
    rrfScores.set(id, (rrfScores.get(id) || 0) + rrfScore);
  });
  
  // Embedding ranks (уже отсортированы по similarity)
  embeddingScores.forEach((item, rank) => {
    const id = item.index;
    const rrfScore = 1 / (k + rank + 1);
    rrfScores.set(id, (rrfScores.get(id) || 0) + rrfScore);
  });
  
  return Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([index, score]) => ({ index, rrfScore: score }));
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
  docCount = rawDocs.length;
  chunkCount = docs.length;

  // Build BM25 index
  console.log("🔍 Building BM25 index...");
  const bm25Texts = docs.map(d => d.pageContent);
  const bm25Index = new BM25(bm25Texts);
  console.log("✅ BM25 index ready");

  // Compute embeddings with enriched metadata
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("🧠 Computing embeddings...");
  // Обогащаем текст метаданными для лучшего поиска
  const enrichedTexts = docs.map(doc => 
    `[${doc.metadata.docType}] ${doc.pageContent}`
  );
  const vectors = await embeddings.embedDocuments(enrichedTexts);

  const vectorIndex = docs.map((doc, i) => ({
    embedding: vectors[i],
    pageContent: doc.pageContent,
    metadata: doc.metadata,
  }));

  console.log("✅ Vector index ready");

  return { bm25Index, vectorIndex, embeddings, docs };
}

const indexPromise = buildVectorIndex();

async function hybridSearchRRF(
  question,
  filterFn,
  { bm25Index, vectorIndex, embeddings },
  historyText = ""
) {
  const startTime = Date.now();

  const retrievalQuery = historyText
    ? `${historyText} ${question}`.trim()
    : question;

  const expandedQuery = expandQuery(retrievalQuery);
  console.log(`🔍 Expanded query: "${expandedQuery}"`);

  // === 1) Get or compute QUERY EMBEDDING (embedding cache) ===
  let embeddingHit = false;

  let queryEmbedding = embeddingCache.get(expandedQuery);
  if (!queryEmbedding) {
    console.log("🧠 Computing query embedding...");
    queryEmbedding = await embeddings.embedQuery(expandedQuery);
    embeddingCache.set(expandedQuery, queryEmbedding);
  } else {
    embeddingHit = true;
    console.log(
      `💾 Using cached embedding (hit rate: ${embeddingCache.getHitRate()}%)`
    );
  }

  // === 2) Semantic retrieval cache (topic cache) ===
  const semanticHitEntry = semanticRetrievalCache.findSimilar(
    queryEmbedding,
    cosineSimilarity,
    0.75 // threshold, tweak as you like
  );

  if (semanticHitEntry) {
    console.log("[Hybrid] Using semantic cache results");

    let cachedResults = semanticHitEntry.results;

    // Re-apply filter (e.g. org chart mode) if needed
    if (filterFn) {
      cachedResults = cachedResults.filter((r) =>
        filterFn(vectorIndex[r._index])
      );
      console.log(
        `[SemanticCache] After filterFn, ${cachedResults.length} results`
      );
      if (cachedResults.length === 0) {
        console.log(
          "[SemanticCache] Hit discarded because filterFn removed all candidates"
        );
      }
    }

    const latency = Date.now() - startTime;

    metrics.searches++;
    metrics.totalLatency += latency;
    if (cachedResults.length > 0) {
      metrics.avgScores.push(
        cachedResults.reduce((sum, r) => sum + r.rrfScore, 0) /
          cachedResults.length
      );
    }

    // unified cache metric: either embedding OR semantic cache counts as hit
    metrics.cacheHits++;

    // IMPORTANT: we still only send
    // - this call's history (built in /ask)
    // - these cached docs (results)
    // to the LLM. Prompt building happens later in /ask.

    return cachedResults.slice(0, FINAL_RESULTS);
  }

  // === 3) No semantic hit → full BM25 + RRF ===
  console.log(`📊 BM25 search for top ${BM25_CANDIDATES} candidates...`);
  const bm25Results = bm25Index.search(expandedQuery, BM25_CANDIDATES);

  let candidates = bm25Results;
  if (filterFn) {
    candidates = bm25Results.filter((result) => {
      const doc = vectorIndex[result.index];
      return filterFn(doc);
    });
    console.log(`🎯 Filtered to ${candidates.length} candidates`);
  }

  if (candidates.length === 0) {
    console.log("⚠️ No candidates after filtering");

    const latency = Date.now() - startTime;
    metrics.searches++;
    metrics.totalLatency += latency;

    // no retrieval → treat as cache miss for unified stats
    metrics.cacheMisses++;

    return [];
  }

  // we already have queryEmbedding
  const embeddingScores = candidates.map((candidate) => {
    const doc = vectorIndex[candidate.index];
    const similarity = cosineSimilarity(queryEmbedding, doc.embedding);
    return {
      index: candidate.index,
      embeddingScore: similarity,
      bm25Score: candidate.score,
    };
  });

  embeddingScores.sort((a, b) => b.embeddingScore - a.embeddingScore);

  console.log("🔀 Applying Reciprocal Rank Fusion...");
  const fusedResults = reciprocalRankFusion(candidates, embeddingScores);

  const finalResults = fusedResults.slice(0, FINAL_RESULTS).map((item) => {
    const doc = vectorIndex[item.index];
    const embScore = embeddingScores.find((e) => e.index === item.index);

    return {
      pageContent: doc.pageContent,
      metadata: doc.metadata,
      rrfScore: item.rrfScore,
      embeddingScore: embScore.embeddingScore,
      bm25Score: embScore.bm25Score,
      _index: item.index, // keep original index for semantic cache/filtering
    };
  });

  const latency = Date.now() - startTime;
  console.log(`✅ Search completed in ${latency}ms`);

  metrics.searches++;
  metrics.totalLatency += latency;
  metrics.avgScores.push(
    finalResults.reduce((sum, r) => sum + r.rrfScore, 0) /
      finalResults.length
  );

  console.log(
    "[Hybrid] top fused",
    finalResults.slice(0, 5).map((r) => ({
      file: r.metadata.sourceFile,
      bm25: r.bm25Score,
      emb: r.embeddingScore,
      rrf: r.rrfScore,
    }))
  );

  // === 4) Store retrieval into semantic cache ===
  semanticRetrievalCache.add({
    embedding: queryEmbedding,
    question,
    expandedQuery,
    results: finalResults,
  });

  // unified cache metric:
  //  - if embeddingHit was true (but semantic miss), it's still a "cache used"
  //  - otherwise, pure miss (fresh embed + fresh retrieval)
  if (embeddingHit) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }

  return finalResults;
}


// ===== /ask ENDPOINT =====
app.post("/ask", async (req, res) => {
  try {
    const question = req.body.question;
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required" });
    }

    const indexData = await indexPromise;
    let results;
    const historyForRetrieval = history
      .filter(msg => msg && typeof msg.content === "string")
      .map(msg => msg.content)
      .slice(-3)
      .join(" ");

    // ORG_CHART special mode
    if (isOrgChartQuery(question)) {
      console.log("🏢 Org-chart query detected");
      results = await hybridSearchRRF(
        question,
        doc => doc.metadata.docType === "ORG_CHART",
        indexData,
        historyForRetrieval
      );

      if (results.length === 0) {
        console.log("⚠️ Fallback to full search");
        results = await hybridSearchRRF(question, null, indexData);
      }
    } else {
      console.log("🔍 Running full hybrid search with RRF");
      results = await hybridSearchRRF(question, null, indexData, historyForRetrieval);
    }

    const suggestions = buildSuggestions(indexData.vectorIndex);
    const bestScore = results[0]?.rrfScore ?? 0;
    const topEmbeddingScores = results.slice(0, 3).map(r => r.embeddingScore ?? 0);
    const avgTopEmbedding = topEmbeddingScores.length > 0
      ? topEmbeddingScores.reduce((sum, score) => sum + score, 0) / topEmbeddingScores.length
      : 0;
    const hasSemanticSupport = (results[0]?.embeddingScore ?? 0) >= 0.25 || avgTopEmbedding >= 0.2;
    const hasKeywordSupport = results.slice(0, 3).some(r => (r.bm25Score ?? 0) > 0.2);
    const weakSignal = results.length === 0 || (!hasSemanticSupport && !hasKeywordSupport) || bestScore < 0.0005;

    console.log('[WeakSignal]', {
      bestScore,
      topEmbedding: results[0]?.embeddingScore,
      avgTopEmbedding,
      hasSemanticSupport,
      hasKeywordSupport,
      weakSignal
    });

    if (weakSignal) {
      return res.json({
        answer: "Information not found in company documents.",
        chunks: [],
        sources: [],
        suggestions,
        meta: {
          cacheHitRate: embeddingCache.getHitRate(),
          searchCount: metrics.searches,
          weakSignal: true,
        }
      });
    }

    // Build context
    const contextBlocks = results.map((doc, idx) => {
      const preview = doc.pageContent.slice(0, 500).replace(/\s+/g, " ");
      return `[#${idx + 1}] SOURCE_FILE: ${doc.metadata.sourceFile} | DOC_TYPE: ${doc.metadata.docType}\n${preview}`;
    });

    const context = contextBlocks.join("\n\n");

    const formattedHistory = history
      .filter(msg => msg && typeof msg.content === "string" && typeof msg.role === "string")
      .slice(-6)
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n");

    const historySection = formattedHistory
      ? `HISTORY (previous turns):\n${formattedHistory}\n\n`
      : "";

    // Call LLM
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
- If multiple snippets disagree or are ambiguous, then provide information from both sources.
- If you cannot cite at least one numbered source from the CONTEXT, reply exactly: "Information not found in company documents."

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

${historySection}CONTEXT:
${context}

QUESTION: ${question}`.trim();


    const response = await model.invoke(prompt);

    res.json({
      answer: response.content,
      chunks: contextBlocks,
      sources: results.map(doc => ({
        file: doc.metadata.sourceFile,
        docType: doc.metadata.docType,
        rrfScore: doc.rrfScore,
        embeddingScore: doc.embeddingScore,
        bm25Score: doc.bm25Score,
      })),
      suggestions,
      meta: {
        cacheHitRate: embeddingCache.getHitRate(),
        searchCount: metrics.searches,
        weakSignal: false,
      }
    });
  } catch (err) {
    console.error("❌ Error in /ask:", err);
    res.status(500).json({ error: "Server error" });
  }

 

});


// ===== METRICS ENDPOINT =====
app.get("/metrics", (req, res) => {
  const avgLatency =
    metrics.totalLatency / Math.max(metrics.searches, 1);

  const avgScore =
    metrics.avgScores.length > 0
      ? metrics.avgScores.reduce((a, b) => a + b, 0) /
        metrics.avgScores.length
      : 0;

  const totalCacheOps = metrics.cacheHits + metrics.cacheMisses;
  const unifiedCacheHitRate = totalCacheOps
    ? (metrics.cacheHits / totalCacheOps * 100).toFixed(2)
    : "0.00";

  res.json({
    totalSearches: metrics.searches,
    avgLatency: avgLatency.toFixed(2),
    avgRelevanceScore: avgScore.toFixed(4),

    cacheHitRate: unifiedCacheHitRate,
    cacheStats: {
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses,
    },

    // if you still want low-level debug info, you can keep:
    embeddingCacheRaw: {
      hits: embeddingCache.hits,
      misses: embeddingCache.misses,
    },
  });
});


// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
});
