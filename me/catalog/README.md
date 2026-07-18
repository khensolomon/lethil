# catalog/

`apps.json` is the single source of truth for "which apps to install."
It's read by two independent consumers:

- **`iso/`** — loads it from the local checkout at build time
  (`iso/core/catalog.py`), to expand `builder.<section>.app_ids` in a
  preset YAML into literal cloud-init packages/snaps/late-commands/prompts.
- **`dev/ubuntu_desktop.py`** — fetches it over HTTPS at runtime (default:
  `DEFAULTS['catalog_url']`, overridable with `--catalog <path-or-url>`),
  using the same trust-on-first-use SHA-256 pinning as `--tasks`. This
  keeps the script single-file and curl-pipeable — no new dependency.

To add a new app: add one entry to `apps.json`, then reference its id
from whichever preset(s) (`iso/presets/*.yaml` → `builder.*.app_ids`)
and/or task manifest (`dev/ubuntu_desktop.py` → `TASK_MANIFEST`) need it.
Nothing else changes.

## Entry shape

```json
"app-id": {
  "name": "Display Name",
  "prompt": "Install Thing?",
  "default": true,
  "packages": ["pkg-name"],

  "iso": { "...": "overrides/additions for the ISO builder" },
  "dev":  { "...": "overrides/additions for the dev script" }
}
```

Top-level `name`/`prompt`/`default`/`packages` are shared defaults. The
`iso`/`dev` blocks override them for that consumer and hold
context-specific fields:

- `iso.ubuntu` / `iso.debian` — distro-specific `packages`/`snaps`/
  `late-commands` (same shape `iso/core/prompts.py` already expects).
- `dev.type` — the `dev/ubuntu_desktop.py` task type (`apt_packages`,
  `apt_stack`, `docker_ce`, `git_extension`, ...), plus that type's
  fields (`groups`, `repo`, `note`, ...).

A plain apt package with no divergent behavior (e.g. `curl`) needs only
`{"packages": ["curl"]}` — no `iso`/`dev` blocks required, since both
consumers fall back to the top-level fields.

## What's deliberately *not* in the catalog

Only installable apps live here. Preset-only system configuration —
identity, storage layout, locale, driver/codec prompts, the GNOME dock
override, autostart wiring — stays in `iso/presets/*.yaml` and
`dev/ubuntu_desktop.py`'s `STATIC_TASKS` respectively. It was never
duplicated between the two consumers, so migrating it here would add
indirection without removing any real maintenance burden.

## A note on `docker`

`docker` is a deliberate example of a catalog entry whose `iso` and
`dev` blocks install genuinely different things: the ISO installs a
lightweight snap/distro package at image-build time, while the dev
script sets up the full upstream Docker CE repository on a live
system. The catalog doesn't force these to match — it only removes
duplication where the install is actually the same thing.
