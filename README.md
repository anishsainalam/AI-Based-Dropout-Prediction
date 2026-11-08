# Continuum — AI-Based Student Dropout Prediction System

A complete local professor, student, and administrator web application: React + TypeScript, FastAPI, SQLAlchemy, SQLite/PostgreSQL, and a replaceable scikit-learn/CatBoost training pipeline. The interface, API, sessions, student records, imports, predictions, and support plans work together end to end.

## Open the app

**Local address:** http://127.0.0.1:8000

On Windows, double-click **Start Continuum.cmd**. It builds the website if needed, starts the backend in the background, waits for readiness, and opens your browser. First startup on a new machine installs dependencies and trains a demonstration model. Use **Stop Continuum.cmd** to stop this project's server.

**Demo faculty:** `faculty@continuum.demo` / `Continuum@2026`

**Demo administrator:** `admin@continuum.demo` / `ContinuumAdmin@2026`

The sign-in page also has **Explore faculty demo**. Demo credentials exist only when `DEMO_MODE=true`; production refuses to start in demo mode. Demo students are fictional, including all names and email addresses. The attached project allocation spreadsheet was not used as student training data.

**Demo student:** choose Student, then use `STU2024001` / `StudentDemo@2026`.

## Organization-issued student access

Sign in using the administrator demo, open **Student accounts**, and choose **Issue student account**. Select an imported student; their enrollment number is the login ID. Give the one-time temporary password to that student through your institution’s approved private channel. They must change it on first login. Administrators can reset or suspend access. Students cannot register themselves, read other students, or open faculty APIs. Their workspace contains only their academic record and support plans explicitly shared by a professor.

## What works

- Separate Professor and Student sign-in sections; organization-managed student accounts; hashed passwords; revocable 8-hour HttpOnly cookie sessions; CSRF verification; sign-in throttling; password changes revoke existing sessions.
- Dashboard computed from saved student records: cohort counts, current risk distribution by department, attendance, highest-risk students, and upcoming support plans.
- Searchable, filterable, paginated student directory; filtered CSV exports; direct student creation; identity and academic profile editing; automatic rescoring. Enrollment IDs remain unique and edits update linked student accounts.
- Append-only prediction history with model version, timestamp, reason, actor and exact input snapshot. Imports, academic edits and model activation save history in the same transaction. Scenario calculations remain unsaved.
- Dedicated analytics with department/semester filters, academic averages, support coverage, overdue follow-ups, completed plans, and comparison of the latest two predictions only when the model version matches.
- CSV/XLSX imports with arbitrary headers, reviewed automatic alias matching, explicit unit conversions, percentages derived from counts, optional templates, drag-and-drop upload, row-level validation, preview, explicit commit, update by student ID, and import history. The complete validated file is applied in one database transaction. Repeated commit requests are idempotent.
- Dropout probabilities and Low/Medium/High support triage bands. Individual explanations use exact single-reference Shapley values over all 64 feature subsets, in probability space. Contributions are additive, but are not causal; the reference is the development-set median vector, not a population average.
- A scenario explorer that recalculates risk without changing the saved student record.
- Persistent support plans with owner, follow-up date, notes, completion, and reopening.
- Model insights with actual validation comparisons, final holdout metrics, permutation feature importance, confusion matrix, ROC/precision–recall/calibration curves, data fingerprint, and limitations.
- Administrator activity audit; responsive desktop/mobile layouts; keyboard-accessible forms and native modal dialogs; locally bundled fonts.

## Important model boundary

The included model is trained on **2,400 synthetic observations**. It demonstrates the complete pipeline; its scores do not validate use on real students. Training compares Logistic Regression, Decision Tree, Random Forest, Histogram Gradient Boosting, and CatBoost. The model with the highest validation average precision is selected; the current results appear in Model Insights and `data/artifacts/model-card.json`.

The target is **observed dropout** (`1`) versus **observed continuing/completed outcome** (`0`), not a subjective “at risk” label. Features must be captured before the outcome window. Faculty risk thresholds (30% and 60%) are illustrative. Predictions are for supportive human review and must not trigger automatic educational or disciplinary decisions.

See [ML methodology](docs/ML-METHODOLOGY.md) and [data dictionary](docs/DATA-DICTIONARY.md) before replacing demo data.

## Project structure

```text
student-success/
  frontend/src/          React application, pages, components, styling
  backend/app/           API, database schema, security, imports, training
  backend/tests/         Integration tests with an isolated temporary database
  data/demo-import.csv   Three fictional sample import records
  data/demo-import.xlsx  The same sample in Excel format
  data/demo-training.csv Reproducible generated training dataset
  data/artifacts/        Local model bundle and model-card.json (not committed)
  data/continuum.db      Local application database (not committed)
  docs/                 Model, data, deployment and verification documentation
  scripts/              Windows start and stop launchers
  Continuum.code-workspace
  Dockerfile
  compose.yaml
  compose.production.yaml
```

## Work in VS Code

Open **Continuum.code-workspace**. Use Terminal → Run Task for “Continuum: Start app”, “Continuum: Backend tests”, or “Continuum: Build frontend”. Python debugging is configured; stop the existing server before launching the debugger on port 8000. Install the recommended Python extension if debugging is needed.

## Commands from the project root

You can run these directly from the `student-success` folder open in VS Code:

```powershell
npm run dev
```

