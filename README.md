# 🎓 Talent Nurturing System v2

A full-stack AI-assisted talent management platform built for **Centific AI**. It tracks training assignments, manages certification pipelines, handles Human-in-the-Loop (HIL) approvals, and escalates at-risk resources — all through a macOS-style desktop UI.

---

## 📸 What It Looks Like

The app runs as a **macOS-style desktop environment** in the browser:

- A **glassmorphic system bar** at the top with clock and API status
- A **macOS dock** at the bottom with magnification effects — icons grow as your cursor approaches
- **Floating widgets** on the desktop showing agent notes and today's tasks
- **Window-based screens** that open when you click a dock icon
- A **Live Commentary panel** on the right showing real-time audit events

---

## 🏗️ Project Structure

```
tn-v2/
├── backend/                  # FastAPI Python backend
│   ├── main.py               # App entry point, CORS, router registration
│   ├── config.py             # Settings (reads .env for DB URL)
│   ├── database.py           # SQLAlchemy async engine + session
│   ├── models.py             # All database models (ORM)
│   ├── schema.sql            # PostgreSQL schema (run once to create tables)
│   ├── seed_data.sql         # Sample data (resources, RFPs, assignments)
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Database connection string (Supabase)
│   └── routers/
│       ├── assignments.py    # CRUD for training assignments
│       ├── hil.py            # HIL queue approve/reject/modify
│       ├── escalations.py    # Escalation resolution
│       ├── certifications.py # Certification registry
│       ├── audit.py          # Audit log (append-only)
│       └── analytics.py      # KPI metrics, status breakdown, RFP progress
│
└── frontend/                 # React + Vite frontend
    ├── src/
    │   ├── App.jsx            # Root component, screen/window state
    │   ├── DataContext.jsx    # Global data store, polls API every 10s
    │   ├── api.js             # All fetch calls to backend
    │   ├── main.jsx           # React entry point
    │   ├── index.css          # All styles (glassmorphism, dock, tokens)
    │   └── components/
    │       ├── Desktop.jsx    # Sysbar, dock, widgets, magnification logic
    │       ├── Window.jsx     # Window chrome (title bar, min/max/close)
    │       ├── LivePanel.jsx  # Right-side live audit commentary
    │       ├── Modal.jsx      # Reusable modal overlay
    │       ├── Toast.jsx      # Notification toasts
    │       └── screens/
    │           ├── AnalyticsScreen.jsx    # KPI dashboard with drill-down
    │           ├── TrackerScreen.jsx      # Assignment table with search/filter
    │           ├── EscalationsScreen.jsx  # At-risk & overdue resolution
    │           ├── HilScreen.jsx          # HIL approval queue
    │           ├── CertsScreen.jsx        # Certification registry + journey
    │           └── AuditScreen.jsx        # Full audit log table
    ├── vite.config.js         # Vite config + /api proxy to backend
    └── package.json
```

---

## ⚙️ How It Works

### Data Flow

```
Supabase PostgreSQL (cloud DB)
        ↓
FastAPI backend (port 8000)
        ↓  REST API
React frontend (port 5173/5174/5175)
        ↓  polls every 10 seconds
UI updates automatically
```

1. The **database** lives on Supabase (PostgreSQL in the cloud)
2. The **FastAPI backend** connects to it via `asyncpg` and exposes REST endpoints
3. The **React frontend** calls those endpoints through Vite's `/api` proxy
4. `DataContext.jsx` fetches all data on load and **re-fetches every 10 seconds** — so any DB change appears in the UI within 10 seconds
5. Pressing the **🏠 home button** triggers an **instant refresh** from the DB

---

## 🗄️ Database Schema

| Table | Purpose |
|---|---|
| `resources` | People being trained (name, role, department, email) |
| `rfps` | Client RFP requirements (skill needed, deadline, cert authority) |
| `training_programs` | Training courses with modules, duration, cert name |
| `assignments` | Links a resource to an RFP + program, tracks progress |
| `hil_queue` | Pending HIL approvals for training recommendations |
| `escalations` | At-risk or overdue assignments needing action |
| `certifications` | Completed certifications with deployment clearance |
| `audit_logs` | Append-only log of every action in the system |
| `metrics_snapshots` | KPI snapshots for the analytics dashboard |

### Assignment Status Flow

```
pending → active → complete
              ↓
           at_risk → overdue
```

### Assignment Components

Each assignment has 3 components tracked separately:
- **Content** — training modules (not_started → in_progress → complete)
- **Online Test** — with score and attempt count
- **Case Study** — with score

`overall_progress` is a 0–100% integer combining all three.

---

## 🖥️ Screens

### 📊 Analytics Dashboard
- 8 KPI cards (Assignment Rate, Completion Rate, Pass Rate, Overdue Rate, etc.)
- Click any KPI card → drill-down modal with detail
- Donut chart of assignment status breakdown — click any row for detail
- Bar chart of RFP compliance — click any RFP chip for breakdown
- System alerts for overdue/at-risk/pending HIL items

### 📋 Assignment Tracker
- Full table of all assignments with search and status filter
- Shows resource name, role, RFP, program, component dots (C · T · CS), progress bar, deadline, status
- Click any row → detailed modal with circular progress chart and all scores

### ⚠️ Escalation Panel
- Cards for every open escalation (at-risk or overdue)
- Shows progress snapshot (content %, test %, case study %, days remaining)
- Three resolution actions:
  - **Extend Deadline** — calendar picker, updates assignment deadline in DB
  - **Replace Resource** — marks escalation resolved with replacement
  - **Accept Risk** — acknowledges and closes the escalation

### ✅ HIL Approval Queue
- Pending training recommendations waiting for Talent Lead sign-off
- Shows proposed program, modules, estimated hours, deadline
- Three actions: **Approve** (activates assignment), **Modify** (records changes), **Reject** (cancels)
- All actions write to audit log

### 🏅 Certification Registry
- All registered certifications with deployment clearance dates
- Filter by status (registered / verified / pending)
- Click any cert → full **Training Journey** modal showing all 8 stages from gap identification to certification

### 📄 Audit Log
- Append-only table of every system event
- Search by message, RFP, resource ID, or action type
- Filter by level: info / warning / error / action
- Also shown in real-time in the **Live Commentary** panel on the right side of every screen

---

## 🚀 Running the Application

### Prerequisites
- Python 3.10+
- Node.js 18+
- Access to the Supabase project (DB credentials in `.env`)

### 1. Start the Backend

```bash
cd talent-nurturing-v3/tn-v2
python -m uvicorn backend.main:app --reload --port 8000
```

Backend runs at: `http://127.0.0.1:8000`

### 2. Start the Frontend

```bash
cd talent-nurturing-v3/tn-v2/frontend
npm install       # first time only
npm run dev
```

Frontend runs at: `http://localhost:5173` (or next available port)

### 3. Open in Browser

Go to `http://localhost:5173` (check terminal output for exact port)

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/assignments` | List all assignments (filter by `?status=`) |
| POST | `/assignments` | Create new assignment |
| PATCH | `/assignments/{id}` | Update assignment fields |
| GET | `/hil-queue` | List HIL items (filter by `?status=`) |
| POST | `/hil-queue/{id}/action` | Approve / reject / modify HIL item |
| GET | `/escalations` | List all escalations |
| POST | `/escalations/{id}/action` | Resolve escalation (extend / replace / accept) |
| GET | `/certifications` | List all certifications |
| GET | `/audit-logs` | List audit logs (filter by level, paginated) |
| POST | `/audit-logs` | Create audit log entry |
| GET | `/analytics/metrics` | KPI metrics snapshot |
| GET | `/analytics/status-breakdown` | Assignment counts by status |
| GET | `/analytics/rfp-progress` | Per-RFP compliance breakdown |

---

## 🗃️ Making DB Changes & Seeing Them in the UI

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Run any SQL (UPDATE, INSERT, DELETE)
3. The frontend auto-refreshes every **10 seconds** — changes appear automatically
4. Or press the **🏠 home button** from any screen for an **instant refresh**

### Example — Update a resource name
```sql
UPDATE resources SET full_name = 'New Name' WHERE resource_code = 'R-1042';
```

### Example — Add a new assignment
```sql
WITH r AS (SELECT id FROM resources WHERE resource_code = 'R-1099' LIMIT 1),
     p AS (SELECT id FROM rfps WHERE rfp_reference = 'RFP-2026-047' LIMIT 1),
     t AS (SELECT id FROM training_programs WHERE program_name = 'NLP Evaluation Certification' LIMIT 1)
