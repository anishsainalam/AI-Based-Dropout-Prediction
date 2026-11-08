# Hosting recommendation and security boundaries

Reviewed against provider documentation on 15 September 2026. Free tiers can change.

## Recommendation

For a **small demonstration using fictional data**, use **Render for the complete React/FastAPI application and Neon PostgreSQL for persistent data**. Keeping the website and API on the same HTTPS origin simplifies secure cookie authentication. The app already supports PostgreSQL using SQLAlchemy and psycopg.

For a live organization handling real student data, choose institution-approved hosting and an always-on paid compute/database plan with backups and an appropriate region. No hosting provider or application can be honestly promised “100% secure.” The code includes concrete protections; institutional deployment still needs review, operational ownership and real-model validation.

| Option | Fit for this application | Free-tier limitation |
|---|---|---|
| Render + Neon | Recommended demonstration architecture: one app origin and a persistent PostgreSQL database | Render free services sleep after 15 idle minutes, have limited resources, and lose local files on restart. Neon has storage and compute quotas. |
| Vercel | Good frontend hosting; splitting this Python application would add API proxying and deployment work | Vercel Hobby is for personal, non-commercial use. It is not the default plan for an organization's production system. |
| Local laptop | Ready now, with no cloud account or hosting bill | Available only while this laptop and the server are running. |

Sources: [Render free service limits](https://render.com/docs/free), [Neon free-plan guidance](https://neon.com/blog/how-to-make-the-most-of-neons-free-plan), [Vercel Hobby terms](https://vercel.com/docs/plans/hobby).

Do not use local SQLite on a free Render service: its filesystem is ephemeral. Render's own free PostgreSQL database expires after 30 days, so it is unsuitable as permanent storage for this application. Neon is a separate managed PostgreSQL option; verify its current quotas and backup options before use. A free plan should not be treated as an operational guarantee.

## Prepared Render deployment

`render.yaml` describes a Docker-based service. It deliberately requires explicit secrets and a non-demo model before production startup.

1. Put this project in an **organization-controlled private repository**. Keep `.env`, database files, student CSVs, and generated credentials out of Git.
2. Create the database in an approved region. Get its TLS connection string. For SQLAlchemy, use `postgresql+psycopg://...?...sslmode=require` (preserve the provider's other connection parameters and use `&` when appending parameters).
3. Create a trusted model using the training CLI with real observed outcomes. For diskless hosting, follow `deployment-assets/README.md`. The model is ignored by Git by default; use an institution-approved private artifact/build mechanism, or deliberately include only that trusted model in a private deployment repository. Never commit the training data or database.
4. Create a Render Blueprint from the private repository. Set `DATABASE_URL`, `ADMIN_EMAIL`, a unique `ADMIN_PASSWORD` (12+ characters), and `ALLOWED_ORIGINS` to the exact HTTPS origin (no trailing slash).
5. Keep `APP_ENV=production`, `DEMO_MODE=false`, and `COOKIE_SECURE=true` for real-data use. Add the real model before deploying. The app will refuse a synthetic model.
6. Test login, administration, student isolation, imports, and restore procedures on the deployed origin before admitting real users.

For a synthetic-only public demo, explicitly use `APP_ENV=demo`, `DEMO_MODE=true`, `COOKIE_SECURE=true`, a separate demo database and your demo HTTPS origin. Demo accounts are publicly documented and must never be used with confidential records. Free runtime capacity for the selected model must be measured; train offline, and upgrade if resource limits are exceeded.

No cloud resources have been created, no provider accounts have been connected, and no student data has been published by this build.

## Implemented controls

- Separate professor and student authentication realms. Enrollment/password login for students; no public registration endpoint.
- Administrator-only account issuance, credential reset and suspension. Generated passwords use a cryptographically secure source, are shown once, stored only as salted hashes, and require change on first sign-in. Suspending/resetting access revokes sessions.
- Student records are scoped by the authenticated account's database link, never by a student ID supplied in a request. Students cannot call professor, import, export, model, support-edit or administrator APIs.
- Student-facing support plans are explicitly shared by staff. Private faculty notes are excluded from the student API. Student pages do not expose risk labels or faculty-only predictions.
- PBKDF2-HMAC-SHA256 password hashing; random session tokens stored as hashes; HttpOnly/SameSite cookies; Secure cookies and HSTS in production; server-side session expiry and revocation.
- CSRF tokens and exact origin allowlisting for browser mutations. Rate limiting for sign-in attempts, plus recommended shared throttling at the hosting edge for scale.
- Request size enforcement for normal and streamed bodies, file size/row/column/expanded-workbook limits, validation, one-transaction imports, SQLAlchemy parameterized queries, and escaped text rendering.
- Mapping only recognized academic target fields. Extra spreadsheet columns are ignored after mapping. Raw mapping-stage input is scoped to the uploader, expires after an hour, and is deleted on successful mapping; expired abandoned inputs are purged on subsequent uploads.
- Content security policy, clickjacking protection, no-sniff headers, private API responses marked `no-store`, and audit events for account, login, import and support changes.
- `.env`, databases, generated artifacts, production data and dependency directories excluded from source control. Static hosting exposes only the built frontend, not backend files or configuration.

## What “protect the code” means

Frontend JavaScript, HTML and CSS are downloaded by browsers and cannot be made secret. Authorization is enforced on the server, not by hiding buttons or obscuring frontend code. Database passwords, real administrator credentials and private model artifacts must remain on the server or in provider secret storage. No secret should be placed in `VITE_*` variables because those are exposed to the browser.

This is a tested application foundation, not an independent penetration-test certification. Multi-campus tenancy, department-scoped faculty access, MFA/SSO, advanced distributed rate limiting and organization-specific retention jobs remain production considerations. The current faculty workspace deliberately permits authorized professors to see the whole campus cohort.
