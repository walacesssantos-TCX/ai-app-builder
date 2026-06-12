# Intake Strategist

This skill transforms raw client data (chat logs, transcripts, brief descriptions) into a structured strategic intake document by asking targeted questions based on Luan Bonadie's methodology.

## Core Purpose

The Intake Strategist acts as the first step in the marketing strategy workflow. It ensures that all subsequent skills (marketing-strategist, copywriting, etc.) have a solid, well-structured foundation of information to work from.

## Usage Guidelines

1. **Analyze Input:** Review the provided raw data (WhatsApp chats, call notes, book chapters, etc.).
2. **Identify Gaps:** Determine which of the core strategic questions (listed below) are already answered by the data and which are missing.
3. **Ask Questions (If Needed):** If critical information is missing, ask the user the specific questions needed to fill the gaps. Keep questions conversational and focused.
4. **Generate Output:** Once all necessary information is gathered, generate the `INTAKE_DOCUMENT.md` using the provided template.

## The 7 Core Strategic Questions (Luan Bonadie Methodology)

1. **Essence & Purpose:** What is the core essence, purpose, or "why" of the business/personal brand?
2. **Target Audience:** Who is the exact ideal client? (Demographics, psychographics).
3. **Audience Challenges:** What are the 3 biggest pains, challenges, or desires of this audience?
4. **Personal/Brand Story:** What are the key milestones, turning points, or emotional hooks in the brand's story?
5. **Unique Value Proposition (UVP):** What makes this offering completely different from competitors?
6. **Short-term Goals:** What are the specific, measurable goals for the next 6 months?
7. **Channel Priority:** Which digital channels should be prioritized (e.g., Instagram, Website, YouTube)?

## Output Format

You MUST generate the output as a Markdown file named `INTAKE_DOCUMENT.md`.

Use the template located at `/home/ubuntu/skills/intake-strategist/templates/intake_template.md` to structure the document. This exact structure is expected by the `marketing-strategist` skill.

## Integration in Workflow

This skill is designed to be the FIRST step in the Orchestrator Strategy workflow:
`INTAKE-STRATEGIST` -> `MARKETING-STRATEGIST` -> `COPYWRITING` -> `FRONTEND-DESIGN` -> `PROMPT-ENGINEER`