INSERT INTO assignments (resource_id, rfp_id, program_id, assigned_date, deadline,
  content_status, test_status, case_study_status, overall_progress, status, test_attempts)
SELECT r.id, p.id, t.id, CURRENT_DATE, DATE '2026-06-01',
  'not_started', 'not_started', 'not_started', 0, 'active', 0
FROM r, p, t;
```

---

## 🎨 UI Design System

- **Font**: Poppins (Google Fonts)
- **Colour palette**: All light pastels — no harsh dark colours
  - Purple: `#7C5CFC` / `#F0EBFF`
  - Green: `#34D399` / `#D1FAE5`
  - Yellow: `#FBBF24` / `#FEF9C3`
  - Red: `#F87171` / `#FEE2E2`
- **Glassmorphism**: `backdrop-filter: blur()` on sysbar, dock, widgets, panels
- **Dock**: JS-driven proximity magnification — icons grow as cursor approaches, shrink when a window is open, hide when maximized and peek back up when cursor nears the bottom edge

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 4, plain CSS |
| Backend | FastAPI, Python 3.10+ |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL (Supabase cloud) |
| DB Driver | asyncpg |
| Validation | Pydantic v2 |
| State | React Context API (DataContext) |
| Routing | React Router v6 |

---

## 👩‍💻 Built By

**Nandini Syamala** — Centific AI  
Resource Code: `R-1042` · Data Annotator · Operations

---

## 📝 Work Log

> A running record of every change made to this project, newest at the bottom.
> Each entry covers what was asked, what was actually broken, what changed, and what was verified.

---

### 2026-07-22 — Got the app running end-to-end on a local database

**Asked:** "Run my application" → then "fix my code and make it run successfully".

#### 🔍 What was actually broken

Three separate problems, only one of which was in the application code.

| # | Problem | Symptom |
|---|---|---|
| 1 | `backend/venv` was built on a different machine | `uvicorn` exited instantly with **no output**. The venv pointed at `C:\Users\user\...\Python311\python.exe`, which doesn't exist on this PC. |
| 2 | **The Supabase database rejects all connections** | Every query failed with `asyncpg.exceptions.InternalServerError: (ENOTFOUND) tenant/user postgres.zkmrmusdzjsebpmvqxzv not found` — on **both** pooler ports (5432 and 6543). `/assignments` and `/escalations` returned **HTTP 500**; the UI logged 6 failed API calls and rendered empty. |
| 3 | `ddl.sql` could not run at all | It did `CREATE SCHEMA aarav`, then created every table as `talent_nurturing.<table>` — a schema nothing ever created. Died on the first statement: `ERROR: schema "talent_nurturing" does not exist`. |

The routers, ORM models, and async SQLAlchemy layer were **fine throughout**. The only reason the app looked broken was that it had no database to talk to.

#### 🔧 What changed

| File / thing | Change | Why |
|---|---|---|
| `backend/venv/` | Rebuilt with **Python 3.10** from `requirements.txt`. Old one parked at `venv_broken/` (safe to delete). | The original referenced a Python install that isn't on this machine. |
| **New: Docker Postgres 16** | Container `tn_postgres` on host port **55432**. Loaded `schema.sql` + `seed_data.sql` + `seed_extra.sql` + `seed_more.sql`. | Gives the app a database that actually answers, with no cloud credentials needed. |
| `backend/.env` | `DATABASE_URL` repointed to the local container. Old Supabase URI kept **commented above it**. | So switching back to the cloud is a one-line uncomment once the credentials work. |
| `backend/config.py` (line 5) | Fixed the hardcoded fallback URL. | It was **doubly broken**: an unescaped `@` inside the password, and the sync `postgresql://` driver — which `create_async_engine()` cannot use at all. |
| `backend/ddl.sql` (lines 19–21) | `CREATE SCHEMA aarav` → `CREATE SCHEMA talent_nurturing`, and the matching `search_path`. | Matches the comment two lines above it ("All tables will live inside 'talent_nurturing'"). The file now runs clean, and `dml.sql` runs clean after it. |

> **Note on which schema file to use:** the running app uses **`schema.sql`**, not `ddl.sql`. `models.py` refers to tables *without* a schema prefix, so they must live in `public` — which is where `schema.sql` puts them. `ddl.sql`/`dml.sql` build a separate `talent_nurturing` schema and are kept as an alternative deployment path.

#### 📦 Data now loaded

| Table | Rows |
|---|---|
| `resources` | 19 |
| `assignments` | 17 |
| `hil_queue` | 10 |
| `escalations` | 11 |
| `certifications` | 13 |
| `audit_logs` | 20 |
| `metrics_snapshots` | 2 |

#### ✅ What was verified

- **All 15 API routes return 200** with real rows — including `/assignments` and `/escalations`, which were the 500s.
- **Write path works end-to-end:** `POST /hil-queue/{id}/action` approved an entry → the assignment flipped to `active` → a matching `hil_approve` row appeared in the audit log.
- **All 7 screens driven in a real browser** (Home, Analytics, Tracker, Escalations, HIL Queue, Certifications, Audit Log) — every one rendering live database data, with **zero failed network requests and zero console errors**.
- `ddl.sql` then `dml.sql` both run without error on a fresh database.

#### ⚠️ One thing worth fixing later

`backend/routers/certifications.py` line 22 has a bare `except:` that silently swallows any database failure and returns two hardcoded `SAMPLE_CERTS` rows instead. This is why `/certifications` kept returning **HTTP 200 with fake data** while the database was completely unreachable — it masked the outage. It will hide the next one the same way.

#### 🚀 How to start everything now

