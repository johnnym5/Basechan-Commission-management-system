# User Personalization Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement system-wide personalization across Chat, Share Cards, Dashboards, and Favorite Notifications using authenticated identity (`displayName`, `email`, `role`, `organizationId`), agency branding, and behavioral memory.

**Architecture:** Extend Chat greeting logic with time-aware personalized greetings and top-school prompt chips. Add agency/user attribution lines to WhatsApp quotes and Canvas PNG card exports in `ShareRateCardModal`. Render a sleek "Jump Back In" personal welcome card in `RoleDashboardView` and `DashboardView`. Add favorite school match highlighting to activity notifications.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS v4, Lucide React icons, Canvas 2D API, Firebase Firestore.

**Spec:** `docs/superpowers/specs/2026-10-09-user-personalization-suite-design.md`

## Global Constraints

- Preserve existing security and data isolation rules.
- Agency branding on share cards must render organization name when available, falling back gracefully to user role/email.
- Maintain responsive layout and high accessibility across mobile and desktop displays.
- Ensure all text elements adhere to system-wide Inter font styles.

## Review Focus

- Time-aware greetings must generate correct period labels (Morning, Afternoon, Evening) based on local time.
- Canvas rate card export must position agency watermark and user attribution without overlapping existing text elements.
- Favorite school update notifications must correctly match updated school IDs against user favorites.

---

### Task 1: Time-Aware Personalized Chat Greetings & Smart Prompts

**Files:**
- Modify: `src/services/chatSession.ts`
- Modify: `src/components/ChatExperience.tsx`
- Test: `src/services/chatSession.test.ts`

**Interfaces:**
- Consumes: `useAuth` (`user`, `role`, `access`), `AgentChatProfile`, `FavoriteSchool[]`.
- Produces: Time-aware named greeting function `generatePersonalizedGreeting(user, role, organizationName)` and smart favorite-derived prompt chips.

- [ ] **Step 1: Write the failing test for `generatePersonalizedGreeting`**

```typescript
// src/services/chatSession.test.ts
import { describe, it, expect } from 'vitest';
import { generatePersonalizedGreeting } from './chatSession';

describe('generatePersonalizedGreeting', () => {
  it('generates a time-aware named greeting with agency context', () => {
    const greeting = generatePersonalizedGreeting(
      { displayName: 'Sarah' },
      'AGENT',
      'SI-UK Ghana',
      new Date('2026-10-09T09:00:00')
    );
    expect(greeting).toContain('Good morning, Sarah');
    expect(greeting).toContain('SI-UK Ghana');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/chatSession.test.ts`
Expected: FAIL with "generatePersonalizedGreeting is not exported"

- [ ] **Step 3: Implement `generatePersonalizedGreeting` in `chatSession.ts` and update `ChatExperience.tsx`**

Implement `generatePersonalizedGreeting` in `src/services/chatSession.ts`:
```typescript
export function generatePersonalizedGreeting(
  user: { displayName?: string | null; email?: string | null } | null,
  role: 'ADMIN' | 'STAFF' | 'AGENT',
  organizationName?: string,
  now = new Date()
): string {
  const name = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = now.getHours();
  const timePeriod = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const context = organizationName ? ` for ${organizationName}` : role === 'ADMIN' ? ' in Admin Intelligence' : role === 'STAFF' ? ' in Staff Workspace' : '';
  return `${timePeriod}, ${name}! What school or route can I find${context}?`;
}
```

