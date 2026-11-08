# Deployment and operations

## Local Windows deployment

Double-click `Start Continuum.cmd`, or run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1`. The script loads `.env`, builds the frontend, starts a loopback-only service at port 8000, and records its process in `logs/server.pid`. Fonts and assets are served locally; no external AI API or account is required.

`Stop Continuum.cmd` validates the recorded process command against this workspace before stopping it. The launcher does not install a Windows service or start automatically at boot. Student data survives restarts in `data/continuum.db`.

## Container demo

Install Docker from its official distribution. From the project directory:

```sh
docker compose up --build -d
docker compose logs -f app
```

Open http://127.0.0.1:8000. A named volume preserves SQLite records and trained artifacts. The service is bound to the local machine. `docker compose down` stops it while retaining data; do not delete the volume unless you intend to erase that installation.

## Real institution / PostgreSQL

The production configuration is a separate file. It does not use the demo database or accounts.

1. Prepare real, consented/authorized, pre-outcome observations and observed outcomes. Train into `production-data/artifacts` using the README command. Validate the model on an independent future cohort before operational use.
2. Prepare the required environment values. Use a randomly generated URL-safe database password (letters and digits avoid URI escaping mistakes):

```dotenv
POSTGRES_PASSWORD=REPLACE_WITH_A_LONG_RANDOM_ALPHANUMERIC_PASSWORD
PUBLIC_ORIGIN=https://continuum.your-institution.example
ADMIN_EMAIL=admin@your-institution.example
ADMIN_PASSWORD=REPLACE_WITH_A_UNIQUE_PASSWORD_OF_AT_LEAST_12_CHARACTERS
ADMIN_NAME=Campus Administrator
```

3. On Linux, ensure the container user (UID 10001) can write the `production-data` directory. Protect `.env` and model files with deployment-appropriate filesystem permissions.
4. Start the dedicated configuration:

```sh
docker compose -f compose.production.yaml up --build -d
```

5. Configure an HTTPS reverse proxy on the same host to route your exact public origin to `127.0.0.1:8000`. Set a request size limit of 6 MB, timeouts suitable for imports, security headers and a login rate limit appropriate to the institution. The app requires Secure cookies in production; production authentication will not work over plain HTTP.
6. Issue student accounts from the administrator Student accounts screen after importing their records. Temporary passwords are displayed once and require a first-login change.
7. Provision faculty accounts with `python -m app.manage` inside the app container, from `/app/backend`, using the same configured environment. There is no open registration endpoint.

The app deliberately refuses production demo mode, a synthetic model in non-demo mode, or a fresh non-demo installation without administrator credentials. Seed credentials are read only when creating the first user; changing `.env` does not rotate existing account passwords. Use the in-app password form for an existing account.

## Operational boundaries

- This is a **single-campus workspace**. Faculty can access all student records, imports they own and campus support plans. Administrators additionally see audit activity and manage student accounts. Students can access only their linked academic record and explicitly shared support plans. Department and multi-tenant authorization are not implemented.
- Sessions are stored in the database, expire after eight hours, and are revoked on logout/password change. Cookie contents are random session tokens; only token hashes are stored. Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations and a random salt.
- Mutating authenticated endpoints require a session-specific CSRF header; browser mutation origins are allowlisted. Do not use wildcard origins with authenticated deployments.
- The built-in login throttle is process-local and counts sign-in attempts per observed client IP. A reverse proxy should implement shared throttling and trusted proxy handling for multiple workers or hosts. The delivered server runs one worker.
- Enforce request body limits at the reverse proxy as well as the app's file limits. The app also enforces a streamed request-body cap, including requests without Content-Length; ingress limits remain necessary.
- Never expose the database port publicly. Use backups, encryption at rest, retention policies and institution-approved hosting for real student data.
- Take database backups before schema changes. The included additive migration upgrades the earlier faculty-only schema with student account links, mandatory password changes, and support-plan visibility. This continuation adds the prediction_history table through SQLAlchemy metadata and preserves the last known baseline for existing records. Add reviewed migrations for subsequent schema changes.
- SQLite backup: stop the application before copying the database, or use SQLite's online backup API. Do not copy a live WAL database file alone.
- PostgreSQL backup: use `pg_dump` with an appropriately secured backup destination and test restoring it.
- Import staging rows and audit records are retained in the database. Implement a retention schedule before live institutional operation. Successful imports discard staged row payloads; abandoned validated previews may retain student data.
- The UI records support notes only. It does not send emails or SMS, and it does not integrate with an LMS automatically.
- The model is loaded once per server process. Activate a trusted replacement model and restart; the startup refreshes records from older model versions. Do not overwrite a production model while training is unfinished.

## What was verified here

The Windows + SQLite path was built, launched and exercised. The backend integration tests use a separate database. Docker CLI is installed, and both Compose configurations passed syntax validation on 27 September 2026. The Docker engine is stopped, so the container and PostgreSQL runtime paths have not been executed here. See `VERIFICATION.md` for the completed checks and known limitations.
