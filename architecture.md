# System Architecture for Personal Tracker Migration

This document outlines the full-stack system architecture, technology stack, folder structure, and critical operational workflows for migrating the Personal Task Board from a client-side HTML file to a **Next.js Full-Stack App**.

---

## 1. System Architecture Overview

The system transitions from a single-user static file utilizing local browser storage to a server-rendered, database-backed web application. 

```
                                  ┌──────────────────────────┐
                                  │      Client Browser      │
                                  └────────────┬─────────────┘
                                               │
                                  HTTPS (HTML, CSS, JSON)
                                               │
                                  ┌────────────▼─────────────┐
                                  │ Next.js App Router       │
                                  │ (Vercel or Node Server)  │
                                  └────────────┬─────────────┘
                                               │
                                        Prisma ORM Queries
                                               │
                                  ┌────────────▼─────────────┐
                                  │    SQLite / Postgres     │
                                  │         Database         │
                                  └──────────────────────────┘
```

* **Frontend**: Next.js App Router (React), utilizing Vanilla CSS Modules to preserve and modularize the existing premium UI and animations, ensuring zero bloated utility CSS.
* **Backend**: Next.js Server Actions and Route Handlers acting as a secure API layer.
* **Database Layer**: Prisma ORM, providing type-safety and seamless switching between SQLite (local development/self-hosting) and PostgreSQL (production deployment on Neon/Supabase).
* **State Management**: React Context / Zustand for managing UI states (such as active brand, collapsing menus) coupled with React Server Actions for instant database mutations.

---

## 2. Directory Structure

Here is the proposed modular folder layout for the Next.js project. It strictly follows standard App Router conventions while separating backend business logic from user interface presentation.

```text
personal-tracker/
├── prisma/
│   ├── schema.prisma         # Database schema definition
│   └── seed.ts               # Database seeder (seeds initial brands & tasks)
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Base HTML skeleton, metadata, Inter font loading
│   │   ├── page.tsx          # Main dashboard container (Server Component)
│   │   ├── globals.css       # Core design system tokens (colors, HSL variables)
│   │   └── api/              # API endpoints (e.g., reports download, backups)
│   │       └── report/
│   │           └── route.ts  # Generates and downloads tracker markdown/text reports
│   ├── components/           # Reusable, modular UI components
│   │   ├── brand-bar.tsx     # Categories / Brand workspaces switcher
│   │   ├── daily-focus.tsx   # Hero card (daily focus title & daily intentions note)
│   │   ├── history-panel.tsx # Collapsible daily record logs and restoring
│   │   ├── notepad.tsx       # Contenteditable tabs for rich-text notes
│   │   ├── progress-bar.tsx  # Dynamic progress tracking card
│   │   ├── stats-grid.tsx    # Statistical dashboard counters
│   │   ├── task-item.tsx     # Individual task (supports subtasks and notes)
│   │   └── task-list.tsx     # Task layout section (Daily / Weekly / One-off)
│   ├── lib/                  # Helper utilities and shared libraries
│   │   ├── db.ts             # Prisma client singleton instance
│   │   ├── utils.ts          # Core utility functions (formatting, date logic)
│   │   └── actions/          # Next.js Server Actions (mutations)
│   │       ├── brands.ts     # Brand CRUD
│   │       ├── focus.ts      # Heading & Daily Note CRUD
│   │       ├── notepad.ts    # Notepad tabs save, delete, and restore
│   │       └── tasks.ts      # Task & Subtask checking, drag-and-drop reorders
│   └── types/                # TypeScript type definitions
│       └── index.ts
├── .env                      # Connection strings and local variables
├── package.json
└── tsconfig.json
```

---

## 3. Preserving Design Aesthetics

The existing CSS in `index.html` is exceptionally rich, utilizing a modern, premium dark-compatible theme with smooth borders, subtle gradients, and glassmorphism. We will preserve this inside Next.js using **CSS Modules**:

1. **Global Styles (`src/app/globals.css`)**:
   We will port the custom `:root` CSS variables (e.g. `--accent`, `--surface`, `--sh`, `--green-s`) directly to the global stylesheet. This maintains CSS custom properties throughout the entire application.
2. **Harmonious Palettes & Typography**:
   - The typography will leverage `next/font/google` to import **Inter** or **Outfit** dynamically for zero layout shift (CLS).
   - Glassmorphic panels (`.panel`, `.notepad-panel`) will retain their subtle borders (`1px solid var(--border)`) and drop-shadow definitions (`var(--sh)`).
