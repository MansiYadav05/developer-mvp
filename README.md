# DevCoach: Engineering Intelligence Engine

DevCoach is a high-performance software engineering coach that transforms raw engineering data into actionable insights. By analyzing Jira issues, Pull Requests, deployments, and bug reports, it provides a story-driven reasoning engine powered by Google Gemini to help teams optimize their delivery flow.

## 🚀 Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Motion (Framer Motion), Lucide React.
- **Backend:** Node.js, Express, Multer (Streaming CSV processing).
- **AI Engine:** Google Gemini 1.5 Flash via `@google/genai`.
- **Deployment:** Docker (Multi-stage builds), Vercel.

## 🧠 How It Works

1.  **Data Ingestion:** Upload CSV exports from your engineering tools (Jira, GitHub/GitLab, CI/CD pipelines).
2.  **Metric Calculation:** The system calculates DORA-style metrics including Cycle Time, Lead Time, PR Throughput, Deployment Frequency, and Bug Rates.
3.  **AI Analysis:** Metrics are fed into Gemini with a specialized coaching prompt to generate a "Likely Story," a "Main Diagnosis," and "Coach-Recommended Actions."

## 🛠️ Local Setup

**Prerequisites:** Node.js (v20+), npm

1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd developer-mvp
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    Create a `.env` file in the root directory:
    ```env
    GEMINI_API_KEY=your_api_key_here
    NODE_ENV=development
    ```
4.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## ☁️ Vercel Deployment

This project is optimized for Vercel using the `vercel.json` configuration.

1.  Push your code to GitHub.
2.  Import the project in the Vercel Dashboard.
3.  Add the **Environment Variable**: `GEMINI_API_KEY`.
4.  Vercel will automatically detect the Vite build and the `server.ts` as a Serverless Function for the `/api` routes.

## 🐳 Docker Support

To run the production-ready containerized version:

```bash
docker build -t dev-coach .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key dev-coach
```

## 📊 CSV Requirements

For the analysis to work, ensure your CSV files contain these key columns:

| File | Required Columns |
| :--- | :--- |
| **Developers** | `developer_id`, `developer_name`, `team` |
| **Jira** | `developer_id`, `month_done`, `status`, `cycle_time_days` |
| **PRs** | `developer_id`, `month`, `status`, `review_wait_hours` |
| **Deployments** | `developer_id`, `month_deployed`, `status`, `lead_time_days` |
| **Bugs** | `developer_id`, `month_found`, `root_cause` |

---

### Deployment Notes
- The `dist/` folder contains the compiled frontend assets and the bundled `server.cjs` file.
- In production, the Express server serves the React SPA from the `dist` directory.


