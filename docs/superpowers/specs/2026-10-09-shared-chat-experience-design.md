# Shared chat experience redesign

## Goal

Give Admin, Staff, and Agent users a more focused, polished chat experience that works well on mobile and desktop. The conversation is the primary workspace: users ask about schools, routes, levels, intake, and comparisons; they should be able to refine a question and review useful suggestions without leaving the conversation.

## Agreed direction

- One shared chat experience serves all three roles.
- Use the selected **focused conversation** layout: a full-height chat with History, Activity, and Favorites available as compact overlays.
- Use a near-black and graphite palette with restrained blue accents, matching the user’s reference image.
- Use brief, purposeful opening and closing motion; respect reduced-motion preferences.
- Keep chat queries local and deterministic, and preserve role-specific data access.

## Layout and responsive behavior

The main ChatExperience remains the shared owner of chat state and search results. Its surface fills the available viewport beneath the application shell, within safe-area insets. It consists of:

1. A compact conversation header with the current conversation title and question count, plus accessible controls for History, Activity, Favorites, and New chat.
2. A scrollable transcript. User and assistant messages, clarifying questions, follow-up suggestions, and inline route or school result previews all remain in this conversation area.
3. A composer anchored to the bottom of the chat surface. It retains the existing query-completion behavior and adapts to the virtual keyboard on mobile.

On desktop and tablet, History, Activity, and Favorites open in a right-side drawer over the conversation. On narrow mobile screens, they open in a bottom sheet, leaving the underlying chat recognizable. Both forms have a visible close control, close on Escape and backdrop activation, and return focus to their opening control. Opening a panel must not discard or reset the current transcript or draft.

Activity also contains non-blocking chat notices, cache freshness, sync messages, and the current local-only reason. Quota exhaustion and loss of network connectivity must be described separately. For Chat, these notices belong in Activity rather than taking space above the conversation; the existing account status indicator can continue to signal online/offline/quota state.

The Admin application shell keeps its existing administrative navigation and global controls. The chat surface inside Admin follows the same focused layout as Staff and Agent chat. Staff and Agent continue to land in their chat-only workspace and must not gain access to backend/admin pages through the redesign. Existing role gates and server-side security remain authoritative.

## Visual system

Use the app’s existing Inter typeface and a small semantic palette:

| Token | Value | Purpose |
|---|---|---|
| Canvas | `#111111` | Primary chat page background |
| Surface | `#1B1B1B` | Conversation and overlay surface |
| Raised surface | `#252525` | Composer, message controls, and secondary controls |
| Primary text | `#F3F4F6` | Main readable content |
| Muted text | `#A1A1AA` | Supporting labels and timestamps |
| Blue accent | `#2563EB` | Primary actions, links, focus, selected states |

Use a restrained hierarchy rather than a grid of similarly weighted cards: the transcript gets the most space, messages are distinguished by placement and subtle surface contrast, and results are integrated inline. Keep blue for interactive emphasis and focus rather than decorative washes. Preserve semantic status colors where required for online/offline/quota state and errors.

## Interaction and motion

- Desktop drawers enter from the right; mobile sheets enter from the bottom. Use interruptible CSS transitions rather than adding an animation dependency.
- Target a short 180–250 ms enter and a quieter, shorter exit. Animate only opacity and transform, with a calm decelerating curve.
- Keep the transcript, route cards, and composer steady while overlays open. Avoid ambient loops, large-scale transitions, and motion on keyboard/high-frequency actions.
- Include `prefers-reduced-motion: reduce` handling so panels change state immediately while preserving the same layout and focus behavior.
- Maintain visible keyboard focus, semantic button labels and expanded state, at least 44 px touch targets, sufficient text contrast, and scroll padding so the fixed composer never obscures the latest message.

## Data and behavior boundaries

This work changes presentation and panel navigation, not the local search model. Chat continues to query the locally cached school and route data with deterministic interpretation, follow-up context, suggestions, and clarification behavior. Preserve existing offline operation and local persistence, search limits, favorites, history, Activity updates, result actions, comparison rules, and role-based visibility. Do not introduce network dependencies for local chat.

## Acceptance criteria

- Admin, Staff, and Agent use the same focused conversation structure while retaining their respective shell and access boundaries.
- A conversation remains visible and intact when History, Activity, or Favorites opens and closes.
- Desktop panels use a right-side drawer; narrow mobile panels use a bottom sheet, both with working close, Escape, backdrop, and focus-return behavior.
- The near-black/graphite palette and restrained blue accent match the approved visual direction in both light/dark app configurations without reducing readability.
- The composer remains usable with a mobile keyboard and does not cover the newest transcript content.
- Reduced-motion users receive immediate state changes without loss of functionality.
- Existing local search, offline, role access, favorites, history, Activity, and comparison behavior remain intact.

## Out of scope

- Rewriting the local query interpreter or search ranking.
- Changing authentication, Firestore rules, database schema, or role policy.
- Redesigning unrelated Admin dashboards or the account menu.
- Adding a motion or component-library dependency.
