# Miku Plush Drop — Hatsune Miku plushie dropping game

**Live demo:** <https://aryanxsethi.github.io/Miku-Plush-Drop/>

A free fan-made **Vocaloid / Hatsune Miku** browser game: click anywhere to
drop a random **Hatsune Miku plush**. Each plushy falls with
2D [Matter.js](https://brm.io/matter-js/) physics and a pseudo-3D tumbling
animation, settles into a pile, and is recorded in your collection. Plushies
range over 100+ base designs plus a hidden **secret** set, each with its own
weighting, glow, and sound.

---

## Getting started

The site **must be served over HTTP** (browser localStorage, ES modules, and
image/audio loading work best over a local server). The project folder is
`MikuPlushDrop/` and it can live **on any drive** (`C:`, `D:`, `E:`, ...) at any
path — every file reference inside the project is relative, so nothing needs
to change when you move it.

From the project root:

```bash
cd /d D:\MikuPlushDrop          # any drive works: C:, D:, E:, ...
python -m http.server 8000
```

Then open <http://localhost:8000>.

> Opening `index.html` directly via `file://` is not supported: the app runs
> as ES modules, and browsers block module imports from `file://` (CORS). If
> you double-click the file you'll see a banner explaining how to start the
> server instead of the game.

### Directory layout

```
MikuPlushDrop/              # any drive, any path
├─ index.html               # page shell: canvas, HUD, collection modal
├─ style.css                # theme + UI (Miku teal/pink, collection grid, toasts)
├─ js/                      # app logic as ES modules
│  ├─ main.js               # entry point: event wiring + boot sequence
│  ├─ config.js             # all constants & tuning (rarities, weights, pity)
│  ├─ state.js              # shared runtime state, DOM refs, Matter engine
│  ├─ storage.js            # localStorage read/write + key normalization
│  ├─ assets.js             # image/audio loading + fallback plushies
│  ├─ rarity.js             # rarity assignment, weighted picks, pity logic
│  ├─ audio.js              # WebAudio synth bank + playSound
│  ├─ ui.js                 # toasts, collection stats/grid, panel control
│  ├─ view.js               # rendering: halos, tumbling draw, baking
│  ├─ world.js              # resize/bounds, DPR tuning, spawn, trim
│  └─ game.js               # physics step, frame loop, collision impulses
├─ images/                  # plush PNGs (plush_1.png … plush_100.png) + secret eva PNGs
└─ assets/sound/            # optional audio: drop/pop/plush/miku/sound/boing/boom.*
```

### Asset conventions

- **Plushies**: drop `plush_<n>.png` (or `plush<n>.png`) into `images/`.
  `loadPlushImages()` scans `plush_1 … plush_110` across `images/` and
  `assets/plush/`. Anything that loads is added to the pool.
- **Secrets**: the six `eva*.png` images are loaded as stealth plushies
  (see [Secret rarity](#secret-rarity)).
- **Sound**: `assets/sound/drop|pop|plush|miku|sound|boing.{mp3,wav,ogg,m4a}`
  are used for normal drops; `assets/sound/boom.*` plays for secret drops.
  If no audio files exist, the built-in WebAudio synth bank is used.

---

## How it works

### Drop flow

1. The user clicks anywhere on the body.
2. `shouldDropSecret()` decides whether this drop is a secret (see below).
3. Otherwise `pickPlush()` picks a plushy via weighted random selection.
4. A Matter body drops in with an upward/angular velocity, tumbling to the
   floor and into the pile.
5. On land — `trim()` — the pile is capped at `MAX_PLUSH` (150) bodies.
6. The drop is recorded in `collection[key]` and persisted to localStorage.

### Rarity system

Each plushy gets a rarity: `common → uncommon → rare → epic → legendary → secret`.

Tier **weights** (drop odds):

| Tier | Weight | Label |
|------|--------|-------|
| common    | 40 | Common |
| uncommon  | 25 | Uncommon |
| rare      | 18 | Rare |
| epic      | 10 | Epic |
| legendary |  5 | Legendary |
| secret    |  0*| Secret |

\*Secret is *not* drawn from the weighted pool — it uses its own 1/1000 roll.

Plush specific `RARITY_OVERRIDES` force a specific rarity (e.g.
`plush_17 → legendary`). Otherwise rarities are assigned to keep every tier
present (proportional fill in `assignRarities()`), and persisted so tiers
stay stable across reloads.

### Secret rarity

- **Chance**: 1/1000 per drop (`SECRET_CHANCE`).
- **Pity**: if 1000 dry drops pass (`SECRET_PITY`), the next drop is a
  guaranteed secret.
- **Pick**: prefers an un-collected secret; otherwise uniform among the 6.
- **Hidden**: secrets do not appear in the collection grid or the progress
  bar until first collected.
- **Look & feel**: rainbow glow (animated hue), "Secret!" toast, boom sound.

### Pity for normal plushies

`PITY_DROPS` (50) — after 50 drops without a brand-new plushy, the weighted
pool is narrowed to only un-collected plushies **unless the whole base
collection is already complete**.

---

## Collections

- Progress shows `<collected>/<total>` plus a progress bar.
- The grid is 5 columns, lazily rebuilt when the panel opens.
- Collected tiles show the plushy image + duplicate count; uncollected show a
  grey `?` tile; secrets are hidden entirely until found.
- `Reset collection` wipes the persisted collection (in-memory + localStorage).

**Keys used in localStorage:**

| Key | Purpose |
|-----|---------|
| `miku-plush-collection` | `{ plush_key: count }` per collected plushy |
| `miku-plush-rarity`     | `{ plush_key: rarity }` per assigned tier |

> Too many saves? The collection is only flattened to localStorage via a
> debounced 500 ms timer (`scheduleCollectionSave()`), flushing on
> `beforeunload`. In-memory mutations are instant.

---

## Performance

- **Pile cap**: physics world never exceeds `MAX_PLUSH` bodies.
- **Pair-table guard**: Matter.js 0.19 keeps sleeping collision pairs forever,
  even after bodies are removed, so `engine.pairs.list` grows without bound
  across many drops. `step()` periodically clears the pair table when the pair
  count exceeds `MAX_PLUSH × 5`, keeping cost bounded. (Also cleared after
  "Clear pile".)
- **Idle heuristics**: once every plushy is asleep, the render loop stops
  stepping (`idle` flag + `physicsDirty`), until a drop/collision/resize.
- **DPR auto-tune**: resolution lowers if frames get slow, and recovers when
  there's headroom.
- **Baked sprites**: sleeping plushies are pre-rendered to an offscreen canvas
  (`bakeVisual`) so they cost a single `drawImage` per frame.

---

## Adding your own plushies

1. Drop a `plush_N.png` into `images/`.
2. (Optional) bump `MAX_PLUSH` / rarity weights in `js/config.js`.
3. (Optional) give it a special rarity in `RARITY_OVERRIDES` or a weight in
   `PLUSH_WEIGHTS`.
4. Reload. It appears in the pool, weighted by its rarity tier × plush weight.

---

## Customisation quick-reference (`js/config.js`)

| Constant | Default | Meaning |
|----------|--------:|---------|
| `PITY_DROPS` | 50 | drops until a guaranteed new plush |
| `SECRET_CHANCE` | 1/1000 | per-drop secret probability |
| `SECRET_PITY` | 1000 | dry drops until a guaranteed secret |
| `MAX_PLUSH` | 150 | max concurrent plushies |
| `RARITY_TIERS.*.weight` | 40/25/18/10/5 | drop weight per tier |
| `RARITY_OVERRIDES` | — | force rarity by plush key |
| `PLUSH_WEIGHTS` | — | per-plush extra weight multiplier |
| `DPR_LEVELS` | [1.25, 1.5, 2] | available resolutions |

---

## Credits & disclaimer

All plush images are property of their respective creators. This is a
fan-made demo built for learning and fun — it is not affiliated with or
endorsed by the original rights holders.

> The website shows this notice once, on the first boot only; it is
> remembered in localStorage (`miku-plush-credit-seen`) so it doesn't appear
> on subsequent visits.
