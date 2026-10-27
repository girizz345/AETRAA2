# R-FOLDER-SEQUENCE — folder by folder, revision by revision

When the inputs are split across several folders, the take-off is produced **one
folder at a time, in the order the folders appear**, and each completed folder is
issued as a numbered **revision** before the next folder starts. This keeps a steady
issue rhythm and a clean audit trail of how the works developed.

## The rule

- Each subfolder is a **successive issue of the same scope** — e.g. `Tender`, then
  `IFC`, then `IFC-RevB`. Folder order = issue order (as the folders are listed).
- For each folder, in order, run the full gated pipeline: validate → read every
  drawing (no-skip) → measure → reconcile against the schedules → gate check →
  build. On success it is **issued as a revision**: first folder → **Rev 0**
  (baseline), next → **Rev 1**, and so on, **automatically**.
- Because each issue **supersedes** the previous, every Rev ≥ 1 carries a
  **"REVISION CHANGES" sheet inside its own workbook** listing what the new issue
  **added, omitted and changed** (old → new quantity and the difference) versus the
  prior Rev. The revision Excel is the only deliverable — the delta lives inside it,
  not as a separate file.
- A folder that **fails reconciliation or the gates HALTS the whole sequence** at
  that folder. The next folder does not start until it is resolved. Folders are
  never skipped.

## How it runs

```
python scripts/run_batch.py <parent_dir> --out <parent_dir>/out
```

`<parent_dir>` contains the issue subfolders. Each issue subfolder must hold, by the
time the batch finalises it, the model-produced evidence for that issue:
`<issue>/work/inventory.json` and `<issue>/work/takeoff.json` (built exactly as in
the single-folder pipeline — `pipeline.md`). The batch then, per folder in order:
reconciles, gate-checks, builds `out/Rev{N}/TakeOff_Rev{N}.xlsx` + call-out
drawings, embeds the supersede delta for N ≥ 1, appends to `out/revisions.json`, and
moves to the next folder — stopping immediately if any folder fails.

## Why per-folder, not all-at-once

Issuing folder-by-folder means each revision is a complete, gated, defensible
deliverable in its own right, and the change between issues is explicit. A later
issue can never quietly drop scope: the supersede sheet shows every omission, and
the reconciliation gate still requires every scheduled element of that issue to be
measured.
