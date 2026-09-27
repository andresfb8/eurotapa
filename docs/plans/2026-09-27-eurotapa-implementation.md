# EuroTapa Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Use execution principles from `executing-plans`, `brandkit`, and `minimalist-ui` to implement this plan task-by-task.

**Goal:** Build **EuroTapa**, a real-time web application for tapas competitions among friends featuring Eurovision-style scoring, mobile voting with participant access PINs, a pre-contest animated tasting draw with WhatsApp export, live dish tasting cards, dual photo uploads with browser compression, and an animated Eurovision TV reveal with live scoreboard reordering.

**Architecture:** A Vite + React + TypeScript Single Page Application with clean modular styling complying with `minimalist-ui` standards (warm monochrome `#F7F6F3`, serif headings, hairline `#EAEAEA` borders, zero generic shadows/emojis). State management includes a unified real-time synchronization service supporting Firebase Realtime DB/Firestore as well as an instant local-first BroadcastChannel/LocalStorage live bridge for immediate zero-config testing.

**Tech Stack:** React 19 / TypeScript, Vite, CSS Modules / Design Tokens (`minimalist-ui`), Canvas-based client image compression, HTML5 Drag & Drop, Canvas-free CSS FLIP scoreboard animations.

---

### Task 1: Project Initialization & Minimalist Design System

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/styles/tokens.css`
- Create: `src/styles/main.css`
- Create: `src/types/contest.ts`

**Step 1: Scaffold Vite + React + TypeScript in `scratch/eurotapa`**
- Initialize the application using Vite with zero unnecessary dependencies.
- Verify build configuration with `npm install` and `npm run build`.

**Step 2: Define strict `minimalist-ui` tokens and base typography**
- Configure Google Fonts: `Instrument Serif` (or `Newsreader`) for editorial dish names and headlines, `Geist` / `SF Pro` for UI text, and `Geist Mono` for points and metadata.
- Configure color tokens: Canvas `#F7F6F3`, Card `#FFFFFF`, Border `#EAEAEA`, Text `#111111`, Subtext `#787774`, and semantic pastels (Pale Green `#EDF3EC`, Pale Yellow `#FBF3DB`, Pale Red `#FDEBEC`, Pale Blue `#E1F3FE`).
- Enforce strict negative constraints: No generic shadows, no emojis, no `rounded-full` cards.

**Step 3: Define TypeScript domain models in `src/types/contest.ts`**
- Models: `Participant`, `TapaDetails`, `VoteMap`, `ContestPhase`, `GalaState`, `ContestConfig`.

---

### Task 2: Real-time State Engine & Storage Adapter

**Files:**
- Create: `src/services/contestStore.ts`
- Create: `src/services/mockData.ts`
- Create: `src/utils/imageCompressor.ts`
- Create: `src/utils/scoring.ts`

**Step 1: Build client-side image compression (`imageCompressor.ts`)**
- Implement Canvas-based image resizer converting mobile camera photos to high-quality lightweight WebP (<300 KB) data URLs so images load instantly across all devices without high bandwidth.

**Step 2: Build Eurovision scoring and tie-breaking engine (`scoring.ts`)**
- Calculate cumulative points for each tapa.
- Implement strict Eurovision tie-break logic: in case of equal total points, compare count of highest points awarded (e.g. who received more 14s, then 13s, etc.).

**Step 3: Build reactive store with multi-tab / real-time synchronization (`contestStore.ts`)**
- Provide reactive subscription hook `useContest()` that broadcasts changes across mobile and TV windows via `BroadcastChannel` and `localStorage`, with Firebase configuration readiness for deployment.
- Include realistic culinary demo data in `mockData.ts` for instant preview (e.g., "Bao de Carrillera al Vino Tinto", "Croqueta Cremosa de Boletus y Trufa").

---

### Task 3: Tasting Order Draw Component (`DrawView.tsx`)

**Files:**
- Create: `src/components/draw/DrawView.tsx`
- Create: `src/components/draw/DrawView.module.css`
- Create: `src/utils/whatsappExport.ts`

**Step 1: Visual lottery animation in TV Mode**
- Interactive shuffle animation that reveals tasting turns one by one on the big screen with suspense and sound-free elegant CSS transitions.

