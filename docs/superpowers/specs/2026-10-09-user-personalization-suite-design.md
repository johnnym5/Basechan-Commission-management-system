# Comprehensive User Personalization Suite Design

**Status:** Proposed
**Date:** 2026-10-09
**Target:** System-wide User Personalization across Chat, Share Cards, Dashboards, and Workspace Preferences

---

## 1. Executive Summary & Purpose

Enhance Basechan CMS with a unified **User Personalization Suite** that leverages authenticated identity (`displayName`, `email`, `role`, `organizationName`), agency context, and learned behavioral memory (`AgentChatProfile`) to make the platform feel tailored to each individual user.

### Core Personalization Enhancements:
1. **Personalized Time-Aware Chat Greetings & Contextual Prompts:** Time-aware greetings with the user's name and agency/role, plus smart prompt suggestions powered by their top favorited/searched schools.
2. **Agency Branded Share Cards & Export Watermarks:** Rate card exports (WhatsApp quotes, Canvas images, and Print letterheads) automatically include Agency Name (*"Prepared for SI-UK Ghana by Sarah"*).
3. **"Jump Back In" Personal Workspace Widget:** Personalized dashboard greeting card displaying recent searches, favorite school count, and quick shortcuts.
4. **Favorite School Rate Change Alerts:** Automated notification highlights whenever an Admin updates rates or guidance for a school on the user's Favorites list.
5. **Personal Workspace Preferences:** User-level preferences stored in account profiles for preferred default currency (£/$/€), preferred display mode, and default study level.

---

## 2. Component Design & Touchpoints

### A. Personalized Time-Aware Chat Greetings (`ChatExperience.tsx`, `chatSession.ts`)
* **Time-Aware Greeting Engine:**
  * `05:00 - 11:59`: "Good morning, [Name]! Ready to find routes for [Agency/Role]?"
  * `12:00 - 16:59`: "Good afternoon, [Name]! What school or intake can I help you find?"
  * `17:00 - 04:59`: "Good evening, [Name]! Welcome back to your [Agency/Role] workspace."
* **Smart Prompt Chips:** Replaces generic empty prompts with personalized chips derived from the user's top favorited schools (e.g. *"Show my PG routes for Leicester University"*).

---

### B. Agency Branded Share Cards & Canvas Exports (`ShareRateCardModal.tsx`)
* **Agency Watermark & Attribution:**
  * For Agents: *"Prepared for [Organization Name] • By [Display Name]"*
  * For Staff/Admin: *"Prepared by [Display Name] • Basechan Official Schedule"*
* **Canvas Image Export:** Draws the user's name and organization badge directly on the generated PNG card.
* **WhatsApp Text Quote:** Appends formatted attribution text at the bottom of the WhatsApp quote string.

---

### C. "Jump Back In" Dashboard Workspace Widget (`DashboardView.tsx`, `RoleDashboardView.tsx`)
* **Personalized Header Card:**
  * Renders a compact, dark obsidian card on top of the dashboard:
    * **User Avatar & Name:** *"Welcome back, [Name]"*
    * **Agency / Role Badge:** Displays exact role and organization name.
    * **Quick Stats:** Number of favorited schools, active agency rates, and quick link to open Chat or resume last search.

---

### D. Favorite School Rate Change Alerts (`userUpdates.ts`, `ChatExperience.tsx`)
* **Personalized Notice Filter:**
  * When updates arrive in `userUpdates.ts`, compare the updated `affectedSchoolIds` against the user's `favorites` list.
  * If a match occurs, display a highlighted badge in the Activity center and Chat banner:
    * *"Rates for 2 of your favorited schools (Leicester & Coventry) were updated today!"*

---

### E. Personal Workspace Preferences (`AuthContext.tsx`, `useSystemConfig.ts`)
* **User Profile Preferences Object:**
  ```typescript
  export interface UserWorkspacePreferences {
    preferredCurrency: CurrencyCode; // 'GBP' | 'USD' | 'EUR' | 'GHS' | ...
    defaultViewMode: 'cards' | 'table';
    favoriteLevel?: StudyLevel;
  }
  ```
* **Persistence:** Persisted in `users/{uid}` in Firestore and synced with local IndexedDB cache.

---

## 3. Verification & Testing Plan

1. **Unit Tests:**
   * Test time-aware greeting generator with mock timestamps (Morning, Afternoon, Evening) and user names.
   * Test WhatsApp quote string output in `ShareRateCardModal` to verify Agency and User attribution lines.
   * Test Favorite School alert matcher when update notice matches a favorited university ID.
2. **Production Build & Visual Check:**
   * Run `npm run build` to verify zero TypeScript errors.
   * Test live render on Firebase Hosting.