Update `ChatExperience.tsx` empty-chat view to display the personalized greeting and generate smart prompt chips using user's favorited schools.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/chatSession.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/chatSession.ts src/components/ChatExperience.tsx src/services/chatSession.test.ts
git commit -m "feat: implement time-aware personalized chat greetings and smart prompts"
```

---

### Task 2: Agency Branded Share Cards & Export Attribution

**Files:**
- Modify: `src/components/ShareRateCardModal.tsx`

**Interfaces:**
- Consumes: `useAuth` (`user`, `access`), `CommissionRate`, `CurrencyCode`.
- Produces: Enhanced WhatsApp quote text and Canvas PNG card export featuring Agency Name and User attribution.

- [ ] **Step 1: Inspect `ShareRateCardModal.tsx` for attribution placement**

Verify existing quote and canvas export logic in `src/components/ShareRateCardModal.tsx`.

- [ ] **Step 2: Update `generateWhatsAppQuote` and Canvas export in `ShareRateCardModal.tsx`**

Add attribution lines:
```typescript
const attributionLine = access.organizationId
  ? `Verified Rate Schedule • Prepared for ${organizationName || 'Agency Partner'} by ${user?.displayName || user?.email}`
  : `Verified Corporate Schedule • Prepared by ${user?.displayName || user?.email || 'Basechan CMS'}`;
```
Draw attribution text on Canvas PNG export footer and append to WhatsApp quote string.

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ShareRateCardModal.tsx
git commit -m "feat: add agency branding and user attribution to share rate cards"
```

---

### Task 3: "Jump Back In" Dashboard Workspace Widget

**Files:**
- Create: `src/components/PersonalWorkspaceWidget.tsx`
- Modify: `src/components/RoleDashboardView.tsx`, `src/components/DashboardView.tsx`

**Interfaces:**
- Consumes: `useAuth` (`user`, `role`, `access`), `FavoriteSchool[]`.
- Produces: `PersonalWorkspaceWidget` component rendered at the top of Admin, Staff, and Agent dashboards.

- [ ] **Step 1: Create `PersonalWorkspaceWidget.tsx`**

```typescript
// src/components/PersonalWorkspaceWidget.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Star, ArrowRight } from 'lucide-react';

export const PersonalWorkspaceWidget: React.FC<{ favoriteCount?: number }> = ({ favoriteCount = 0 }) => {
  const { user, role, access } = useAuth();
  const name = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-[#0E1526] border border-[#222F43] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-400/15 text-amber-400 border border-amber-400/30 flex items-center justify-center shrink-0 font-extrabold text-sm">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="font-extrabold text-sm sm:text-base text-slate-100">
            Welcome back, {name}
          </h2>
          <p className="text-xs text-slate-400">
            {role === 'ADMIN' ? 'Administrator Workspace' : role === 'STAFF' ? 'Staff Application Guide' : 'Agency Partner Portal'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {favoriteCount > 0 && (
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 font-bold flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>{favoriteCount} Favorite Schools</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Embed `PersonalWorkspaceWidget` in `RoleDashboardView.tsx` and `DashboardView.tsx`**

Mount `<PersonalWorkspaceWidget favoriteCount={favorites.length} />` at the top of the dashboard content area.

- [ ] **Step 3: Run test suite to verify dashboard tests pass**

Run: `npx vitest run src/components/RoleDashboardView.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/PersonalWorkspaceWidget.tsx src/components/RoleDashboardView.tsx src/components/DashboardView.tsx
git commit -m "feat: add Jump Back In personal workspace widget to dashboards"
```

---

### Task 4: Favorite School Rate Change Alerts

**Files:**
- Modify: `src/components/ChatExperience.tsx`
- Modify: `src/services/userUpdates.ts`

**Interfaces:**
- Consumes: `FavoriteSchool[]`, `UserUpdate[]`.
- Produces: Highlighted notice when activity updates match any of the user's favorited school IDs.

- [ ] **Step 1: Implement favorite school update matcher in `ChatExperience.tsx`**

Check if any update in `activityUpdates` matches `favorites.map(f => f.universityId)`. If matched, render a highlighted notification badge:
*"Rates for your favorited school ([School Name]) were updated!"*

- [ ] **Step 2: Run test suite to verify pass**

Run: `npx vitest run src/components/ChatExperience.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatExperience.tsx src/services/userUpdates.ts
git commit -m "feat: add favorite school rate change alerts"
```

---

### Task 5: Production Build & Live Deployment

**Files:**
- All modified components and services.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS across all unit test files.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Production build compiles with 0 errors.

- [ ] **Step 3: Deploy live to Firebase**

Run: `npx -y firebase-tools@latest deploy`
Expected: Live deployment complete.
