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

## Team and attribution

Gerson was created as a team project for Origin Weekend 2026. The [original Devpost submission](https://devpost.com/software/gerson) lists Angelina Silvestri, Nuha Babool, Prakhar Goel, Richard Zhang, and samruddhiusc as creators.

This repository is a copy of the project for portfolio reference. Uploading the files does not imply sole authorship of the code.
