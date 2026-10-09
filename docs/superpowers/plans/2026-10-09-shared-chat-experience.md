# Shared chat experience redesign Implementation Plan

> **For agentic workers:** Use the `superpowers:executing-plans` skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one focused, mobile-ready black-and-blue chat experience across Admin, Staff, and Agent while preserving each role’s existing behavior and access boundaries.

**Architecture:** Keep `ChatExperience` as the owner of conversation/search state and make History, Activity, and Favorites presentation overlays around the existing chat rather than alternate pages. Add focused component styles and only adjust the app shell sizing where needed; keep Admin shell controls and Staff/Agent gates intact.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, scoped CSS transitions, Lucide icons. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-09-shared-chat-experience-design.md`

## Global Constraints

- Use Canvas `#111111`, Surface `#1B1B1B`, Raised surface `#252525`, Primary text `#F3F4F6`, Muted text `#A1A1AA`, and Blue accent `#2563EB`.
- Desktop and tablet utility panels enter from the right; narrow mobile utility panels enter from the bottom.
- Target 180–250 ms entry and a quieter, shorter exit; animate opacity and transform only.
- Reduced-motion users receive immediate state changes with the same final layout and functionality.
- Preserve local deterministic chat/search, offline behavior, persistence, role-based access, result actions, and the existing Admin shell.
- Place non-blocking local-only, quota, cache freshness, and sync notices inside Activity on Chat; keep quota and network loss distinct and leave the app status indicator in the shell.
- Do not add dependencies. Add focused automated tests for utility-panel actions and overlay behavior; run the targeted chat tests and the project suite.

## Review Focus

- Opening and dismissing a panel must preserve the active transcript and unsent composer draft.
- A panel must close on Escape/backdrop and return keyboard focus to its opener.
- The mobile composer must remain reachable when the virtual keyboard is open and must not cover the latest message.
- Staff/Agent Chat must remain isolated from Admin backend navigation; Admin retains its shell and role preview controls.
- Long history, activity, favorites, and result lists must scroll within their panel or transcript without expanding the viewport.

## File Map

- `src/components/ChatUtilityPanel.tsx` — panel content for History, Activity, or Favorites; receives data and callbacks and does not own chat/search state.
- `src/components/ChatExperience.tsx` — owns panel selection, overlay lifecycle, opener focus return, and shared chat surface.
- `src/components/ChatExperience.test.ts` — overlay state, composer preservation, Escape/backdrop dismissal, and focus restoration.
- `src/components/ChatExperience.css` — scoped visual tokens, full-height layout, responsive drawer/sheet geometry, safe-area/composer layout, and motion/reduced-motion rules.
- `src/components/AppLayout.tsx` — supplies the chat page with available viewport height and removes chat-only sizing constraints without changing shell navigation or role gates.

## Task 1: Extract utility panel content

**Files:**
- Create: `src/components/ChatUtilityPanel.tsx`
- Modify: `src/components/ChatExperience.tsx`

**Interfaces:**
- Produces `ChatUtilityPanelProps` with `panel: 'history' | 'favorites' | 'activity'`, `conversations: ChatConversation[]`, `favorites: FavoriteSchool[]`, `updates: UserUpdate[]`, and callbacks `onSelectConversation`, `onNewConversation`, `onSearchFavorite`, `onRemoveFavorite`, `onOpenUpdate`.
- The component renders panel contents only; the parent owns the overlay, close control, focus behavior, and all chat state.

- [ ] Move the current History, Favorites, and Updates list markup into `ChatUtilityPanel` while preserving the current item actions and role-filtered display.
- [ ] Rename the user-facing panel label from “Updates” to “Activity”; continue using the existing `updates` data and `openUpdate` behavior.
- [ ] Keep the panel component free of Firestore/local persistence calls; invoke parent callbacks for all mutations and navigation.
- [ ] Cover the extracted panel through the ChatExperience integration tests, asserting visible panel content and the effects of its user actions.
- [ ] Show local-only reason and sync notices in Activity; preserve distinct quota and connectivity messages.

## Task 2: Keep the conversation mounted and present utility overlays

**Files:**
- Modify: `src/components/ChatExperience.tsx`
- Modify: `src/components/ChatExperience.test.ts`
- Modify: `src/components/ChatUtilityPanel.tsx`

