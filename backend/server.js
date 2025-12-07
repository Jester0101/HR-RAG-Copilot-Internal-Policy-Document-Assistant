import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";

// ===== SETTINGS =====

const DATA_DIR = "./data";
const PORT = 3001;
const MODEL_NAME = "gpt-4.1-mini"; // вроде норм работает моделька , можете не менять 

const app = express();
app.use(cors());
app.use(express.json());

// Это докумтики которые я придумал для выдуманной компании

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

// ===== CHOOSE DOC TYPES BY QUESTION =====

function chooseDocTypesForQuestion(question) {
  const q = question.toLowerCase();
  const types = new Set();

  // HR policy / handbook
  if (
    q.includes("vacation") ||
    q.includes("holiday") ||
    q.includes("pto") ||
    q.includes("leave") ||
    q.includes("sick") ||
    q.includes("absence") ||
    q.includes("benefit") ||
    q.includes("working hours") ||
    q.includes("work hours") ||
    q.includes("schedule") ||
    q.includes("remote") ||
    q.includes("hybrid")
  ) {
    types.add("HR_POLICY");
    types.add("EMPLOYEE_HANDBOOK");
  }

  // salary / compensation
  if (
    q.includes("salary") ||
    q.includes("pay") ||
    q.includes("compensation") ||
    q.includes("bonus") ||
    q.includes("raise")
  ) {
    types.add("HR_POLICY");
    types.add("EMPLOYEE_HANDBOOK");
    types.add("CONTRACT");
  }

  // contract / probation / notice
  if (
    q.includes("probation") ||
    q.includes("trial period") ||
    q.includes("notice period") ||
    q.includes("term of employment") ||
    q.includes("contract")
  ) {
    types.add("CONTRACT");
    types.add("HR_POLICY");
  }

  // job responsibilities
  if (
    q.includes("role") ||
    q.includes("responsibilities") ||
    q.includes("duties") ||
    q.includes("what does") ||
    q.includes("job description") ||
    q.includes("position")
  ) {
    types.add("JOB_DESCRIPTIONS");
  }

  // company structure
  if (
    q.includes("org chart") ||
    q.includes("organizational chart") ||
    q.includes("structure") ||
    q.includes("department") ||
    q.includes("report to") ||
    q.includes("who do i report")
  ) {
    types.add("ORG_CHART");
  }

  // onboarding
  if (
    q.includes("onboarding") ||
    q.includes("first day") ||
    q.includes("new employee") ||
    q.includes("start date") ||
    q.includes("orientation")
  ) {
    types.add("ONBOARDING");
    types.add("EMPLOYEE_HANDBOOK");
  }

  // exit / termination
  if (
    q.includes("resign") ||
    q.includes("resignation") ||
    q.includes("termination") ||
    q.includes("offboarding") ||
    q.includes("last day") ||
    q.includes("exit")
  ) {
    types.add("EXIT");
    types.add("CONTRACT");
  }

  // NDA / confidentiality
  if (
    q.includes("nda") ||
    q.includes("confidential") ||
    q.includes("confidentiality") ||
    q.includes("non-disclosure") ||
    q.includes("secrecy")
  ) {
    types.add("NDA");
  }

  return Array.from(types);
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

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const texts = docs.map((d) => d.pageContent);
  console.log("🧠 Computing embeddings...");
  const vectors = await embeddings.embedDocuments(texts);

  const index = docs.map((doc, i) => ({
    embedding: vectors[i],
    pageContent: doc.pageContent,
    metadata: doc.metadata,
  }));

  console.log("✅ In-memory vector index ready.");
  return { index, embeddings };
}

// строим один раз
const indexPromise = buildVectorIndex();

// ===== SEARCH FUNCTION =====

