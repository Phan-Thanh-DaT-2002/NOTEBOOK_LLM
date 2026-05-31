# AI Agent Operational Rules & Skills Directory (`agent.md`)

Welcome, AI Agent! This file is your operational handbook for this repository. You must read and strictly adhere to these rules and utilize the local skills provided in the `.skills` directory.

---

## 1. Core Principles & Workflow

You must operate under a **spec-driven, incremental implementation** model. Never make direct, ad-hoc changes without following the pipeline:

1. **Research & Plan**: Fully analyze the code before writing any modifications.
2. **Implementation Plan**: Update/create `implementation_plan.md` first. Request feedback from the user.
3. **Task Tracking**: Use `task.md` to track your checklist during execution.
4. **Walkthrough**: Document final achievements, verification details, and visual evidence in `walkthrough.md`.

---

## 2. Integrated Skills Mapping

We have three specialized skill repos packaged in the `.skills/` directory. You must leverage their guidelines:

### A. Core Agentic Skills (`.skills/agent-skills`)
- **Location**: `.skills/agent-skills/`
- **Use for**: Task breakdown, spec-driven development, error recovery, and launch checklists.
- **Rule**: Follow the lifecycle phases implicitly (Define → Plan → Build → Verify → Review → Ship).

### B. Git & Repository Management (`.skills/GitNexus`)
- **Location**: `.skills/GitNexus/`
- **Use for**: Safe Git branch creation, detailed commit messages, synchronization, and PR preparation.
- **Rule**:
  - Always verify `.gitignore` before committing files (never push local SQLite `/data/` or secrets).
  - Use structured commit messages: `<type>(<scope>): <short description>`.

### C. Premium UI/UX Styling (`.skills/ui-ux-pro-max`)
- **Location**: `.skills/ui-ux-pro-max/`
- **Use for**: Premium styling, glassmorphism, HSL custom colors, spacing tokens, and smooth micro-animations.
- **Rule**:
  - Use rich aesthetics with high-contrast readable elements.
  - Apply custom Tailwind or Vanilla CSS HSL values instead of standard generic color blocks.
  - Implement active hover interactions and subtle CSS loading animations.

---

## 3. Git Rules & Protection

- **Branching**: Do not commit directly to `main` or `master` without safety checks.
- **Data Safety**: `/data/` must always be ignored.
- **Credentials**: Never commit environment files `.env` or decrypted API keys.
- **Remote Repo & Synchronization**:
  - The official remote repository is **`https://github.com/Phan-Thanh-DaT-2002/NOTEBOOK_LLM.git`**.
  - **CRITICAL RULE**: You MUST ALWAYS push all new commits and updates to this remote repository (`git push origin main`) at the end of every successful task, feature, bug fix, or milestone. Never finish a turn without pushing to ensure the user's remote is 100% up-to-date.

---

## 4. Current Phase Details

- **Phase Status**: Phase 4 Complete, implementing **Phase 5 (Study Tools Enhancement)**.
- **Goal**: Implement Mind Map, Timeline Visual, Spaced Repetition, and Quiz timer/review.
- **Next Step**: After implementing Phase 5, prepare the repository for Phase 6 (Audio Overview).