```bash
# 1. Database (only needed after a reboot — data persists in the container)
docker start tn_postgres

# 2. Backend
cd backend
./venv/Scripts/uvicorn.exe main:app --host 127.0.0.1 --port 8000

# 3. Frontend
cd frontend
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://127.0.0.1:8000 |
| API docs | http://127.0.0.1:8000/docs |
| Postgres | `localhost:55432` · user `postgres` · password `postgres` · db `postgres` |

---

### 2026-07-22 — Started this Work Log

**Asked:** Record what gets done in `README.md` after every request, at a moderate level of detail.

**Done:** Added this Work Log section and backfilled the entry above. From here on, every request gets its own dated entry appended to the bottom — what was asked, what was wrong, what changed, and what was verified. Earlier entries are never rewritten.

---

### 2026-07-22 — Investigation: does this application use AI?

**Asked:** "Tell me — did my application use AI?"

**Answer: No.** No files were changed — this was a read-only investigation.

#### 🔎 How it was checked

Searched the entire codebase (excluding `node_modules`, `venv`) for every major AI provider and library: **OpenAI, Anthropic, Claude, Gemini, LangChain, Mistral, Cohere, Ollama, HuggingFace, transformers**, plus generic terms like `llm`, `embedding`, `gpt-`.

**Zero matches.** Every hit was the word "completion" inside the `completion_rate_pct` column name. `requirements.txt` contains only FastAPI, SQLAlchemy, asyncpg and Pydantic — no AI SDK. There is no API key in the project and no outbound network call from the backend.

#### 🤖 What the "AARAV AI Insights" orb really is

`frontend/src/components/AaravOrb.jsx` is a hand-written `if/else` chain over data already loaded in `DataContext`. Despite the comment on line 5 saying "generate real AI insights":

| Displayed insight | How it's actually produced |
|---|---|
| "…has an open escalation requiring attention" | Filters `escalations` where `status === 'open'`, formats a string |
| "…shows declining evaluation confidence" | Filters `hilItems` where `status === 'pending'` |
| "Confidence: 95%" | Hardcoded literal — line 19: `critical ? 95 : high ? 88 : 74` |
| "All systems operating within expected parameters" | The `else` fallback when the lists come back empty |

Nothing is inferred, predicted, or learned. **"AI" here is product naming, not technology.** The system is a CRUD dashboard where a human Talent Lead makes every real decision through the HIL approval queue.

#### 🐛 Bug found (not yet fixed)

Three of the four insight rules in `AaravOrb.jsx` are **dead code** — they can never fire, because of field-name mismatches:

| Line | Reads | Problem |
|---|---|---|
| 40 | `a.status === 'completed'` | The enum value is `complete`, not `completed` — never matches |
| 15 | `esc.severity` | No such field on the escalations model — always `undefined`, so confidence always falls back to `74` |
| 52 | `metrics.total_assignments` | `/analytics/metrics` returns only `*_pct` fields — always `undefined` |

This is why the orb displays *"All systems operating within expected parameters"* even when the dashboard simultaneously shows **3 overdue assignments and 9 pending HIL items**. Every real rule silently falls through to the fallback message.

---

### 2026-07-22 — Planning: how to add real AI, per the BRD

**Asked:** "How can I implement AI in my application, what are all the possible ways — and my end goal is this document" (Business Requirements Document — Talent Nurturing, V1, 14/04/2026).

**Answer: a design, not code.** No files were changed — this entry records the plan.

#### 📋 What the BRD actually authorizes

Three passages in the BRD all draw the same boundary, so the AI scope is narrow and well-defined:

> **Decision Brain (p7):** "Rule-based logic governs training selection, deadline calculation, progress threshold evaluation, and escalation triggers. **LLM reasoning is used where multiple training options exist or customised program content needs structuring.**"

Also **Skills #7** ("LLM-based reasoning for program recommendation and content structuring") and **Model Access #3** (same). So the LLM has **exactly two authorized jobs**. Deadline math, at-risk thresholds, escalation triggers, and completion verification stay deterministic — as **Constraint #3** requires: *"LLM-based program recommendation is probabilistic. Errors will occur, making the HIL validation step a permanent part of the process and not a temporary measure."*

The good news: the HIL gate is the hard part, and it's already built (`backend/routers/hil.py`). AI slots in **behind** it.

#### 🛠️ Four possible approaches, ranked

| # | Approach | Verdict for this app |
|---|---|---|
| **1** | **Single API call + structured output** — one request per skill gap, JSON schema constrains the response | ✅ **Recommended.** BR-001 and BR-002 are single-shot reasoning tasks; no loop needed |
| 2 | **Workflow + tool use** — the model calls the catalogue / question bank as tools, we own the loop | Only once the training catalogue outgrows a single prompt |
| 3 | **Agent (SDK tool runner)** — the SDK drives an autonomous tool loop | Overkill, and fights **Guardrail #1** — the BRD forbids autonomous assignment |
| 4 | **Managed Agents** — Anthropic hosts the loop and a sandbox | Wrong shape — there is no long-running sandboxed workspace here |

The BRD describes **a pipeline with a human gate**, not an autonomous agent. Approach 1 is the honest implementation of that.

#### 🎯 Three features worth building

| # | Feature | BRD anchor | Status today |
|---|---|---|---|
| **①** | **Program recommendation** — gap record in; recommended program + alternatives out, each with modules, test spec, case study, and rationale. Writes to `hil_queue.proposed_program` | BR-001, BR-002 | Column exists, only ever filled by seed SQL |
| **②** | **Plain-English assignment rationale** — why this gap, what outcome it targets | Hrudayam #3 | Nothing produces this today |
| **③** | **Regional certification equivalency** — mapping cert authorities and naming conventions across geographies | Ekalavya #1–3 | Not started; genuinely fuzzy, good LLM fit, lower priority |

Everything else — at-risk detection, deadline calculation, escalation triggers, completion verification — **stays as SQL and Python**. Faster, auditable, and exactly what the BRD asks for.

#### 🔒 Guardrails that must be code, not prompt text

| BRD requirement | Enforce as |
|---|---|
| Guardrail #1 — never assign without HIL | DB constraint / service-layer check — already the shape of the `hil_queue` flow |
| BR-007 — log original value, revised value, reviewer ID, timestamp | Write both the model's proposal **and** the Talent Lead's edit to `audit_logs`. Doubles as the BR-006 HIL-override-rate metric and as prompt-improvement data |
| Guardrail #4 — approved content only | Pass the catalogue + question bank in the prompt, then **validate every returned module ID against the DB** before persisting. Never trust a free-text module name |
| Ekalavya #6 — UTC timestamps | Already handled by the `TIMESTAMPTZ` columns |
| AC-01 — ≥90% accuracy on 20 test gap records | Build the eval harness **with** the feature, not after. Assumption #7 says the Talent Lead supplies the labelled records — get them before tuning prompts |

#### 🧱 Technical notes for feature ①

- Python backend → the official `anthropic` SDK; add it to `requirements.txt`.
- **Structured outputs** (a Pydantic schema passed as `output_format`) give the versioned-schema guarantee **Sukmadarshini #6** requires — the response is constrained to the schema and returned as a validated object, rather than a string to `json.loads()` and hope about.
- **Prompt caching** on the catalogue/question-bank block: it's identical on every request, so caching that prefix cuts cost ~90% on repeat calls. Caching is a *prefix match*, so the stable catalogue must come **before** the per-request gap record.

#### ⚠️ Gotcha to decide before wiring this up

`hil_queue.proposed_program` is currently populated from seed SQL, so the HIL screen already renders as though recommendations exist. When the real generator goes in, decide whether to clear those rows — **mixing generated and seeded rows makes the AC-01 accuracy number meaningless.**

#### ▶️ Recommended build order

1. `pip install anthropic`; add to `requirements.txt`
2. Build ① behind a feature flag, writing to `hil_queue.proposed_program`
3. Build the AC-01 eval harness against the 20 labelled gap records
4. Add ② once ① passes

**Blocked on:** an `ANTHROPIC_API_KEY`, and (for AC-01) the labelled test gap records from the Talent Lead.

---

### 2026-07-22 — Built: AI document intake → personalised program → HIL queue

**Asked:** Let people upload a document (PDF/Excel) describing skill gaps; AI builds a personalised learning program from it; the recommendation goes to HIL. Never assign without HIL, and keep all the guardrails.

**Done — this is now implemented and running.**

#### 🔄 The flow

```
Upload PDF / Excel / CSV
        ↓
Extract  (PDF → native document block · Excel/CSV → flattened text)
        ↓
Claude Opus 4.8  — reads the doc, identifies each person, drafts a
                   personalised program from the APPROVED catalogue only
        ↓
Validate — every program must resolve to a real training_programs row
        ↓
Persist  — assignment (status = pending)  +  hil_queue (status = pending)
        ↓
🛑 STOPS HERE. A Talent Lead must Approve/Reject.
        ↓
