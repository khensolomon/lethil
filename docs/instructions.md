# lethil — Project Instructions

These instructions tailor responses for work on the `lethil` infrastructure monorepo.

## Voice and writing style

- **No personal pronouns** in code comments, documentation, or written deliverables. Use impersonal phrasing: "the project" not "your project", "the working directory" not "your directory", "the Cloudflare account ID" not "your Cloudflare account ID".
- **No hype register.** Avoid "must", "absolutely", "100%", "guarantee", "simply", "just", and tutorial-voice filler ("Okay, so now we're going to..."). State things plainly.
- Comments explain *why*, not *what*. Assume a competent reader.
- Documentation favours prose and compact tables over long bullet lists. Minimal formatting.

## Working principles (how this project is built)

- **Workflows are thin dispatchers.** A GitHub Actions workflow ships a script and parameters to a target and reports done/error/why. It does not contain core logic, does not parse script output for state, does not branch on what the script "did". The one exception: deploying static apps is a generic build→rsync operation the workflow may do directly.
- **Every script is independently runnable by hand.** The same command, the same flags, the same result, whether typed at a terminal or invoked by a workflow. If a workflow can do something the operator cannot reproduce by hand, the design is wrong.
- **Additive design.** Prefer changes that let new things be added by editing one place (a dict entry, a config line, a new directory) over changes that require rewriting working code. A simpler-but-not-extensible solution is worse than a slightly larger extensible one. When in doubt, ask before collapsing flexibility.
- **Single source of truth.** Configuration that drives multiple outputs (DNS, ingress, Access apps, summaries) lives in one structure that everything else derives from. Renaming a key should ripple automatically.
- **Idempotent where possible.** Re-running a script or workflow should be safe.
- **Loud failure over silent drift.** Typos and misconfigurations should abort with a clear message, not silently do the wrong thing.

## Architectural facts to respect

- NPM is gone. The reverse-proxy/landing layer is vanilla `nginx:alpine` at `/opt/landing/`; the Cloudflare Tunnel is a separate stack at `/opt/cloudflare-tunnel/`. Do not reintroduce NPM.
- `setup.py` is the server bootstrap core. The `admin_subdomains` dict in `main()` drives DNS + ingress + Access app + summary; respect that pattern when adding subdomains.
- `secrets.py` is one generalized script for all repos. The `.env` zone model is: bundle (before first marker) → `ENV_BASE`; `#@ individual` → per-key secrets (whatever is present, no allowlist); `#@ local` → never pushed. `SSH_PRIVATE_KEY_PATH` pushes file contents as `SSH_PRIVATE_KEY`. The name `ENV_BASE` is load-bearing in the app repos — never rename it.
- `SSH_PRIVATE_KEY_PATH` (reference a key file by path) is the preferred SSH method, not storing a raw key in `.env`.
- Workflow display names use the `Noun · Verb` form (`Server · Provision`, `App · Deploy`).
- No duplicate variables with the same meaning. One canonical name per credential (`R2_ACCESS_KEY_ID`, never also `R2_ACCESS_ID`), used identically in `.env`, `setup.py` flags, and workflows.

## Scope boundaries

- **In scope for lethil:** server bootstrap, landing/static-app deploy, the dispatch workflows, `secrets.py`, operator helper scripts (`script/`, future VM/ISO tooling).
- **Out of scope (lives in app repos):** container-cleanup workflows, `DELETE_PACKAGES_TOKEN`, the Django apps themselves.
- **Deferred (separate session):** rethinking the `ENV_BASE` / `VAR_BASE` / `ENV_OVERRIDES` three-layer config-merge naming. This touches live app-repo deploys (`action.yml`, `deploy.yml`) and must not be bolted onto unrelated work.

## Collaboration preferences

- For large or destructive changes, talk through the design and surface trade-offs *before* writing code. The owner values reasoning and honest pushback over fast output.
- Flag fragility, chicken-and-egg ordering, and migration costs explicitly.
- When a decision has more than one reasonable answer, present the options with a recommendation and the reasoning, then let the owner choose.
- Do not over-engineer toward a config-management system (Ansible/Terraform territory). Keep helper scripts small and deletable.
- Verify changes (compile, dry-run, parse-test) before declaring them done.
