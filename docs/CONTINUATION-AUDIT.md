# Continuation audit — 27 September 2026

Historical record: the model comparison described below was updated on 4 November 2026 to replace XGBoost with CatBoost. See [current methodology and measured results](ML-METHODOLOGY.md) and [verification](VERIFICATION.md).

## Project located and preserved

Inspected the original September 14 `outputs/student-success` folder and confirmed VS Code's open window is **Continuum (Workspace)**. It is a project folder without an existing Git repository. Source, database, styling and working functionality were continued in place. Before changes, source files, trusted model artifacts and a consistent SQLite online backup were saved in the current Codex task's `work/before` folder.

| Area | Finding before this continuation | Result |
|---|---|---|
| Stack and UI | Working React/TypeScript + FastAPI + SQLAlchemy; polished blue/white Continuum design | Preserved and extended |
| ML | Five real estimators, synthetic data, 60/20/20 split, saved pipeline and metrics already implemented | Retrained; full-precision selection, duplicate/ID/column guards, mandatory XGBoost, split fingerprints and calibration/ROC/PR diagnostics added |
| Faculty/student/admin authentication | Separate portals, provisioned accounts, CSRF, hashed sessions and role restrictions implemented | Preserved, exercised; sign-out now resets navigation; validation responses avoid echoing submitted values |
| Student records | Directory, profiles and academic edits worked; direct creation and full profile editing missing | Creation and full profile editing added with uniqueness validation and account-name synchronization |
| Prediction history | Only latest probability/model version stored | Append-only snapshots added; actual previous baseline preserved; edits, imports and model activation recorded transactionally |
| Explanations | Single-feature median replacement, nonadditive | Exact single-reference Shapley decomposition added with baseline and explicit limitations |
| Imports | CSV/XLSX mapping, preview, transactional commit, ownership and idempotency already implemented | Fixed exact-header matches being cleared by fuzzy count aliases; regression-tested canonical workbook and custom headers |
| Analytics | Dashboard aggregates existed; no dedicated filtered analytics page | Added department/semester filters, academic means, support coverage and within-model change counts |
| Support plans | Persistent private/shared plans, completion and reopening implemented | Preserved and browser-tested; analytics identifies coverage gaps and overdue plans |
| Local operation | Windows launcher and SQLite worked | Built, started, stopped, restarted, browser-tested; existing records retained |
| Deployment | Docker, PostgreSQL and Render configurations existed | Local and production Compose syntax validated; container/PostgreSQL runtime remains untested because Docker engine is stopped |

## Honest boundaries

- All delivered model performance is from a clearly labeled synthetic dataset. No real-cohort performance is claimed.
- Existing history before this update cannot be recovered. Baseline snapshots preserve only the last stored record, with its original timestamp and model version.
- Faculty roles operate at the campus level. Department-level or multi-institution authorization is not implemented.
- The system does not send support emails/SMS or connect automatically to a live LMS.
- Model training is a documented offline administrator process; there is no web training-job manager.
- No cloud deployment or Docker/PostgreSQL runtime validation was performed.