Approve → assignment becomes `active`
```

#### 📁 Files added

| File | Purpose |
|---|---|
| `backend/services/extractor.py` | Turns an upload into a Claude content block. **PDFs pass through natively** (Claude reads layout and tables directly — better than our own text extraction). Excel via `openpyxl`, CSV via `csv`. Enforces 25 MB / 500-row / 200k-char caps and rejects unsupported types. |
| `backend/services/recommender.py` | The AI call. Pydantic schema (`IntakeResult` → `Candidate` → `ProgramOption`) constrains the output; the prompt carries the approved catalogue; `validate_against_catalogue()` enforces the approved-content guardrail. |
| `backend/routers/intake.py` | `POST /intake/upload`. Resolves resource + RFP, computes the deadline **in Python**, writes the pending assignment + pending HIL row, and audit-logs everything. |

#### 📝 Files changed

`backend/main.py` (register router) · `backend/config.py` (+`anthropic_api_key`) · `backend/.env` (+`ANTHROPIC_API_KEY` placeholder) · `backend/requirements.txt` (+`anthropic`, `openpyxl`) · `frontend/src/api.js` (+`uploadGapDocument`) · `frontend/src/components/screens/HilScreen.jsx` (upload banner + results modal)

#### 🔒 How each guardrail is enforced — in code, not in the prompt

| Guardrail | Enforcement |
|---|---|
| **Never assign without HIL** | `intake.py` creates the assignment with `status=AssignmentStatus.pending` and an `assert` immediately after, so a future change to the default fails loudly. The only path to `active` remains `POST /hil-queue/{id}/action`. |
| **Approved content only** | The model must copy a `catalogue_program_id` from the catalogue. A hallucinated **recommended** program raises and **nothing is written to the DB**; a hallucinated **alternative** is dropped with a warning. |
| **No AI deadline authority** | The prompt forbids dates; `_compute_deadline()` derives them from `engagement_start − deployment_buffer`, with a floor so a past engagement never yields a past deadline. |
| **Full traceability (BR-007)** | Every upload writes `ai_recommendation_created` (per person, with model ID and confidence) plus `intake_processed`. A rejected hallucination writes `intake_rejected`. The full AI proposal is stored in `proposed_program` before any human edit. |
| **English + UTC** | Prompt rule 5 + existing `TIMESTAMPTZ` columns. |

#### ✅ Verified

| Test | Result |
|---|---|
| Backend imports; `/intake/upload` registered | ✅ |
| CSV extraction (both people found) | ✅ |
| PDF → native `document` block, base64 has no newlines | ✅ |
| `.exe` upload | ✅ rejected (400) |
| Empty file | ✅ rejected |
| **Hallucinated recommended program** | ✅ **rejected — nothing persisted** |
| **Hallucinated alternative** | ✅ dropped, valid alternative kept, warning returned |
| Deadline: future engagement | ✅ `start − 7d` |
| Deadline: past engagement | ✅ falls back, never in the past |
| Frontend production build | ✅ exit 0 |
| Upload banner renders on HIL screen | ✅ zero console errors |
| Endpoint with no API key | ✅ clean 503 with actionable message |

#### ⚠️ Not yet runnable end-to-end

`ANTHROPIC_API_KEY` is **empty** in `backend/.env`. Until it's set, `POST /intake/upload` returns:

```
503  ANTHROPIC_API_KEY is not set. Add it to backend/.env to enable AI recommendations.
```

Everything before the model call — parsing, catalogue load, validation, persistence — is tested and working. The rest of the app is unaffected.

#### 🔀 Port change

Vite is now on **http://localhost:5180**, not 5173. The original dev server exited and an unrelated app ("Placement Pulse") claimed port 5173, so this project was restarted on a fixed free port with `--strictPort`.

---

### 2026-07-22 — Built: role-based platform — Coordinator Studio → HIL → Coursera-like learner

**Asked:** Split the app by role (no login): one role gets the list of people with skill gaps and **creates** the training program, test, and real-application sandbox work, then sends it for HIL approval; on approval it's assigned to the resource; resources access their training **like a learning platform (Coursera)**. UI should play a vital role. Roles aligned to the BRD.

#### 👥 The three roles (BRD-mapped)

| Role | BRD basis | What they see |
|---|---|---|
| **Training Coordinator** | The BRD agent's designation, "Training and Certification Coordinator" | **Program Studio** — gap list, program/test/sandbox builder, "Send to HIL" |
| **Talent Lead** | BRD §3.4: "Elevated + Approval … confirm training assignment recommendations" | The full original desktop — HIL queue, escalations, analytics, certs, audit |
| **Resource · Learner** | The BRD's "resources" (people being trained) | **My Learning** — Coursera-style courses with modules, graded test, sandbox |

A full-screen **role gate** picks the persona (no password, stored in localStorage); a chip at bottom-left switches any time. Each role gets its own dock.

#### 🔄 The new pipeline

```
Coordinator uploads a skill-gap doc (AI drafts)  ─┐
Coordinator creates a draft by hand              ─┤
                                                  ▼
                            DRAFT  (Program Studio — editable)
                                                  │  Coordinator authors modules,
                                                  │  test questions, sandbox brief
                                                  ▼  "Send to HIL"
                            PENDING  (Talent Lead's HIL queue)
                                                  │  🛑 only approval activates
                                                  ▼
                            ACTIVE  (assignment; assigned_date set — BR-003)
                                                  ▼
                    Learner: modules ✓ → test ≥ pass mark → sandbox submit
                                                  ▼
                            COMPLETE  → certification (pending) in the registry
```

#### 📁 Backend added/changed

| File | What |
|---|---|
| DB migration | `hil_status` gains `'draft'`; `assignments.learning_state JSONB` for learner progress |
| `routers/programs.py` **new** | Coordinator API: catalogue, list/create/edit drafts, **submit to HIL** (blocks drafts with no modules) |
| `routers/learning.py` **new** | Learner API: identity picker, courses, module completion, **server-graded test** (score, pass mark, attempts), sandbox submission. Completion (BR-005) flips assignment to `complete` and creates a **pending certification** |
| `routers/intake.py` | AI uploads now land as **Coordinator drafts**, not directly in HIL |
| `routers/hil.py` | Default queue hides drafts; deciding a draft → 409; **approve sets `assigned_date`** (BR-003) |

#### 🎨 Frontend added/changed

`RoleGate.jsx` (persona picker) · `StudioScreen.jsx` (two-pane gap list + program/test/sandbox editor) · `LearnScreen.jsx` (learner picker → course cards with progress bars → course detail with Modules/Test/Sandbox tabs) · per-role docks in `Desktop.jsx` · role state + switch chip in `App.jsx` · upload UI moved from HIL screen to the Studio.

#### 🔒 Guardrails (all verified by test)

| Rule | Enforcement | Verified |
|---|---|---|
| Never assign without HIL | Drafts & submissions keep assignment `pending`; deciding a draft returns 409; only `POST /hil-queue/{id}/action` approve/modify activates | ✅ 409 observed |
| Learner can't access unapproved training | Learning endpoints reject non-approved assignments | ✅ 409 observed |
| Drafts invisible to Talent Lead | Backend filter + UI filter | ✅ |
| Full audit trail | `program_draft_created` → `program_sent_to_hil` → `hil_approve` → `test_submitted` (per attempt) → `case_study_submitted` → `completion_verified` | ✅ all present |

#### ✅ End-to-end test (real API, no mocks)

Draft created → HIL blocked on draft (409) → learner blocked (409) → sent to HIL → approved by Talent Lead → learner sees course → 2 modules done → test failed at 0% then **passed at 100% (attempt 2 recorded)** → sandbox submitted → assignment `complete`, overall 100% → **HIPAA certificate appears in the registry as `pending`**. Browser-driven checks of all three role UIs: zero console errors.

**Note:** the AI upload path still needs `ANTHROPIC_API_KEY` in `backend/.env`; the manual Studio path works without it.

---

### 2026-07-22 — Added: sample documents for the AI intake

**Asked:** "Provide me the documents that I can upload."

Created **`sample-documents/`** in the project root — four ready-to-upload files, one per supported format, all verified against the extractor. Every skill gap in them maps to a program that exists in the approved catalogue, so the AI can recommend without inventing content:

| File | Format | Contains | Should map to |
|---|---|---|---|
| `skill_gap_roster.csv` | CSV | 4 people with role, current skills, gap, target proficiency, cert authority | HIPAA · Cloud Security · Agile PM · ML Bias Detection |
| `skill_gap_matrix.xlsx` | Excel | Styled matrix incl. two **existing** resources (R-1051, R-1088) to test resource matching | Cybersecurity · NLP Evaluation · DevOps · Risk Management |
| `assessment_report.txt` | Text | Narrative L&D assessment — one main subject + a second person mentioned in passing | GDPR · ISO 27001 |
| `skill_gap_report.pdf` | PDF | Formal Talent-Alignment-style report with a table (native PDF path — Claude reads layout directly) | Data Privacy · ISO 27001 |

Upload from **Training Coordinator → Program Studio → "Upload document"**. Requires `ANTHROPIC_API_KEY`.

---

### 2026-07-22 — Switched AI provider: Claude → OpenAI GPT

**Asked:** "It is asking for an Anthropic key but I want to use GPT 5.5 — change it and I'll give my credentials."

#### 🔁 What changed

| File | Change |
|---|---|
| `backend/services/recommender.py` | Rewritten for the **OpenAI SDK**: `client.chat.completions.parse` with the same Pydantic schema (structured outputs preserved). PDF uploads are translated to OpenAI `file` content parts (data-URL base64); text/Excel/CSV stay text parts. All guardrails unchanged and re-verified — hallucinated program → rejected, nothing persisted. |
| `backend/config.py` | `openai_api_key` + `openai_model` (default **`gpt-5.5`**, override via `OPENAI_MODEL` in `.env`). **`.env` now beats machine-wide env vars** for these two settings — a stale global `OPENAI_API_KEY` can no longer silently override the pasted key. Startup log prints the active model + whether a key is set. |
| `backend/.env` | `OPENAI_API_KEY=` + `OPENAI_MODEL=gpt-5.5` (Anthropic entries removed) |
| `backend/requirements.txt` | `anthropic` → `openai>=2.40.0` |

Provider errors now surface as clean 503s instead of raw 500s: bad key → "rejected the API key", unknown model → "does not recognise the model — set OPENAI_MODEL", empty quota → "no remaining quota".

#### 🧪 Live finding

The machine already had a **global `OPENAI_API_KEY`** env var. The full pipeline (CSV → extractor → OpenAI) executed and OpenAI answered **`insufficient_quota`** — the key is valid but the account has **no billing/credits**. So the wiring is proven up to OpenAI's paywall; a funded key is all that's missing. Follow-up check: the user's own pasted key authenticated fine (117 models visible, `gpt-5.5` included) but hit the same `insufficient_quota` — an account-billing issue, not a code issue.

---

### 2026-07-23 — Switched AI provider again: OpenAI → Google Gemini · **first successful live AI runs** 🎉

**Asked:** "Due to no credits I'm shifting my API key to Google AI Studio" (key provided).

#### 🔁 What changed

| File | Change |
|---|---|
| `backend/services/recommender.py` | Rewritten for **`google-genai`**: `client.models.generate_content` with `response_schema=IntakeResult` (same Pydantic schema — structured output preserved), PDFs passed natively via `Part.from_bytes`. Guardrails unchanged. Clean 503s for bad key / rate limit / unknown model. |
| `backend/config.py` | `gemini_api_key` + `gemini_model` (default **`gemini-2.5-flash`**, override via `GEMINI_MODEL`); same `.env`-beats-global-env precedence |
| `backend/.env` | `GEMINI_API_KEY` + `GEMINI_MODEL` (OpenAI entries removed) |
| `backend/requirements.txt` | `openai` → `google-genai>=2.0.0` |

Note: installing `google-genai` upgraded `pydantic` 2.7.1 → 2.13.4 in the venv; full-import check passed.

#### ✅ Live results — the AI pipeline ran end-to-end for the first time

**PDF** (`skill_gap_report.pdf`, read natively by Gemini): both people identified, both mapped to the correct catalogue programs — Aisha Osei → **GDPR Data Handling** (95%), Viktor Lindqvist → **ISO 27001** (95%). Personalised modules with hours + objectives, tailored sandbox tasks ("GDPR Cross-Border Transfer Compliance for a New Service", "Implementing ISO 27001 Controls in a Cloud-Native Platform"). Zero hallucination warnings.

**Excel** (`skill_gap_matrix.xlsx`): 4 people found; **Marcus Chen (R-1051) and Fatima Al-Rashid (R-1088) matched to their existing DB records** instead of being duplicated; the two new people got generated codes. One debatable mapping — Fatima's "risk management for AI delivery" gap drew **AI Ethics & Safety** rather than Risk Management Fundamentals — exactly the kind of judgment call the Coordinator-then-HIL pipeline exists to catch.

**6 drafts now sit in the Program Studio** awaiting Coordinator review → HIL.

⚠️ The Gemini key was shared in chat — consider rotating it at aistudio.google.com after the demo.

---

### 2026-07-23 — Decision: build the voice/avatar layer ourselves instead of depending on AgentCall

**Asked:** "About agentcall.dev, can I fork it from GitHub?" → "Then will we make something like how AgentCall works?"

#### 🔍 What I checked

Cloned `pattern-ai-labs/agentcall` and read it. Findings:

- **MIT licensed** (© 2026 AgentCall, Pattern AI Labs) — forking and reuse are permitted.
- The repo is **1.2 MB of client scripts + documentation**. There is **no server implementation** — no `server/`, `backend/`, or `api/` directory. Every script points at `https://api.agentcall.dev`.
- Therefore **forking does not let you self-host** and does not remove the need for an API key and credits. The meeting bot, voice engine, transcription and avatar rendering all run on their infrastructure.
- Genuinely reusable from the repo: `ui-templates/avatar/index.html` (256 lines, **zero external dependencies**) and `agentcall-audio.js` (audio queueing).

#### 🧭 The call

AgentCall splits into six layers. Only the first is hard, and it is the one this project does not need:

| Layer | Needed for Avathar? | Source |
|---|---|---|
| 1. Meeting bot (joins a Google Meet) | ❌ not needed | their infra only |
| 2. Speech → text | ✅ | Web Speech API (browser, free) |
| 3. Brain (intent) | ✅ | **existing** FastAPI + Gemini |
| 4. Text → speech | ✅ | `speechSynthesis` (browser, free) |
| 5. Animated avatar face | ✅ | SVG + CSS |
| 6. Display control | ✅ | React routing — Avathar *is* the UI |

AgentCall must screenshare a browser because its agent lives **outside** the app. Avathar lives **inside** it, so it navigates directly. Layers 2–6 cost nothing and need no external service.

**Decision: build in-house. AgentCall stays a possible later add-on** (only if Avathar should ever join a real meeting with human participants), not a dependency.

#### 🛡️ Guardrail carried forward

Voice may **navigate and narrate, never decide.** Gemini returns an *intent* from a fixed list plus a target name; the **backend resolves it against the database** — the model never emits an ID. Commands such as "approve this" are refused by design and instead open the approval screen, so the HIL gate still requires a human click. Same shape as the recommender guardrail: the model proposes, code resolves.

#### 📋 Planned build order

1. Avathar face — SVG, four states (idle / listening / thinking / speaking). No backend.
2. Voice loop — mic → on-screen transcript → spoken reply, hardcoded. Proves the plumbing.
3. Brain — `POST /avathar/command`, Gemini intent extraction, DB resolution.
4. Route wiring — each intent navigates the real app.
5. Rename Aarav → Avathar across UI, README and page title.

Steps 1–2 need only a browser; step 3 uses the existing Gemini key. **No code written yet — plan awaiting approval.**

---

### 2026-07-23 — **Avathar is live**: the app now has a voice-driven face at `/avathar` 🎙️

**Asked:** "Make something like how AgentCall works — the avatar is the face of my application at one URL; everything is shown by the avatar. 'Show the training of X' → it shows. 'Show all the HIL requests' → it displays. 'Accept Y's HIL request' → done internally, through voice commands."

#### 🧠 How it works

```
🎤 you speak → Web Speech API (browser, free) → POST /avathar/command
   → Gemini picks an INTENT from a fixed list + the person's name (structured output)
   → backend resolves everything against the real database (never the model)
   → { speech, view, data } → the panel displays it while Avathar talks back (speechSynthesis)
```

**One URL: `http://localhost:5180/avathar`** — animated avatar face (idle / listening / thinking / speaking states), live captions, mic button, and a typed-command fallback. Decisions go through a spoken **read-back + "confirm"** step before anything is written.

#### 📁 What was built

| File | What it does |
|---|---|
| `backend/routers/avathar.py` | The brain. `POST /avathar/command` → Gemini intent extraction (`response_schema=VoiceIntent`, temperature 0, real names passed in so misheard names snap to real people) with a keyword-regex fallback so voice still works with no API key. 9 intents: HIL queue, training-of-person, drafts, tracker, analytics, certifications, escalations, approve/reject. `POST /avathar/execute` runs a confirmed decision **through the exact same `hil_action()` code path as the button click** — same status flips, same audit log. |
| `frontend/src/avathar/AvatharPage.jsx` + `avathar.css` | The face + display. SVG avatar (blinking eyes, talking mouth, listening rings, thinking orbit), continuous speech recognition (`en-IN`, auto-restart, muted while Avathar speaks so it never hears itself), TTS voice picking, and 9 display views (cards, progress bars, stat tiles, tracker table, confirm card). |
| `frontend/src/App.jsx` | React-router split: `/avathar` → the Avathar page, everything else → the desktop. Purple 🎙️ **Avathar** launcher chip on the desktop. |
| `backend/routers/meetings.py` + `Meeting` model | **Meet mode adapter** (agentcall.dev): `POST /meetings/start` sends the bot into a Google Meet with the public `/avathar` page as its camera feed (`webpage-av` mode). Returns a clear 503 until `AGENTCALL_API_KEY` + `AVATHAR_PUBLIC_URL` are set in `.env` — same pattern as the Gemini key. |
| `frontend/index.html` | App renamed: title is now **"Avathar · Talent Nurturing"** (also fixed the mojibake). |

#### 🛡️ Guardrails (the model proposes, code resolves)

- Gemini only ever returns an **intent + a name** — never an ID, never SQL, never a DB write.
- Everything Avathar *speaks* is templated from real DB rows, not model output.
- **Approve/reject always requires spoken confirmation**: Avathar reads back exactly who and which program ("You're about to approve Sana Iqbal's request for Cloud Security Fast-Track. Say confirm…") and only "confirm" triggers execution. A mis-heard sentence can never decide anything silently. The human is still the decider — voice is just the input device.
- Voice decisions are visibly attributed: the HIL record shows **"decided by talent_lead (voice)"** and the audit log notes the spoken confirmation.

#### ✅ Verified live (servers restarted, Docker Desktop + `tn_postgres` brought back up)

- "show all the hil requests" → 13 items displayed, speech summarised 9 pending by name
- "show me the training of marcus chen" → his active NLP program + 1 waiting on approval
- **"accept sauna iqbal hil request"** (deliberately misheard name) → correctly matched **Sana Iqbal**, read back her Cloud Security Fast-Track, waited for confirm → executed → HIL **approved**, assignment **active**, instantly visible on her learning platform
- Playwright drove the page itself: welcome, HIL queue, training, and confirm views all screenshot-verified
- Nina Kovač's approval was brought to the confirm screen and deliberately **left pending** (not confirmed) — proving nothing executes without the confirm step

#### ▶️ How to use

1. Open **http://localhost:5180/avathar** in Chrome/Edge (mic needs Chrome or Edge + permission)
2. Click **🎙 Start talking** and say: *"show all the HIL requests"*, *"show the training of Sana Iqbal"*, *"approve Chen Wei's HIL request"* → then *"confirm"*
3. No mic? Type the same commands in the box below the button.
4. **Meet mode** (later): get an agentcall.dev key, tunnel port 5180 (e.g. ngrok), set both `.env` vars, then click **📹 Join a Meet** and paste a Google Meet link — the bot joins with the Avathar page as its camera.

---

### 2026-07-23 — Testing guide

**Asked:** "How to test my application now."

Wrote a hands-on test tour (no code changes; both servers were already running):
1. **Avathar** at `http://localhost:5180/avathar` (Chrome/Edge) — mic on, say "show all the HIL requests", "show the training of Marcus Chen", "show analytics"; then a voice decision: "approve Chen Wei's HIL request" → "confirm". Negative tests: "cancel" changes nothing, misheard names still match, typed-command box mirrors voice.
2. **Verify the decision is real** — Desktop → Talent Lead HIL queue shows *decided by talent_lead (voice)*; Audit log has the entry; Resource role shows the course live.
3. **Full pipeline** — Coordinator uploads a `sample-documents/` file → Gemini drafts → edit → Send to HIL → approve by voice on /avathar → learner completes modules/test/sandbox → certification pending.

Troubleshooting notes included (servers, mic permission, Gemini free-tier throttle, Meet mode 503 being expected).

---

### 2026-07-23 — Redesign: no separate Avathar page — it now lives **inside** the app and drives the **real screens**

**Asked:** "I don't want any new web interface. It should share my UI screens, act like ChatGPT/Gemini, and respond only to a fixed set of commands."

#### 🔁 What changed

- **Deleted** the standalone `/avathar` page and its route (`frontend/src/avathar/` removed, `App.jsx` reverted to plain desktop routing).
- **Added `frontend/src/components/AvatharAssistant.jsx`** (+ `avathar-assistant.css`): a floating **Av** orb on the desktop that opens a ChatGPT-style chat panel — command chips, message bubbles, mic button, typed input. Rendered for every role once a persona is picked; sits above the AARAV insights orb for the Talent Lead.
- **Commands now open the app's own windows** instead of rendering custom views:
  | Command | Real screen opened |
  |---|---|
  | show the HIL requests | HIL Approval Queue |
  | show the training of `<person>` | **My Learning** — sets `tn_learner` to that person (same as the picker) and opens the actual learner platform |
  | show analytics / tracker / drafts / certifications / escalations | the corresponding real window |
  | approve / reject `<person>`'s request | read-back → confirm (say it, type it, or click ✓) → same `hil_action()` code path → reopens HIL queue + refreshes data |
  Every reply is tagged "↗ opened <screen>" in the chat.
- **Fixed command set enforced**: anything off-list → *"That's not one of my commands — I only respond to a fixed set. Say help to hear them."* (backend `unknown`/`help` speeches updated; `show_training` now returns the person's `id` so the learner platform can be opened as them).

#### ✅ Verified with Playwright against the running app

- "show the hil requests" → real HIL window opened behind the panel, 8 pending summarised by name
- "show the training of sana iqbal" → real **My Learning** opened *as Sana*, her Cloud Security Fast-Track course card with Start course (backend restart was needed first — the old process predated the `id` change)
- "what is the weather today" → refused with the fixed-set message
- "approve chen wei's request" → read-back + confirm card → **Cancel** clicked → Chen Wei still pending (nothing executes without confirm)

Voice (mic + spoken replies) works the same as before — it's just inside the panel now. Speakers/mic behaviour unchanged: recognition pauses while Avathar talks so it never hears itself.

---

### 2026-07-24 — Avathar is now a true **assistant** — free conversation, not a command set

**Asked:** "I don't want a command set — I want it like an assistant."

#### 🔁 What changed

- **`backend/routers/avathar.py` rewritten as a conversational brain.** Every message now goes to Gemini with:
  - a **live database snapshot** built fresh per message (all assignments with person/program/status/progress/deadline, pending HIL approvals, drafts/certs/escalations counts) — so it answers arbitrary questions from real data;
  - the **chat history** (last 12 turns) — so follow-ups like "okay open that" or "show me the worst one of those" resolve correctly;
  - a persona prompt: helpful colleague, short spoken replies, never invent data.
- The model's only lever on the app is a typed `action` field: `open_screen` / `show_training` / `approve_hil` / `reject_hil` / `none`. Code still resolves names → rows; approve/reject still returns a **code-templated read-back + mandatory "confirm"** — even when phrased casually ("chen wei looks good to me, go ahead and approve him").
- **Frontend**: command chips replaced by four conversation-starter suggestions (only shown before the first message); placeholder is now "Ask me anything…"; each request carries the panel's transcript as history.
- One retry added around the Gemini call so transient free-tier 429s don't drop the chat into keyword-fallback mode (fallback still exists for fully offline use: it can navigate and decide, and says so).

#### 🐛 Found during testing: Gemini daily quota exhausted

`gemini-2.5-flash` free tier allows **20 requests/day** — used up by today's testing (429 RESOURCE_EXHAUSTED, quotaId `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Switched `GEMINI_MODEL` to **`gemini-2.5-flash-lite`**, which has its own much larger daily bucket. Note: the intake upload uses the same model setting; flash quota resets daily, so switch back in `.env` any time.

#### ✅ Verified live

- "what should I focus on today?" → "You have 8 items pending HIL approval. Would you like to review them?" (+ opened the queue)
- "who is behind schedule and by how much?" → named James Okonkwo (23 days), Sofia Martinez (27), Li Wei (30) — computed from real deadlines
- "how is sana iqbal doing?" → her program, progress, deadline — no action, just an answer
- "chen wei looks good to me, go ahead and approve him" → read-back + confirm required (guardrail intact under casual phrasing)
- UI: "who is behind schedule?" then "**show me the worst one of those**" → follow-up resolved from history, Assignment Tracker opened behind the chat

---

### 2026-07-24 — Your Avaturn avatar becomes Avathar's face + Microsoft Teams presentation path

**Asked:** "I want to add the avatar I created from Avaturn, and I want it to showcase my application in Teams."

#### 🧍 The 3D face (`frontend/src/components/AvatarFace3D.jsx`, three.js)

The assistant panel now has a face stage at the top that renders **your own Avaturn avatar** from `frontend/public/avathar.glb`:
- **Lip-sync flap** while speaking (drives ARKit blendshapes `jawOpen`/`mouthOpen` that Avaturn exports include), organic not metronomic
- **Blinks** every 2–5s, breathing sway, subtle head motion via the head bone
- **Listening** → attentive head tilt (green underglow) · **Thinking** → glances away (amber) · **Speaking** → purple glow
- Auto-frames head & shoulders whether the export is full-body or bust; gentle default smile
- **Not there yet?** The stage shows the animated SVG face with a hint. No avatar file was found on this machine — see "to do" below.

Verified with a generated test model: GLB loads, lights, frames at head height, zero console errors; test file then removed. **The real Avaturn export hasn't been through it yet** — drop it in and we'll see it together.

#### 📥 To put your face on it (2 minutes)

1. Go to **avaturn.me** → My Avatars → your avatar → **Export / Download**
2. Format: **GLB** (keep default settings — blendshapes/morph targets ON)
3. Save the file as exactly: **`frontend/public/avathar.glb`**
4. Refresh the app — the panel face stage becomes you

#### 📹 Teams

Confirmed from AgentCall's docs: **it supports Microsoft Teams, Google Meet, and Zoom** — the same adapter works for all three.
- `backend/routers/meetings.py` upgraded to **`webpage-av-screenshare`** mode: the bot's *camera* renders the new **`/avathar-cam`** page (your 3D avatar fullscreen, branded) while the bot's *screenshare* presents **the app itself**. Participants see the avatar in the people grid AND the application being presented.
- New 📹 button in the assistant panel header — paste a Teams link. Until `AGENTCALL_API_KEY` + `AVATHAR_PUBLIC_URL` (base tunnel URL) are set in `backend/.env` it replies with clear setup instructions instead of failing.
- **Zero-cost alternative that works today:** join the Teams meeting yourself, share your screen with *"Include computer sound"* on, and let Avathar present — its voice and the app both reach the meeting, no AgentCall account needed.

Also: `npm install three` (0.185.1), `frontend/public/` directory created, `-webkit-backdrop-filter` added for Safari.

---

### 2026-07-24 — **Aarav** (renamed from Avathar) wears your Avaturn avatar · guided tour mode · filter-by-command

**Asked:** "I uploaded model.glb in frontend; the avatar should be named Aarav, not Avathar; integrate model.glb with the application; give a full tour of all pages by sharing screen; filter options by commands."

#### 🧍 Your Avaturn model is live

- Found `frontend/model.glb` (14.5 MB) — moved to **`frontend/public/model.glb`** (Vite only serves `public/`); the loader now tries `model.glb` first, then legacy `avathar.glb`, then the SVG fallback.
- **Pose & framing fixes** (verified over 4 screenshot iterations): `updateMatrixWorld` before reading the head bone, camera distance based on model *height* not T-pose armspan, head-and-shoulders portrait framing, arms collapsed (`scale 0.001`) so the T-pose never shows — a clean talking-head bust.
- States confirmed on screen: idle portrait; **thinking** turns her head away; speaking drives `jawOpen`/`mouthOpen` blendshapes (watch it live when Aarav talks).

#### 🪪 Renamed: Avathar → Aarav

Panel header, orb, welcome text, backend persona ("You are Aarav…"), browser title, meeting bot name, cam route (now **`/aarav-cam`**), `Meeting.bot_name` default. Wake-word regex accepts aarav/avathar/avatar and common mishearings.

#### 🚶 Guided tour — built for screen sharing

Say/click **"Give me a tour of the application"**: Aarav walks through all 8 screens — Analytics → Tracker → Escalations → HIL → Certs → Audit → Studio → Learning — opening each real window and narrating it (HIL narration explains the human-in-the-loop guarantee). Runs client-side (no API quota), auto-advances after each narration, watchdog so a stalled TTS engine can't hang it, and **any new input stops the tour** ("stop" gets an acknowledgement).
For Teams **today**: join the meeting, share your screen with *Include computer sound*, say "give me a tour" — Aarav presents the whole app to the room.

#### 🎚️ Filter by command

New `filter` field in the assistant's action vocabulary + an `aarav-filter` window-event bus; TrackerScreen listens and drives its own chips.
Verified: *"show me only the overdue assignments"* → real Tracker opened, **Overdue chip selected**, exactly the 3 overdue rows (James Okonkwo, Sofia Martinez, Li Wei). Works in fallback mode too (keyword parser handles overdue/at risk/active/complete).

Backend restarted; tour + filter intents verified over the API; UI verified with Playwright; no console errors.

---

### 2026-07-24 — Fixed the self-hearing loop + diagnosed the "AI offline" message

**Asked:** Aarav kept repeating "I'm running without my AI connection…", and kept hearing its own speech as new input until the system was muted.

#### 🐛 Root causes (they fed each other)

1. **The echo loop**: the TTS watchdog was a fixed timer estimated from text length. When real speech ran longer than the estimate, it "finished" early and **un-muted the microphone while Aarav was still talking** — the mic heard his own sentence, treated it as user input, replied to itself, and repeated forever.
2. **The AI outage**: that loop hammered Gemini with every echo (2 attempts each) and **burned the entire project's free daily quota** — every model on the key now returns 429 RESOURCE_EXHAUSTED. The repeated sentence was the fallback message being triggered on every echo.

#### 🔧 Fixes (frontend `AvatharAssistant.jsx`)

- Watchdog now **polls `speechSynthesis.speaking`** and only completes when the engine has truly stopped (90s hard cap) — it can never un-mute mid-sentence.
- **Hard mute**: recognition results that arrive while `speakingRef` is set are dropped entirely.
- **Echo-similarity guard**: if >60% of the heard words are words Aarav just spoke, it's speaker bleed — discarded.
- **450ms grace period** after speech ends before the mic re-arms (lets the audio tail fade).
- **⏹ Stop is now a true stop**: kills the mic, a running tour, and cuts Aarav off mid-sentence.

#### 🔧 Fixes (backend `avathar.py`)

- **Circuit breaker**: on a 429, Gemini calls are skipped for 2 minutes — fallback replies come instantly (verified: 673 ms) instead of wasting ~4s per message on a dead quota.
- Friendlier fallback message that explains the situation and what still works.

#### ✅ Verified

Two consecutive commands in fallback mode: HIL queue opened, tracker opened filtered to overdue — exactly one reply each, no runaway repeats, no console errors.

#### ℹ️ Getting the AI back

- Free quota resets at **midnight Pacific ≈ 12:30 PM IST today**, or
- Create a **new API key in a new Google AI Studio project** (fresh daily quota, free, 2 minutes) and swap `GEMINI_API_KEY` in `backend/.env`, or
- Enable billing on the existing project.
Until then: navigation, tour, tracker filters, and voice approvals all work without the AI.

---

### 2026-07-24 — New Gemini key installed — but it shares the same exhausted project quota

**Asked:** New API key provided (`AQ.Ab8RN6LFUX...`) to restore the AI.

Swapped `GEMINI_API_KEY` in `backend/.env`, restarted the backend, probed live: **still 429 RESOURCE_EXHAUSTED — `limit: 20 … PerDayPerProject`**, and a retry after the suggested wait also failed. Conclusion: Google counts free-tier quota **per project, not per key** — the new key was created inside the *same* AI Studio project as the old one, so it draws from the same (already burned) daily pool. Also notable: this project's free limit is only **20 requests/day per model**.

**To actually restore the AI, one of:**
1. **New key in a NEW project** — aistudio.google.com → Get API key → Create API key → in the project dropdown choose **"Create API key in new project"** → paste the new key here.
2. A different Google account's key.
3. Wait for the daily reset (midnight Pacific ≈ 12:30 PM IST).
4. Enable billing on the project — removes the 20/day cap entirely (flash-lite costs fractions of a cent per chat message); the realistic option for demo days.

Meanwhile the app remains fully usable in fallback mode: tour, navigation, tracker filters, and confirm-gated approvals.

---

### 2026-07-24 — Same key re-sent — verified identical, still quota-blocked

The key pasted was byte-for-byte the one already in `backend/.env`; live probe still returns 429. Explained the AI Studio dialog step that matters: **+ Create API key → "Create API key in new project"** (picking the existing project reuses the exhausted pool). Alternative: a key from a different Google account.

---

### 2026-07-24 — AI restored: third key worked — new project, new model generation

**Asked:** Three API keys were provided in sequence to restore the AI.

The journey (each probed live before installing):
1. Key #1 — same project as the exhausted one → **429** (quota is per *project*, not per key)
2. Key #2 — genuinely new project but **403 "project denied access"** (blocked by Google, likely abuse detection; retried for 5 min in the background — never activated)
3. Key #3 — **worked**, but with a twist: the fresh project is a "new user" to Google, and **the whole gemini-2.5 generation is closed to new users** (404 "no longer available to new users"). Listed the project's models — it gets the **3.x generation** instead.

Tested `gemini-3.5-flash-lite` and `gemini-3.6-flash` with the assistant's structured-output pattern (`response_schema`) — both parse perfectly. Chose **`gemini-3.5-flash-lite`** (lite tier = largest free quota, the priority after today). `backend/.env` updated (key + model), backend restarted.

**Verified live:** "what should I focus on today?" → counts pending approvals and opens the queue · "who is behind schedule?" → six real names from the DB · "only show the ones that are overdue" → tracker opened with the overdue filter. Intake/document uploads also use this model setting.

⚠️ Three API keys have now passed through chat — after the demo, delete the unused ones at aistudio.google.com and consider rotating the live one.

---

### 2026-07-24 — Question: what does "Meeting mode is not configured yet" mean

Explanation (no code changes): the 📹 button is **bot mode** — Aarav joins Teams as its own participant via agentcall.dev (avatar as camera tile + app as his screenshare). It needs `AGENTCALL_API_KEY` (paid agentcall.dev account) and `AVATHAR_PUBLIC_URL` (public tunnel, e.g. `ngrok http 5180`) in `backend/.env`; the message is the honest 503 until those exist. The **free path needs no configuration**: join Teams yourself, share screen with "Include computer sound", and say "give me a tour" — recommended for the showcase.

---

### 2026-07-24 — Meeting mode: tunnel side configured — only the AgentCall key remains

**Asked:** "How can I make Aarav join the meeting?" (bot mode, not screen share).

Did the automatable half:
- Installed **cloudflared** via winget (free quick tunnels, no account — unlike ngrok)
- Started `cloudflared tunnel --url http://localhost:5180` → **https://festivals-visual-playstation-proven.trycloudflare.com**
- First hit returned **403** — Vite's dev-server host protection; fixed with `server.allowedHosts: ['.trycloudflare.com']` in `vite.config.js` (Vite auto-restarted)
- Verified through the public tunnel: app **200**, `/aarav-cam` **200**, `/api/health` **200**
- Set `AVATHAR_PUBLIC_URL` in `backend/.env`, restarted backend — the meetings endpoint now asks only for the API key

**Remaining (user-only step):** sign up at **agentcall.dev**, get an API key (`ak_ac_...`, paid credits), paste it here → it goes into `.env` → 📹 button joins Teams with the avatar as camera + app as screenshare.

⚠️ Quick-tunnel URLs change whenever cloudflared restarts — `.env` must be updated then (noted in the file).

---

### 2026-07-24 — AgentCall key installed — meeting mode is LIVE (join + camera + screenshare)

**Asked:** AgentCall API key provided (`ak_ac_wlga...`).

- Validated the key against the live API before installing: `GET /v1/auth/credits` → **2,100,000 credits**; `GET /v1/calls` → authorised, no active calls.
- Installed in `backend/.env`, backend restarted, both settings confirmed loaded (key + tunnel URL).
- Deliberately did **not** fire a test call — that would spawn a real bot into a bogus meeting and burn credits. First real test is user-driven with a genuine Teams link via the 📹 button (admit "Aarav" from the Teams lobby).

**Works now:** Aarav joins Teams/Meet/Zoom as a participant — camera = `/aarav-cam` (3D avatar via the tunnel), screenshare = the app.
**Not yet wired:** in-meeting voice — needs a WebSocket bridge (AgentCall transcript → `/avathar/command` brain → speak commands back into the call). Offered as the next build.
⚠️ Credits burn per meeting-minute — keep tests short. Tunnel URL changes if cloudflared restarts.

---

### 2026-07-24 — **Aarav can now talk, listen, and present in meetings** — the voice bridge

**Asked:** "It joined the meeting but cannot hear me or respond to me." (Screenshot showed Aarav presenting in a Google Meet — camera + screenshare working, but silent.)

The silence was the un-built voice layer. Built it in four parts:

| Part | What it does |
|---|---|
| **Collaborative voice** (`meetings.py` create-call) | The call now requests `voice_strategy: collaborative` — AgentCall's voice AI converses naturally when addressed ("Aarav, …"), grounded in a **live DB snapshot** sent as its context. Trigger words include common mishearings. |
| **WebSocket bridge** (`_bridge` in `meetings.py`) | Backend task connects to the call's socket, watches `transcript.final`. When Aarav is addressed with an app command it runs **the same brain as the in-app assistant**, then: navigates the shared screen, and injects short spoken confirmations. **Tour**: narrates all 8 screens aloud (`inject.verbatim`) while the screenshare follows. **Approvals keep the HIL guardrail in meetings**: read-back aloud → someone must say "confirm" → executes via the same `hil_action()` path, audit-logged as "(meeting voice)". |
| **Present-state channel** | `GET/POST /meetings/present-state` — the bridge writes {screen, filter, learner}; the bot's screenshare instance (loaded as `/?present=1`) polls every 1.2s, auto-picks the Talent Lead persona, and navigates the real app. In-app assistant hidden in this mode. |
| **Cam page audio + lip-sync** (`AaravCam` in App.jsx) | AgentCall loads `/aarav-cam?ws=<socket>`; the page now connects, plays the bot's voice audio (`tts.webpage_audio` chunks via the MIT-licensed `agentcall-audio.js`, copied to `public/`), reports interruptions back, and drives the 3D face — **the avatar's mouth moves while Aarav speaks in the call**. |

**Verified locally** (what's testable without burning credits): backend imports and runs; fresh browser at `/?present=1` auto-picked the Lead persona and, on a simulated bridge command, opened the **Tracker filtered to Overdue** (screenshot); `/aarav-cam` renders the fullscreen avatar portrait; no console errors. The live-meeting loop (speech ↔ voice AI ↔ bridge) needs a real call — next user test.

**How to test:** 📹 → paste a Teams/Meet link → admit Aarav → say *"Aarav, give us a tour"*, *"Aarav, show the overdue assignments"*, *"Aarav, how is Sana doing?"*, or *"Aarav, approve Chen Wei's request"* → *"confirm"*.

---

### 2026-07-24 — (Side task) Tailored resume for Qualcomm Software Test Engineer role

Rewrote `Downloads/nandini-Resume-SE.tex` against the JD + Jobscan report (score 53): exact job title in summary; JD keywords woven truthfully (test cases/plans, functional tests, validation, defect identification/analysis/documentation, embedded software, source code control, continuous integration tools = GitHub Actions, bug tracking tools = GitHub Issues, integration tools = Postman); prioritization + confidential-information soft skills placed in genuine spots; experience block restructured for ATS parsing; clichés removed; skills reorganised with new Testing & QA and Source Control & CI lines. No LaTeX toolchain locally — user recompiles in Overleaf. Flagged for honesty check: GitHub Actions / GitHub Issues claims.

### 2026-07-24 — (Side task) New resume variant for Qualcomm Associate Engineer (2027 Campus Hire, SW)

Created `Downloads/nandini-Resume-AssociateEngineer.tex` (STE version left untouched) tailored to the embedded/mobile SW JD + Jobscan report (score 49): exact "Associate Engineer" title in summary; JD soft-skill words (self-driven, creative, energetic, analytical/problem solving, communication skill, teamwork); Smart Pole promoted from Achievements to a full embedded/IoT project; KMIT Anvesha reframed as Android app with UI development; RLVO tagged image processing; skills reorganised (C/C++, OOP/OOD, OS concepts, TCP/UDP/IP, Linux/UNIX basics, WiFi) plus an honest "Areas of Interest" line carrying mobile technology / LTE / GSM / device driver & firmware development / drones / robotics / VR keywords. Deliberately did NOT claim CDMA/UMTS/SIP/BSP/kernel experience. Flagged for user verification: Smart Pole implementation details (microcontroller, WiFi), Linux/UNIX basics, GitHub Actions. Compile in Overleaf.

**2026-07-24 (follow-up):** Kept Smart Pole as a full project in the Associate Engineer resume per user confirmation; softened bullets to remove guessed hardware specifics (no repo/files exist for it).

### 2026-07-24 — (Side task) Third resume variant: Dunlin.ai/Caspian SW Engineering Intern

Created `Downloads/nandini-Resume-Intern.tex` for the Caspian (Dunlin.ai) internship. Angle: agent-to-human interaction — Talent Nurturing Agent (agentic HIL) led, HR dashboard reframed as automated notifications/messaging platform, Smart Pole demoted to achievements, 10th-grade education dropped, summary speaks directly to their pitch ("small correct PRs over big broken ones"). Advised user the real application is a quality PR to github.com/tryCaspian/caspian-sdk — and warned about their AI-slop ban policy.

---

### 2026-07-26 — Connected the project to Git

**Asked:** "I want to connect my VS Code to Git."

**Found:** Git 2.51.0 was already installed and configured globally (user `nandini`, email `syamalanandini49@gmail.com`) — so VS Code's Source Control panel was ready; the only missing piece was that this folder wasn't a repository.

**Done:**
- Created `.gitignore` **before** initializing, covering: `backend/venv/` + `venv_broken/`, `__pycache__/`, **`.env` (holds the Gemini API key — must never be committed)**, `node_modules/`, `frontend/dist/`, `test-results/`, zips.
- Ran `git init` — repository created at the project root.
- Verified with `git check-ignore` that `backend/.env`, `backend/venv`, and `frontend/node_modules` are all ignored.

**Not done (deliberately):** no commit was made and no GitHub remote added — first commit and GitHub publishing left to the user via VS Code's Source Control panel / "Publish Branch" button.

**Follow-up (same day):** "Create a repo and commit all changes."
- Unstaged `.claude/settings.local.json` (machine-specific Claude Code permissions) and added it to `.gitignore`.
- Created the **initial commit** on `main`: `ae149a4` — 85 files, 18,364 insertions. Verified `backend/.env` is not in it.
- GitHub publishing still requires the user's sign-in: **Source Control panel → "Publish Branch"** (choose private/public).
