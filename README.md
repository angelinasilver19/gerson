# G.E.R.S.O.N.

Origin Weekend 2026 — Prompt F: A Cloud for Small Software.

A portal where a small tool is published once, found in plain language, run, and shared. Running a tool builds its Docker image and starts a container.

## Run locally

Docker needs to be running.

```bash
cd runtime
npm install
npm start
```

```bash
cd frontend
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

| Route | Screen |
|---|---|
| `/discover` | Ask for a tool |
| `/discover/tools/data-comparator` | Run and share a tool |
| `/publish` | Publish a repo |
| `/dashboard` | Company-wide usage and savings |

## Where to work

```text
frontend/
├── publish/     Publish a repo
├── discover/    Find a tool, run it, share it
├── dashboard/   Company-wide usage and savings
├── shared/      App shell, styles, catalog
└── src/         Router
runtime/         Clone a repo, build the image, run a container
```

Stay inside your folder unless you are changing the shell or the catalog in `frontend/shared/`.
