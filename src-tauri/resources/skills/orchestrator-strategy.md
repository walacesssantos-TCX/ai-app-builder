# Orchestrator Strategy

This skill coordinates the execution of multiple specialized skills in a specific sequence to transform raw client data into a complete, ready-to-deliver digital marketing strategy package.

## Core Purpose

The Orchestrator ensures that the 6-step workflow is followed precisely, data flows correctly between skills, and the final output is packaged elegantly into a ZIP file.

## The 6-Step Workflow Sequence

You MUST execute the following steps in this exact order:

### Step 1: Intake (Skill: `intake-strategist`)
- **Input:** Raw data (text, Markdown, chat logs).
- **Action:** Read the raw data. If information is missing, ask the user strategic questions.
- **Output:** Generate `INTAKE_DOCUMENT.md`.

### Step 2: Strategy (Skill: `marketing-strategist`)
- **Input:** `INTAKE_DOCUMENT.md`.
- **Action:** Apply the marketing-strategist skill to create the core strategy.
- **Output:** Generate 5 Markdown files (`perfil_estrategico.md`, `estrategia_instagram.md`, `estrategia_website.md`, `plano_integrado.md`, and optionally `estrategia_tiktok.md`).

### Step 3: Copywriting (Skill: `copywriting`)
- **Input:** The 5 strategic Markdown files.
- **Action:** Refine the tone of voice, making titles catchier and CTAs more persuasive.
- **Output:** Overwrite the 5 Markdown files with the refined content.

### Step 4: Frontend Design (Skill: `frontend-design`)
- **Input:** The refined strategic Markdown files and brand color palette (if available).
- **Action:** Create a CMS interface to render the Markdown files. **CRITICAL:** You MUST structure your design system following the format and level of detail shown in the `references/DESIGN.md` file within the frontend-design skill. This reference is the gold standard for how a Design System should be structured (with Visual Theme, Color Palette, Typography, Components, and Layout Principles). The design should be distinctive, production-grade, and avoid generic AI aesthetics.
- **Output:** Generate `index.html` (the CMS) and `color_palette_picker.html`.

### Step 5: Prompt Engineering (Skill: `prompt-engineer`)
- **Input:** Strategic requirements for technical implementation (e.g., forms, integrations).
- **Action:** Create structured prompts for developers or other LLMs to implement features.
- **Output:** Generate `PROMPT_FORM_MENTORIA.md` and `INSTRUCOES_IMPLEMENTACAO.md`.

### Step 6: Packaging (Orchestrator Responsibility)
- **Input:** All generated files from Steps 1-5.
- **Action:** Create a `DOCUMENTOS_ENTREGA.md` (README) explaining the package. Move all files into a single directory named `{client_name}_marketing_strategy`. Zip the directory.
- **Output:** Deliver `{client_name}_marketing_strategy.zip` to the user.

## Error Handling & Validation

- Do not proceed to the next step if the current step fails to produce its required outputs.
- Ensure all files are generated in the correct working directory before zipping.
- The ZIP file MUST be the final deliverable presented to the user.