**Interfaces:**
- Add parent state `utilityPanel: 'history' | 'favorites' | 'activity' | null` while retaining `activePanel` for the existing `chat`/`results` mode.
- `ChatUtilityPanel` consumes the interface from Task 1.

- [ ] Replace the mutually exclusive History/Favorites/Updates page branch with an overlay mounted above the existing chat surface; opening/closing it must not unmount the transcript or composer.
- [ ] Add accessible header controls for History, Activity, and Favorites, with `aria-expanded` and labels; preserve New chat and existing results navigation.
- [ ] Store the opening element in a ref, close on Escape or backdrop click, stop propagation inside the panel, and restore focus on close.
- [ ] Keep backdrop activation from firing when a user interacts with panel contents; close button and `aria-modal` semantics must be available.
- [ ] Preserve opening a conversation, starting a new conversation, searching a favorite, removing a favorite, and opening an update through the existing parent handlers.
- [ ] Add integration tests proving that opening a panel leaves the composer and draft mounted, Escape/backdrop closes the panel, and focus returns to the panel opener.

## Task 3: Apply the focused responsive visual system and motion

**Files:**
- Create: `src/components/ChatExperience.css`
- Modify: `src/components/ChatExperience.tsx`

**Interfaces:**
- Import the scoped stylesheet from `ChatExperience.tsx`; apply a root `.chat-experience` class and semantic child classes to the chat surface and utility overlay.
- CSS variables: `--chat-canvas: #111111`, `--chat-surface: #1B1B1B`, `--chat-raised: #252525`, `--chat-text: #F3F4F6`, `--chat-muted: #A1A1AA`, `--chat-accent: #2563EB`.

- [ ] Reshape the root as a viewport-filling flex column; keep the transcript as the expanding scroll region and the composer anchored within the surface.
- [ ] Apply the black/graphite/blue tokens to the header, transcript, messages, suggestions, inline results, composer, and panels, retaining semantic status colors.
- [ ] Use a right-side drawer at desktop/tablet widths and a bottom sheet on narrow screens; cap panel height/width and make panel contents independently scrollable.
- [ ] Add `env(safe-area-inset-bottom)` handling and scroll padding around the composer for mobile keyboard/viewport changes.
- [ ] Add interruptible 180–250 ms opacity/transform transitions with a subtle decelerating curve; make exit less prominent than entry and do not animate width/height/top/left.
- [ ] Add a `prefers-reduced-motion: reduce` rule that removes panel transitions without changing open/close behavior.
- [ ] Keep controls at least 44px tall, retain visible focus indicators, and preserve readable contrast and non-color status cues.

## Task 4: Integrate full-height chat with the existing role shells

**Files:**
- Modify: `src/components/AppLayout.tsx`

**Interfaces:**
- No changes to role routing, props to `ChatExperience`, or authentication/data interfaces.

- [ ] Give the Chat page a flex/min-height layout that allows the shared chat surface to fill the content area below the shell header.
- [ ] Apply full-width, zero page gutters to Admin Chat as well as Staff/Agent Chat while preserving Admin header navigation, sidebar behavior, and preview-mode controls.
- [ ] Keep Staff and Agent chat-only landing/navigation and all existing access checks unchanged.
- [ ] Ensure global notices and modals keep their existing behavior and do not intercept chat overlay controls.
- [ ] Suppress the standalone offline/quota toast while Chat is open because the same state is available in Activity; preserve these notices on non-chat pages.

## Plan self-review

- Spec coverage: Tasks 1–2 cover panel contents, Activity notices, overlay behavior, persistence of active chat, and accessible dismissal; Task 3 covers tokens, responsive layout, safe areas, motion, reduced motion, touch targets, and contrast; Task 4 covers shared Admin/Staff/Agent integration and role-shell boundaries. Local search and persistence are preserved by leaving their state/services untouched.
- Step clarity: Each implementation step has a file, behavior, and fixed design values where the spec makes a choice. No speculative search or authorization behavior is added.
- Review focus: The five likely regressions are listed above; component and integration tests cover utility actions, draft/transcript persistence, and accessible dismissal. Responsive geometry and reduced-motion styles require a browser-level inspection because jsdom does not calculate viewport and media-query layout like a browser.
- Scope: This plan changes only the shared chat UI and its shell sizing; it does not redesign unrelated admin pages or rewrite search, auth, or database layers.
