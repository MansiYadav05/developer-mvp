import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Memory storage for CSV data
let developers: any[] = [];
let jiraIssues: any[] = [];
let pullRequests: any[] = [];
let deployments: any[] = [];
let bugReports: any[] = [];

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  app.use(express.json());

  // Log all requests
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // Test API to verify connectivity
  app.get("/api/ping", (req, res) => {
    res.json({ pong: true, time: new Date().toISOString() });
  });

  // API to upload and parse CSV files
  app.post("/api/upload", (req, res, next) => {
    console.log("Receiving upload request...");
    upload.fields([
      { name: "developers", maxCount: 1 },
      { name: "jira", maxCount: 1 },
      { name: "prs", maxCount: 1 },
      { name: "deployments", maxCount: 1 },
      { name: "bugs", maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        console.error("Multer error in middleware:", err);
        return res.status(400).json({ error: `Multer Error: ${err.message}` });
      }
      next();
    });
  }, async (req: any, res) => {
    const files = req.files;
    console.log("Fields received:", Object.keys(files || {}));
    
    const parseCSV = (buffer: Buffer): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        const results: any[] = [];
        Readable.from(buffer)
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", (err) => reject(err));
      });
    };

    try {
      const devs = files.developers ? await parseCSV(files.developers[0].buffer) : [];
      const jira = files.jira ? await parseCSV(files.jira[0].buffer) : [];
      const prs = files.prs ? await parseCSV(files.prs[0].buffer) : [];
      const deploys = files.deployments ? await parseCSV(files.deployments[0].buffer) : [];
      const bugs = files.bugs ? await parseCSV(files.bugs[0].buffer) : [];

      const devList = devs.map((d: any) => ({ 
        id: String(d.developer_id).trim(), 
        name: String(d.developer_name).trim() 
      })).filter(d => d.id && d.name);

      const monthsSet = new Set([
        ...jira.map(i => String(i.month_done).trim()),
        ...prs.map(p => String(p.month).trim()),
        ...deploys.map(d => String(d.month_deployed).trim()),
        ...bugs.map(b => String(b.month_found).trim())
      ]);
      const months = Array.from(monthsSet).filter(m => m && m !== "undefined").sort();

      console.log(`Parsed: ${devList.length} devs, ${months.length} months`);

      res.json({ 
        message: "Files processed successfully", 
        developers: devList,
        months,
        // Return raw data to the client because Vercel is stateless
        raw: {
          developers: devs,
          jiraIssues: jira,
          pullRequests: prs,
          deployments: deploys,
          bugReports: bugs
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API to calculate metrics and reasoning
  app.post("/api/calculate", async (req, res) => {
    // Accept the raw data back from the client
    const { developerId, month, rawData } = req.body;

    if (!developerId || !month) {
      return res.status(400).json({ error: "Developer ID and Month are required" });
    }

    const devIdStr = String(developerId).trim();
    const monthStr = String(month).trim();

    const { 
      developers: rawDevs = [], 
      jiraIssues: rawJira = [], 
      pullRequests: rawPRs = [], 
      deployments: rawDeploys = [], 
      bugReports: rawBugs = [] 
    } = rawData || {};

    const devJira = rawJira.filter((i: any) => String(i.developer_id).trim() === devIdStr && String(i.month_done).trim() === monthStr);
    const devPRs = rawPRs.filter((p: any) => String(p.developer_id).trim() === devIdStr && String(p.month).trim() === monthStr && String(p.status).toLowerCase().trim() === 'merged');
    const devDeploys = rawDeploys.filter((d: any) => String(d.developer_id).trim() === devIdStr && String(d.month_deployed).trim() === monthStr && String(d.status).toLowerCase().trim() === 'success');
    const devBugs = rawBugs.filter((b: any) => String(b.developer_id).trim() === devIdStr && String(b.month_found).trim() === monthStr);

    const issuesDone = devJira.filter(i => String(i.status).toLowerCase().trim() === 'done').length;
    const totalCycleTimeDays = devJira.reduce((sum, i) => sum + (parseFloat(i.cycle_time_days) || 0), 0);
    const cycleTime = issuesDone > 0 ? totalCycleTimeDays / issuesDone : 0;

    const prodDeployments = devDeploys.length;
    const totalLeadTimeDays = devDeploys.reduce((sum, d) => sum + (parseFloat(d.lead_time_days) || 0), 0);
    const leadTime = prodDeployments > 0 ? totalLeadTimeDays / prodDeployments : 0;

    const prThroughput = devPRs.length;
    const deploymentFrequency = prodDeployments;
    const bugRate = issuesDone > 0 ? (devBugs.length / issuesDone) * 100 : 0;

    // Advanced Stats for AI
    const rootCauses = devBugs.map(b => b.root_cause).filter(Boolean).join(", ") || "None recorded";
    const totalReviewWaitHours = devPRs.reduce((sum, p) => sum + (parseFloat(p.review_wait_hours) || 0), 0);
    const avgReviewWaitHours = prThroughput > 0 ? totalReviewWaitHours / prThroughput : 0;

    const devInfo = rawDevs.find((d: any) => String(d.developer_id).trim() === devIdStr);
    const devName = devInfo?.developer_name || "Unknown Developer";
    const teamName = devInfo?.team || devInfo?.team_name || "Engineering Hub";

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured in the environment");
      }

      const prompt = `You are a high-performance software engineering coach. Analyze the following developer metrics and provide a story-driven reasoning and next steps.
      
      Developer: ${devName}
      Team: ${teamName}
      Month: ${monthStr}
      
      Metrics:
      - Cycle Time: ${cycleTime.toFixed(2)} days (avg time to complete a task)
      - Lead Time: ${leadTime.toFixed(2)} days (avg time from code to production)
      - PR Throughput: ${prThroughput} merged PRs
      - Deployment Frequency: ${deploymentFrequency} successful production deployments
      - Bug Rate: ${bugRate.toFixed(2)}%
      - Avg Review Wait: ${avgReviewWaitHours.toFixed(2)} hours
      - Bug Root Causes: ${rootCauses}
      
      Instructions:
      1. Choose one patternHint: "Healthy Flow", "Quality Watch", "Needs Review", or "Deployment Blocked".
      2. Provide a mainIssue (3-5 words).
      3. Provide reasoning (one punchy sentence, max 20 words).
      4. Provide a story (2-3 sentences using the actual numbers provided).
      5. List 2 concrete, personalized action items.
      
      Output ONLY a valid JSON object in this format:
      {
        "patternHint": "...",
        "mainIssue": "...",
        "reasoning": "...",
        "story": "...",
        "actions": ["...", "..."]
      }`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              patternHint: { type: Type.STRING },
              mainIssue: { type: Type.STRING },
              reasoning: { type: Type.STRING },
              story: { type: Type.STRING },
              actions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["patternHint", "mainIssue", "reasoning", "story", "actions"]
          }
        }
      });

      const analysis = JSON.parse(result.text || "{}");

      res.json({
        metrics: {
          cycleTime,
          leadTime,
          prThroughput,
          deploymentFrequency,
          bugRate
        },
        analysis: {
          ...analysis,
          teamName,
          story: analysis.story // Just being explicit
        }
      });

    } catch (aiError: any) {
      console.error("Gemini AI API Error:", aiError);
      res.status(500).json({ error: `AI Analysis failed: ${aiError.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
  }

  // 404 Handler for API routes
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(err.status || 500).json({ 
      error: err.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  // Fallback for non-API routes in production
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} (Mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer();

export default app;