async function similaritySearch(question, k, filterFn, embeddingsInstance, index) {
  const queryEmbedding = await embeddingsInstance.embedQuery(question);

  const scored = [];

  for (const item of index) {
    if (filterFn && !filterFn(item)) continue;

    const score = cosineSimilarity(queryEmbedding, item.embedding);
    scored.push({ score, item });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((s) => ({
    pageContent: s.item.pageContent,
    metadata: s.item.metadata,
    score: s.score,
  }));
}

// ===== /ask ENDPOINT =====

// ===== /ask ENDPOINT =====

// ===== /ask ENDPOINT =====

app.post("/ask", async (req, res) => {
  try {
    const question = req.body.question;
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: "Question is required" });
    }

    const { index, embeddings } = await indexPromise;
    const q = question.toLowerCase();

    // ключевые слова для вопросов про оргструктуру / должности
    const orgKeywords = [
      "job",
      "jobs",
      "role",
      "roles",
      "position",
      "positions",
      "org chart",
      "organizational chart",
      "organization chart",
      "structure",
      "organizational structure",
      "department",
      "departments",
      "team",
      "teams",
      "what type of jobs",
      "list of jobs",
      "list roles",
      "types of jobs"
    ];

    const isOrgQuery = orgKeywords.some((key) => q.includes(key));

    let results;

    // ===== СПЕЦИАЛЬНЫЙ РЕЖИМ: ОРГСТРУКТУРА / ДОЛЖНОСТИ =====
    if (isOrgQuery) {
      console.log("🏢 Org-chart / jobs query detected. Using ALL ORG_CHART chunks (no similarity search).");

      // Берем все чанки, которые помечены как ORG_CHART
      const orgDocs = index.filter(
        (item) => item.metadata.docType === "ORG_CHART"
      );

      if (orgDocs.length === 0) {
        console.log("⚠ No ORG_CHART docs found. Falling back to normal similarity search.");
        // fallback: обычный путь, как для других запросов
        const k = 20;
        const docTypes = chooseDocTypesForQuestion(question);

        if (docTypes.length > 0) {
          console.log("🎯 Filtering by docTypes:", docTypes);
          results = await similaritySearch(
            question,
            k,
            (doc) => docTypes.includes(doc.metadata.docType),
            embeddings,
            index
          );

          if (results.length === 0) {
            console.log("⚠ No results with filter, falling back to all docs");
            results = await similaritySearch(
              question,
              k,
              null,
              embeddings,
              index
            );
          }
        } else {
          console.log("ℹ No docType filter, searching all docs");
          results = await similaritySearch(
            question,
            k,
            null,
            embeddings,
            index
          );
        }
      } else {
        // здесь мы вообще не используем similaritySearch, просто берем ВСЕ чанки ORG_CHART
        results = orgDocs.map((doc) => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          // ставим заглушку для score, чтобы фронт не падал на toFixed()
          score: 1.0,
        }));
      }
    } else {
      // ===== ОБЫЧНЫЙ РЕЖИМ: POLICIES, CONTRACTS И Т.Д., можете k поменять если нужны ответы длинее =====
      let k = 20;
      const docTypes = chooseDocTypesForQuestion(question);

      if (docTypes.length > 0) {
        console.log("🎯 Filtering by docTypes:", docTypes);

        results = await similaritySearch(
          question,
          k,
          (doc) => docTypes.includes(doc.metadata.docType),
          embeddings,
          index
        );

        if (results.length === 0) {
          console.log("⚠ No results with filter, falling back to all docs");
          results = await similaritySearch(
            question,
            k,
            null,
            embeddings,
            index
          );
        }
      } else {
        console.log("ℹ No docType filter, searching all docs");
        results = await similaritySearch(
          question,
          k,
          null,
          embeddings,
          index
        );
      }
    }

    // ===== СТРОИМ КОНТЕКСТ =====
    const contextBlocks = results.map((doc, idx) => {
      const preview = doc.pageContent.slice(0, 500).replace(/\s+/g, " ");
      return `[#${idx + 1}] SOURCE_FILE: ${doc.metadata.sourceFile} | DOC_TYPE: ${doc.metadata.docType}
${preview}`;
    });

    const context = contextBlocks.join("\n\n");

    // ===== ВЫЗОВ МОДЕЛИ =====
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: MODEL_NAME,
      temperature: 0,
    });

    const prompt = `
You are an internal HR assistant for BluePeak Creative Group.

Your job:
1) Understand the employee's question.
2) Carefully read the CONTEXT below (these are snippets from company documents).
3) Answer ONLY based on the information in the CONTEXT.

Mandatory rules:
- Never use outside knowledge or assumptions.
- Do NOT invent or guess policies, numbers, or missing details.
- If the answer is not clearly and explicitly supported by the CONTEXT, or the information is incomplete, reply exactly:
"Information not found in company documents."
- If multiple snippets disagree or are ambiguous, reply:
"Information not found in company documents."

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

QUESTION:
${question}
`.trim();

    const response = await model.invoke(prompt);

    res.json({
      answer: response.content,
      chunks: contextBlocks,
      sources: results.map((doc) => ({
        file: doc.metadata.sourceFile,
        docType: doc.metadata.docType,
        score: doc.score,
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
