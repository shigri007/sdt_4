# SteriTrack

A local, role-based kit reprocessing and traceability application built with React, TypeScript, Express and SQLite. It connects kit receiving, cleaning, inspection, packing, batch processing, independent quality review, requests, dispatch, receipt, quarantine and reporting in one interface.

## Vercel deployment and database connectivity

Vercel serves the React frontend, but this project also needs its Express API and a **persistent SQLite volume**. Uploading only the Vite build makes the sign-in page appear while `/api/auth/login` has no database-backed handler. Vercel Functions have temporary filesystem storage, so do not put `steritrack.sqlite` inside a function or commit it to the frontend repository.

The included `vercel.json` sends browser `/api/*` calls to one Vercel gateway function. The gateway requires `BACKEND_URL` and forwards them to a separate HTTPS backend. The browser continues using same-origin cookies and CSRF tokens.

One practical setup uses a Docker service with a persistent volume, such as Railway:

1. Deploy the **`steritrack-app` folder** as a Railway service. Its root `Dockerfile` builds the frontend and starts Express. Attach a persistent volume at **`/app/data`**; the SQLite file is `/app/data/steritrack.sqlite`. Give the service a public HTTPS domain. The Docker entrypoint fixes the volume ownership before running as the non-root `node` user. Set `TRUST_PROXY=1` if your host terminates HTTPS at a proxy.
2. Before the backend's **first** start, optionally set `INITIAL_PASSWORD` as a private service variable to choose the `admin` password. Otherwise the backend logs a unique random password for each seeded account once. Save those credentials from the backend's deployment log. Changing `INITIAL_PASSWORD` after the database exists does not reset passwords; use `npm run reset-admin` against that database if needed.
3. In Vercel, set the project root to **`steritrack-app`**, Framework Preset to **Vite**, build command to `npm run build`, and output directory to `dist`. Add an environment variable **`BACKEND_URL=https://your-backend-domain`** with no `/api` suffix. Redeploy after setting it. Keep the backend and Vercel projects on their own HTTPS domains; the gateway handles the browser-facing same-origin API path.
4. Open **`https://your-vercel-domain/api/health`**. It must return JSON with `status: "ok"` and `database: "ready (local SQLite)"`. A 503 mentioning `BACKEND_URL` means the gateway is deployed but not configured; a 502 means the backend cannot be reached; HTML or a 404 means the gateway/rewrite is missing from the deployed project. Then sign in using the credentials from the backend log.

The Vercel gateway does not make SQLite durable by itself. Keep the volume attached across deployments and back up the database. A new empty volume creates a new starter database and therefore new account passwords. Do not upload a live SQLite file while Express is writing to it.

## Run locally

Requires **Node.js 24** and npm. In this folder:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. The username is **`admin`**. There is **no fixed password in the ZIP**: on the first run, the terminal prints a separate randomly generated password for each included account. Save it securely; it is shown once. Set `INITIAL_PASSWORD` in a private `.env` before the first run if you need a predetermined admin password; other accounts always receive unique random passwords. The database is created at `.data/steritrack.sqlite` and retains changes after restart. `.data` and `.env` are excluded from Git and the submission archive.

If you lost the first-run password, **stop the server**, run `npm run reset-admin` in the same project folder, save the newly printed password, then start the server again. The command resets only the `admin` account and revokes its existing sessions. It must be run against the same `.data/steritrack.sqlite` file; set `DATABASE_PATH` if you configured a different location.

Other included accounts exercise the workflow: `lin_xia` and `liu_yang` (department staff), `chen_wei` and `li_ming` (operators), `zhang_lei` and `wang_fang` (quality coordinators). After signing in as `admin`, open **Admin Panel → Create account** to add a staff member. **Admin Panel → Staff accounts** lists accounts and allows activation or deactivation. There is no public signup. Change initial passwords from the account menu after first use. Existing databases created with a shared seeded hash automatically rotate affected accounts to distinct passwords on next start and print the new credentials once; their old sessions are revoked.

Role boundaries are enforced by the server as well as the menu: administrators manage accounts, audit, and reports; department staff request, receive, and return kits for their own department; operators run decontamination and sterilization; quality coordinators register kits, review batches, authorize reprocessing, and dispatch. Administrators cannot perform operator or quality decisions. Sign out before switching accounts; each account has its own password.

Optional configuration is documented in `.env.example`. To run the built app, use `npm run build` followed by `NODE_ENV=production npm start` (set environment variables using your shell syntax). The Docker setup is local-only: set `INITIAL_PASSWORD` privately, then run `docker compose up --build`; the named volume retains the SQLite file.

## Main workflow

1. Department staff create a request for a kit type and quantity.
2. Operators receive, clean, inspect and pack a kit, then place it in a batch and record observed processing indicators.
3. A different quality coordinator records biological, chemical and packaging evidence to approve or reject the completed batch. Rejected kits enter quarantine. Failed attempts remain visible in kit history.
4. A coordinator dispatches the exact number of eligible kits requested. Department staff in the receiving department confirm delivery and later return used kits.

New kits begin in **RETURNED** state and must complete the workflow before they can be dispatched. A priority change records its justification; priority never bypasses quality review. Kit history and audit events are searchable, and reports can be exported.

## Engineering and verification

Domain operations live in service classes under `server/src/services`; the Express routes validate access and map HTTP requests to those services. The frontend uses typed React components, context for session and notifications, and a single API client. SQLite persists domain records and hashed server-side sessions. Passwords are bcrypt hashes; authentication uses an HttpOnly SameSite cookie plus a CSRF token. API role checks and state transitions are enforced server-side.

```bash
npm run lint
npm test
npm run build
```

The tests cover access control, session handling, persistence, state transitions, QC separation, quarantine, dispatch eligibility and trace history. GitHub Actions runs the same checks on Node 24.

## Scope and limits

This is a **single-instance educational application with synthetic records**. Processing evidence is entered by people; it is not read from sterilizer hardware. The SQLite design is intended for local evaluation, not multiple server instances. Audit records are application-maintained and are **not tamper-proof or cryptographically signed**. The software has not undergone clinical validation, security certification, hospital integration or medical-device approval. Do not use it to make real patient-care or sterile-release decisions.

For coursework review, use the provided records such as `KIT-0012` to inspect two processing attempts, then use separate operator, coordinator and department accounts to walk through a fresh kit. The functional and nonfunctional claims above are intentionally limited to what the implementation and tests establish.
