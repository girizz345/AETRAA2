# BOQ POMI V1 — notes for Claude Code

This folder is the BOQ POMI V1 agent: drawings in, a POMI bill of quantities out
(`README.md`, `RUN.md`).

- **To run it on a project, use the `boq-pomi` skill** (`.claude/skills/boq-pomi/SKILL.md`). It covers updating,
  running in the background, and answering the readings the agent could not make itself (`readers/requests.py`).
- **The model never measures.** It copies what a drawing prints: drawn schedules, title blocks, grid dimension
  figures, levels and notes (DECISIONS.md 11). Code computes every quantity, including the blockwork, finishes and
  waterproofing measured off the plans (DECISIONS.md 13).
- A PARTIAL or withheld bill is the agent working as designed. "COVERAGE - READ FIRST.txt" in
  `output/<project> - Rev NN/` says what is missing and why.
- Tests: `python3 -m pytest -q tests` or `python3 tests/run_all.py`.
