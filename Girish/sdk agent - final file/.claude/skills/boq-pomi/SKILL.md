---
name: boq-pomi
description: Run the BOQ POMI V1 agent on a folder of drawings and see it through to a full bill, including reading the drawn schedules, title blocks, grid dimensions, levels and notes the agent could not read itself (its "requests"). Use when asked to run the BOQ, the take-off or the bill of quantities on a project folder, or when a run ends with "PARTIAL BILL", "No deliverable issued" or "the completeness gate FAILED ... not read".
---

# Run the BOQ agent and clear what it could not read

You are running on the user's own Mac, with the user's own Claude sign-in. The
agent's model calls use that same sign-in. Everything below stays on this
machine.

## The rule that governs every reading

You may **copy what a drawing prints**:

- the cells of a drawn door/window schedule (mark, type, size, location,
  number, description);
- the fields of a title block (drawing number, title, scale, plot, job title,
  owner);
- the dimension figures printed along a grid;
- the level marks;
- the notes.

You may **never measure, total, scale, convert or infer** a value
(DECISIONS.md 11, confirmed by Ajay). The agent's code does every measuring. A value you cannot read with certainty goes under
`illegible`, with where it is and why. It never goes in as a guess.

## 1. Get the latest agent

- If this folder is inside a git clone of the AETRAA repository, run `git pull`.
- If it is the installed copy (`~/Documents/AETRAA/agents/boq_pomi_v1`), copy
  the repository's `Girish/sdk agent - final file/.` over it, as `RUN.md` says.
- The plans are measured with the platform's engine, which is the repository's
  `Girish/boq_arch` folder. It must sit **beside** this folder: next to
  `boq_pomi_v1` on an installed copy, so copy it to
  `~/Documents/AETRAA/agents/boq_arch`. It also needs
  `python3 -m pip install --user numpy scipy`. Without either, the run bills only
  doors and windows, and its gaps say "the measuring engine is not beside the
  agent".
- Check it: `python3 agent.py --preflight` must say `signed in  yes`.
- If it says the model link is missing, run `python3 -m pip install --user claude-agent-sdk`.

## 2. Run it

A full run on a big package takes 20-40+ minutes. Run it in the background and
read its output as it goes, rather than waiting on one command that times out.

```bash
env -u CLAUDECODE python3 -u agent.py "<drawings folder>" > run.log 2>&1
```

`env -u CLAUDECODE` is harmless. Older versions of the model link need it to
start their own Claude calls from inside this session.

- Add `--no-ai` for a quick draft with no model at all.
The run ends one of three ways:

- `Deliverable: <zip>` means a full bill.
- `PARTIAL BILL` means a bill was issued without some sections. Its files say
  "(PARTIAL)", and "COVERAGE - READ FIRST.txt" names each missing section and why.
- `No deliverable issued — <why>` means no bill.

The results are in `output/<project> - Rev NN/`, including "Questions and gaps.txt".

## 3. When the bill is PARTIAL or withheld because something was not read

Something drawn that the model did not read, because of a timeout, `--no-ai`
or no sign-in, leaves a request in `readings/`. This can be a schedule, a title
block, a grid's dimensions, the levels or the notes. The bill stays PARTIAL
until it is read. Answer each request yourself.

Read "COVERAGE - READ FIRST.txt" first. A section missing because "not yet
measured by this version" is a limit of the agent, and no reading will fill it,
so report it. A section missing because a schedule was not read is what the
requests below fix.

```bash
python3 -m readers.requests list          # what is waiting
python3 -m readers.requests show "<request folder>"   # the prompt, the schema, the tile images
```

For each request:

1. Open **every tile image** listed by `show` with the Read tool. The tiles
   overlap, so an item seen in two tiles is **one** item.
2. Write the answer as ONE JSON object that fits the schema `show` printed. For
   example, for a schedule:

   ```json
   {"rows": [{"mark": "D-1", "type": "HINGED DOOR", "size": "1200X2200", "shown_size": "",
              "location": "STAIRCASE", "count": 20, "description": "..."}],
    "sheet_notes": ["..."], "illegible": []}
   ```

   Copy every string exactly as printed. `count` is the number in the card's
   NO. cell, as printed.
3. Save it with `python3 -m readers.requests save "<request folder>" answer.json`.
   A wrong shape is refused with the reason, and nothing is written. Fix it and
   save again.

When `list` says nothing is waiting, run step 2 again. The saved readings are
used, and the bill issues in full, or with only the sections this version cannot
yet measure still missing.

## 4. Report back

Tell the user, in plain words:

- whether a full or PARTIAL bill was issued, and where the output folder is;
- each section's items and main quantities: doors and windows by type,
  blockwork m2, finishes and waterproofing;
- what "COVERAGE - READ FIRST.txt" still lists as missing, and why;
- anything you put under `illegible`;
- the questions in "Questions and gaps.txt" that need the consultant, such as
  counts that differ from the plans, a missing floor plan, or sheets that name
  another plot.

Do not change the agent's code unless the user asks you to.