3. **Animations & Hover Micro-interactions**:
   - Transition timings (`transition: all .15s ease`) for task checkboxes (`.chk:hover`), tab changes (`.np-tab`), and sidebar forms will be fully retained using native CSS transitions.

---

## 4. Key Engineering Workflows

### A. The "New Day Check" and Seeding Transaction
In a client-side environment, checking if a new day has arrived happens when the page loads in the browser. In our Next.js architecture, this is done on the server when fetching the dashboard page for a specific date:

1. The client loads `https://tracker.com/dashboard?date=2026-05-29`.
2. The Server Component queries the database for this date.
3. If no **DailyFocus** or tasks exist for this brand/date:
   - A single database transaction is initiated:
     - Create a new **DailyFocus** card for today (`"Daily Focus"`).
     - Fetch active `RecurringTaskTemplate` records for this brand.
     - Map and insert active daily templates as new `Task` rows for the current date.
     - Check the day of the week (e.g., `"Fri"`) and fetch weekly templates matching this day, seeding them as active tasks.
     - Archive previous day's Notepad tabs (`isArchived: true`, `archiveDate: previousDate`) and spin up a fresh, blank tab titled `"Today's Notes"`.
4. Server returns the seeded data to the client, guaranteeing data is initialized consistently without needing separate backend cron jobs.

### B. High-Performance Drag-and-Drop
The static HTML relies on lightweight, standard native HTML5 Drag and Drop events (`dragstart`, `dragover`, `dragend`). We can port this exact vanilla logic to React for zero bundle overhead:
1. Define custom `onDragStart`, `onDragOver`, and `onDrop` events on `<TaskItem />` components.
2. The frontend holds a local state representing the array of tasks.
3. On drag drop, immediately update the state locally (**optimistic UI update**) to render the new list ordering instantaneously.
4. Fire a background Server Action `updateTaskOrder(orderedIds: string[])` to update the `orderIndex` columns in the database concurrently:
   ```typescript
   // src/lib/actions/tasks.ts
   export async function updateTaskOrder(orderedIds: string[]) {
     const updates = orderedIds.map((id, index) => 
       prisma.task.update({
         where: { id },
         data: { orderIndex: index }
       })
     );
     await prisma.$transaction(updates);
   }
   ```

### C. Rich-Text Quick Notes Sync
The notepad uses a `contenteditable` container with rich formatting options (bold, text-color, highlight, quote blocks).
* **Storage format**: Rich content will be sent as standard **HTML strings** (or Markdown) to the backend database's `content` text column.
* **Saving performance**: To avoid lagging the user during active typing, the Notepad component implements a simple debounced autosave:
  1. Trigger local `onInput` event inside the editor.
  2. Maintain a `useRef` timer.
  3. Every 1.5 seconds after the user stops typing, trigger a background Server Action to sync the draft note with the database.
  4. Display an "Auto-saving..." and "Saved" status indicator dynamically in the Notepad footer.

### D. Offline-Ready / Local-First Option (Zustand + Sync)
For advanced self-hosting setups, the application can run in a **local-first** state:
- All writes are saved to an in-memory Zustand store and mirrored to indexedDB on the client.
- A service worker syncs mutations back to the Next.js database API when online, giving the app desktop-class speed and offline resiliency.

---

## 5. Hosting & Deployment Scenarios

This architecture is optimized for two major deployment pathways:

### Option A: Cloud Deployment (Zero Maintenance)
* **Frontend/Server**: **Vercel** or **Netlify** (Serverless hosting).
* **Database**: **Neon** or **Supabase** (Serverless PostgreSQL).
* **Auth**: **Auth.js** (NextAuth) using GitHub/Google OAuth providers.
* **Cost**: 100% free tier eligible.

### Option B: Self-Hosted (Privacy & Local-Control)
* **Deployment**: Single container via **Docker** on a private NAS, Raspberry Pi, Fly.io, or Railway.
* **Database**: **SQLite** stored inside a persistent Docker volume.
* **Auth**: Simple environment-variable credentials (e.g. `BASIC_AUTH_USER` & `BASIC_AUTH_PASSWORD`) using Next.js Edge Middleware for lightweight security.
* **Backup**: Easy automation—since SQLite is a single file, backup involves simply copying the `.db` file daily to a secure backup directory.