This starts the frontend development server at http://127.0.0.1:5173 and forwards API requests to the backend on port 8000. Keep the backend running using `Start Continuum.cmd` (or `npm start`). Your Python virtual environment can stay activated. Type the command without a trailing backslash.

The root package delegates frontend commands to `frontend/package.json`; `npm run build` also works from the project root. On a fresh installation, `npm run setup:frontend` installs frontend dependencies. `npm start` and `npm stop` use the existing Windows launchers for the full locally built application.

## Manual setup

Requires **Node 22.12+** and **Python 3.11–3.13** (tested with Node 22.20 and Python 3.13 on this laptop).

Windows PowerShell, from this directory:

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements-lock.txt
Copy-Item .env.example .env
cd frontend
npm.cmd ci
npm.cmd run build
cd ..
.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The manual command uses the environment already set in your terminal; `.env` is loaded by the Windows start script, not automatically by Python. Defaults work for a local demo. Stop the manually run server with Ctrl+C.

macOS/Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-lock.txt
cd frontend && npm ci && npm run build && cd ..
.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

For live frontend development, keep the API on port 8000 and run `npm run dev` in `frontend`. Open http://127.0.0.1:5173. Vite forwards `/api` requests to FastAPI, so cookie-based authentication stays on the same browser origin.

## Run tests

```powershell
.venv/Scripts/python.exe -m pytest -q
cd frontend
npm.cmd run build
```

The 4 November 2026 run passed **32 API/ML tests** (10 ML and 22 API tests). Tests check actual model fitting against the holdout split, preprocessing statistics, serialization, CatBoost predictions and required installation, Shapley additivity, training-data rejection, history persistence, direct profile creation/editing, analytics, and student isolation, forced first-login password changes, issuance/reset/suspension, flexible column mapping, ownership, and streamed request limits.

Tests copy the trusted model artifact into an isolated temporary directory and never alter your running database. They cover authentication, authorization, CSRF, predictions, filtering, pagination, CSV/XLSX validation, import atomicity/idempotency, support plans, edits, model consistency, exports, logout, password revocation, and throttling.

## Train on your own data

```powershell
cd backend
../.venv/Scripts/python.exe -m app.ml --csv "C:/path/to/observed-outcomes.csv" --source "Institution, cohort and outcome window" --output ../production-data/artifacts
```

Training is an administrator CLI workflow, separate from student imports. All five estimators, including CatBoost, are required. Duplicate student IDs, blank IDs when supplied, identical feature observations, invalid measurements and invalid outcome labels are rejected before splitting. Selection uses full-precision validation average precision; the test set is excluded from fitting and selection. Restart the API after installing the trusted model artifact. Existing stored predictions are refreshed when their model version differs, retaining earlier snapshots in prediction history. Never load an untrusted `.joblib` file.

To create a faculty account in a configured installation:

```powershell
cd backend
../.venv/Scripts/python.exe -m app.manage create-user faculty@institution.edu "Faculty Name" --role faculty
```

The utility prompts for the password. Run it with the same `DATABASE_URL` and environment as the application.

## Hosting recommendation

For a fictional-data demonstration, use Render for the complete app plus Neon PostgreSQL for persistent data. Vercel Hobby is limited to personal, non-commercial use. Free hosting has resource and uptime limits; real student records need institution-approved operations. See [hosting and security](docs/HOSTING-AND-SECURITY.md) and [verification](docs/VERIFICATION.md). No cloud deployment has been performed.

## Deploy

`docker compose up --build` starts a local demo with a persistent volume. For a real installation, use the separate PostgreSQL production configuration and HTTPS reverse proxy described in [deployment instructions](docs/DEPLOYMENT.md). Production mode requires a real-data model and explicit administrator credentials. It does not seed demonstration accounts or student records.

This is a working product foundation. Institutional production rollout still requires real-cohort validation, appropriate access scope, backup operations and a security/privacy review. Docker/PostgreSQL configuration is included; the local SQLite application is the environment tested on this laptop.

## Troubleshooting

- **Port 8000 in use:** stop the existing Continuum process using its launcher; do not start a second copy. Inspect `logs/server-error.log` if startup fails.
- **Changed frontend:** stop and restart with the launcher, or run `npm run build` and refresh the browser. Frontend builds do not require a backend restart.
- **Changed backend:** restart the server.
- **Sign-in after 8 hours:** the session expires by design; sign in again.
- **Rejected import:** review the suggested column meanings and units, map any unfamiliar headers, and supply missing academic inputs. Extra unmapped columns are ignored. Fix the reported rows and upload again.
- **Production refuses demo model:** train real observed outcomes into the configured artifact directory, then restart.
- **Database changes:** fresh tables are created automatically; the included additive migration upgrades the earlier faculty-only database for student accounts. Back up before future schema changes.

## September 27 continuation

This update continues the exact `Continuum.code-workspace` project from September 14; it does not replace the original application or reset its database. See [continuation audit](docs/CONTINUATION-AUDIT.md), [demonstration walkthrough](docs/EVALUATION-WALKTHROUGH.md), and [current verification](docs/VERIFICATION.md).

The API uses `moderate` internally for backwards compatibility; the interface labels that band **Medium** (30% to less than 60%). Model training stays separate from operational student imports. Earlier historical predictions were not available in the old schema: each existing student receives only their actual last known baseline snapshot, followed by genuinely recorded events.