**Step 2: Manual drag-and-drop adjustment for the Superadmin**
- Allow the admin to reorder tasting turns directly if a cook needs more prep time in the kitchen.

**Step 3: WhatsApp export utility (`whatsappExport.ts`)**
- Single-click button to copy formatted schedule for WhatsApp (participant name, dish name, turn order, and estimated time).

---

### Task 4: Tasting Presentation Mode on TV (`TastingView.tsx`)

**Files:**
- Create: `src/components/tasting/TastingView.tsx`
- Create: `src/components/tasting/TastingView.module.css`

**Step 1: Fullscreen dish spotlight card**
- Editorial layout showcasing the current active tapa: high-res photo, dish title in serif typography, author, clean ingredient tags, and description.

**Step 2: Quick turn navigation**
- Admin triggers "Siguiente tapa" to seamlessly transition between courses during the meal.

---

### Task 5: Mobile Participant Voting Interface (`VotingView.tsx`)

**Files:**
- Create: `src/components/voting/VotingView.tsx`
- Create: `src/components/voting/VotingView.module.css`
- Create: `src/components/voting/TapaEditModal.tsx`

**Step 1: Participant login & dish profile setup**
- Participant selects their name and enters their 4-digit PIN.
- Form to upload or capture the photo of their tapa, enter ingredients, and description with instant preview.

**Step 2: Eurovision point assignment list**
- Exclude the user's own tapa (clearly marked with `Tu creación - No puntuable`).
- Display remaining unassigned points in a sticky header badge.
- Interactive point selectors from $N-1$ down to 1 with validation preventing duplicates.
- Expandable accordions on each competitor card to review photo, ingredients, and notes.

**Step 3: Vote submission & lock**
- Visual confirmation modal before sealing vote. Once confirmed, shows a sleek "Voto Registrado" lock screen.

---

### Task 6: Eurovision Gala TV Scoreboard (`GalaTVView.tsx`)

**Files:**
- Create: `src/components/gala/GalaTVView.tsx`
- Create: `src/components/gala/ScoreboardBar.tsx`
- Create: `src/components/gala/PodiumView.tsx`
- Create: `src/components/gala/GalaTVView.module.css`

**Step 1: Real-time animated scoreboard with FLIP reordering**
- Left column: 15 horizontal score bars showing position, thumbnail, dish title, author, and total points.
- Smooth CSS translation transitions re-ranking bars upward or downward as points are added.

**Step 2: Live voter spotlight & point reveal mechanism**
- Right column: "Votos del Jurado: [Nombre del Votante]" with their photo and country/city badge.
- Admin triggers reveal:
  - Phase A: Fast reveal for points 1 through 10.
  - Phase B: Suspense cards for the Top 3 highest points (e.g. 12, 13, 14), flashing with subtle pastel accent.

**Step 3: Grand Podium celebration (`PodiumView.tsx`)**
- Upon completion of the final voter, transitions to a majestic 1st, 2nd, and 3rd place podium celebrating the EuroTapa champion.

---

### Task 7: Superadmin Control Dashboard (`AdminPanel.tsx`)

**Files:**
- Create: `src/components/admin/AdminPanel.tsx`
- Create: `src/components/admin/AdminPanel.module.css`

**Step 1: Event lifecycle management**
- Phase toggles: `Configuración` $\to$ `Sorteo` $\to$ `Degustación` $\to$ `Votación` $\to$ `Gala TV` $\to$ `Podio`.
- Master reset and demo reset options.

**Step 2: Live monitoring and voting override**
- Live count of submitted votes (e.g., `14/15 votos listos`).
- Identify pending voters and emergency force-close voting button.
- Gala navigation buttons: "Siguiente Votante", "Revelar Puntos Bajos", "Revelar Top 3", "Finalizar Gala".

---

### Task 8: Routing, Navigation & Verification

**Files:**
- Create: `src/App.tsx`
- Create: `src/components/Navigation.tsx`

**Step 1: Assemble navigation and multi-view routes**
- Clean header switcher allowing easy toggling between `/tv` (fullscreen TV presentation), `/votar` (mobile voter experience), and `/admin` (superadmin control).

**Step 2: Build validation and browser test**
- Run TypeScript typecheck and Vite production build.
- Launch local development server and verify responsive layout on desktop and mobile viewports.
