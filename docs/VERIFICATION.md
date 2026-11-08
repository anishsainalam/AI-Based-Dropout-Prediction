# Verification record

## CatBoost replacement — 4 November 2026

- Replaced the XGBoost candidate and dependency with CatBoost 1.2.10. Both requirements files include CatBoost; the lock includes its transitive dependencies. The project environment no longer has XGBoost installed, and `pip check` reports no broken requirements.
- Retrained all five candidates on the same 2,400 synthetic observations and regenerated `data/artifacts/model.joblib` and `model-card.json`. CatBoost validation average precision is 0.7324; Random forest remains selected at 0.7474. Model version: `v20261104-072305-67731a`.
- **32 tests passed**: 10 ML tests and 22 API tests. Coverage includes real CatBoost training, saved/reloaded probability equality, serving predictions and additive explanations, a missing-CatBoost installation error, and the CatBoost comparison/version returned by `/api/model`. The two existing upstream test-client deprecation warnings remain.
- Confirmed the saved bundle and JSON report agree. Model Insights reads the API comparison, so its model table now includes CatBoost. No frontend source changes were needed.
- Previous demo artifacts were backed up before retraining. Application tests used an isolated temporary database; this update did not change the operational database. Historical security-audit results below were not rerun.

## Previous verification — September 2026

Implementation and automated verification: **27 September 2026**. Final live-app and responsive follow-up: **30 September 2026**. Environment: Windows, Python 3.13, Node 22.20, SQLite.

## Automated results

- **31 tests passed**, using an isolated temporary database. Two upstream FastAPI/Starlette test-client deprecation warnings remain; no application test failures.
- TypeScript type checks and the Vite production build passed after the final navigation change.
- That training run evaluated Logistic Regression, Decision Tree, Random Forest, Histogram Gradient Boosting and XGBoost. The current `data/artifacts/model-card.json` supersedes that report with the CatBoost comparison described above.
- ML tests intercept each real pipeline fit and prove that candidates fit only training indices, final refit uses train + validation, and no held-out test row enters any fit. They check imputer medians, full-precision validation selection, saved/reloaded prediction equality, confusion-matrix count and exact Shapley additivity.
- Training rejection tests cover identical observations, repeated or whitespace-equivalent student IDs, blank IDs, duplicate columns, non-finite measurements, missing features and invalid target classes.
- API tests cover role isolation, CSRF, forced password change, provisioning/reset/suspension, revocation, login throttling, student creation, duplicate enrollment conflicts, full profile updates, validation without echoed input, history pagination and immutability, restart/model activation persistence, and analytics filters/counts.
- Import tests cover CSV/XLSX, templates, custom headers, reviewed conversions and derived percentages, exact-match precedence over fuzzy matches, row validation, atomicity, ownership, idempotency and streamed size limits.
- Both `compose.yaml` and `compose.production.yaml` passed `docker compose config --quiet` with non-secret placeholder environment values for the production syntax check.

## Browser workflows verified

- Professor demo login, current dashboard, directory search and student profile.
- Created fictional **DEMO20260927 / Demo Evaluation Student**, edited attendance from 62 to 85, and confirmed both genuine prediction snapshots retain their own inputs. Scenario calculation did not save a third snapshot.
- Created a fictional support plan, completed it and verified it appears in Completed plans.
- Uploaded `demo-import.xlsx`, reviewed all 11 correctly matched columns, validated all three rows and committed updates. The UI reported **0 created / 3 updated** with fresh predictions and saved import history.
- Model insights displays the actual five validation comparisons, final holdout metrics and ROC/PR/calibration diagnostics.
- Analytics department and semester filters returned **41 Data Science students in semester 4** in the demonstrated database, with current support counts and within-model changes.
- Settings, administrator account directory, separate student sign-in and the private student workspace were opened. Account credential mutations were tested against isolated test data, not live accounts.
- The session-expiry message appeared after the multi-day pause; a fresh professor demo login restored access as designed.
- Desktop inspection used 1440 × 960. Mobile inspection used 390 × 844; overview, analytics and student portal had no horizontal document overflow. Profile layout and saved history were checked again during the final follow-up.
- Browser error logs were empty before session-expiry testing. API logs showed a healthy running service with no application traceback.

## Data preservation

The existing application, design, student records and support plans were preserved. A consistent online SQLite backup, prior source files and prior model artifacts were saved before edits in this task's `work/before` directory. Existing students received only their actual last known baseline prediction; no historical timeline was invented. New predictions are appended transactionally alongside each change.

## Limits

The model uses synthetic demonstration data. Its scores do not establish performance on real students. Faculty access is campus-wide; department-scoped/multi-tenant authorization is not implemented. No messages are sent and there is no automatic LMS connection.

Docker CLI is installed but its engine is stopped. Container execution, PostgreSQL runtime behavior and cloud deployment have **not** been verified. The supplied production configuration still requires a real validated model, HTTPS, institution-approved data handling and operational setup as documented in DEPLOYMENT.md. No public deployment was made.

Dependency security scan results in `security-audit.json` belong to the prior 15 September build; no new security audit or penetration test is claimed by this continuation.
