---
title: "Lai Siangtho — e-book & presentation suite"
description: "A desktop e-book reader and study app with a native presenter mode for projecting scripture to a second screen."
category: "Todo"
status: "planned"
nav_order: 1
tags: [electron, desktop, scripture, presenter]
---

## 1. Project Profile & Identity
A premium, highly customizable desktop **e-book reader and study application** that merges data-heavy research tools with an ultra-responsive, beautiful reading interface. It features a native **Presenter Mode** capable of instantly broadcasting beautifully stylized, distraction-free layouts to secondary screens like TVs or projectors.

---

## 2. Core Feature Matrix

### A. Main Interface (The Admin/Reader Window)
* **The "Beautiful Frame":** A sleek, frameless UI utilizing native OS transparency (such as macOS vibrancy or Windows Acrylic/Mica effects) with an integrated, drag-friendly custom title bar.
* **Parallel Reading Engine:** A responsive multi-column or split-pane layout allowing users to read core text side-by-side with translations, cross-references, or commentaries.
* **Advanced Research Tools:** 
  * Lightning-fast global text searching across an entire library.
  * Persistent bookmarking, annotations, and multi-colored highlights.
  * Granular layout customizations (font scaling, column-snapping, line spacing, and dark/sepia reading themes).

### B. The Projector Module (The Presenter Feature)
* **Dual-Screen Automation:** Automatic hardware detection of external monitors, TVs, or projectors to instantly map pixel boundaries and coordinate regions.
* **Zero-Latency Broadcasting:** Powered by Electron’s fast Inter-Process Communication (IPC) to synchronize the admin view and the public display at 60+ FPS locally without network lag.
* **Targeted Content Isolation:** A borderless, fullscreen projection window that renders only the focused book content or selected text frames—completely hiding the presenter’s mouse cursor, sidebars, search menus, and private notes.

---

## 3. Technical Architecture Stack

| Layer | Recommended Technology | Purpose |
| :--- | :--- | :--- |
| **App Framework** | **Electron (v43+)** | Manages hardware window bounds, OS native APIs, multi-process architecture, and the dual-screen presentation logic. |
| **Frontend UI** | **React / Vue + Tailwind CSS** | Powers the highly responsive parallel grids, layout engines, and cross-screen typography scaling. |
| **Storage & Search** | **SQLite / Better-SQLite3** | Local database engine to index e-book libraries for rapid search querying and storage of user configurations. |
| **Parsing Engine** | **Epub.js / Custom PDF Streamers** | Handles heavy text document rendering, chapter parsing, and layout pagination. |

---

## 4. Development Workflow Options (Projection Strategy)

Depending on the core product goals, the projection rendering engine will follow one of two strategies:

### Option A: Clean Data Rendering (Data-Driven Sync)
* **How it works:** The Admin window sends text IDs, styles, and page tokens across IPC. The Projector window reads this raw data and renders its own highly optimized, oversized typography layout.
* **Best for:** Flawless text crispness at 4K projector resolutions, dynamic text resizing for large audiences, and absolute separation of UI clutter from presentation content.

### Option B: Crop & Mirror Engine (Visual-Driven Sync)
* **How it works:** The active reading panel is drawn or encapsulated into an HTML capture boundary. This visual region is mirrored as a live frame or canvas stream directly onto the secondary display.
* **Best for:** Showing exact structural layouts, custom graphics, map elements, or complex page layouts exactly as they appear to the presenter in real-time.
