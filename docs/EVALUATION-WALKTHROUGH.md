# Continuum — evaluation walkthrough

The existing project is open in VS Code as **Continuum (Workspace)**. Start it with `Start Continuum.cmd` in the project root. Open http://127.0.0.1:8000. Stop with `Stop Continuum.cmd`. The frontend production build and API are served together; for frontend development, run `npm.cmd run dev` in `frontend` while the API runs on port 8000.

## Demo accounts

| Portal | Sign-in ID | Password |
|---|---|---|
| Professor | faculty@continuum.demo | Continuum@2026 |
| Professor / administrator | admin@continuum.demo | ContinuumAdmin@2026 |
| Student | STU2024001 | StudentDemo@2026 |

These are fictional-data accounts, enabled only in demo mode. The sign-in page also provides demo buttons.

## Demonstrate the workflow

1. Sign in as professor. Explain that the dashboard counts come from saved records and the model is synthetic demonstration data.
2. Open Students. Search for **DEMO20260927**, the fictional evaluation example added during verification. Open its profile to see measurements, probability, risk band, Shapley contributions and two genuine saved prediction snapshots.
3. Use **Add student** for a new fictional record, or **Edit profile** / **Update data** for verified measurements. Saving creates a prediction snapshot. Use **View inputs** in history to compare exactly which measurements were scored.
4. Use **Calculate scenario**. It returns a fresh estimate without updating the saved record or history.
5. Create a support plan; it is private to faculty unless explicitly shared. Complete/reopen it from Support plans. The evaluation example has one completed fictional plan.
6. Open Data imports. Use `data/demo-import.csv` or `data/demo-import.xlsx`, review suggested columns and units, validate, and commit. Existing enrollment IDs are updated; repeated commits do not duplicate records. Custom headers are supported, but missing measurements must be supplied or calculated from valid counts.
7. Open Analytics. Filter department and semester; inspect support coverage, overdue follow-ups and comparison of the latest two snapshots. Model changes are shown separately rather than misrepresented as student progress.
8. Open Model insights. Show all five actual validation results, the selected model, holdout metrics, confusion matrix and diagnostic curves. Explain the difference between a 50% classification threshold and illustrative 30%/60% support bands.
9. Sign out, choose Student and use the student demo. Only that student's academic record and shared support plans are visible. Administrative risk analytics and other students are inaccessible.
10. Sign in as administrator to review Student accounts. Organization-issued accounts, temporary passwords, first-login changes, resets and suspensions are covered by isolated integration tests.

## Validation and rerunning

From the original project root:

```powershell
.venv/Scripts/python.exe -m pytest -q
cd frontend
npm.cmd run build
```

Current result: **31 tests passed**; production frontend build passed. API tests use a temporary database. Two upstream test-client deprecation warnings remain; no application tests fail.

To retrain the same synthetic demonstration:

```powershell
cd backend
../.venv/Scripts/python.exe -m app.ml
```

Restart the backend to activate the new trusted pipeline. See README and `docs/ML-METHODOLOGY.md` for replacement real-data training. Keep a final real-cohort test set outside development and do not treat demo results as institutional validation.

## Deployment status

Windows + SQLite is demonstrated locally. Docker Compose configuration syntax is checked for both local and production files. Docker's engine is stopped on this machine, so container execution and PostgreSQL remain unverified. No site has been published. Use `docs/DEPLOYMENT.md` for HTTPS, PostgreSQL, persistent storage and account configuration.

## Running npm from the VS Code project root

`npm run dev` now works directly from `student-success`; the root package forwards to the frontend. Open http://127.0.0.1:5173. Keep the backend on port 8000 using `Start Continuum.cmd` or `npm start`. Use the command without a trailing backslash. On a fresh installation, run `npm run setup:frontend` once. The development page and proxied API health endpoint were verified successfully on 30 September 2026.
