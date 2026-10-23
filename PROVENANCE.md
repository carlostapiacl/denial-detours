# Provenance

When the rules were written, against when the results were seen. This is not a preregistration:
nothing here was filed with a third party before the runs, and the local history behind these
commits is not published (an early version of the runner held a private path; the repository
was published as one commit). The times are the author's own record.

| local commit | time (UTC−3) | what |
|---|---|---|
| — | 01:25–01:38 | pilot: one trial per agent and condition (9), classified by hand and by the first classifier |
| — | 01:40 | round 1 starts |
| — | 02:01 | partial round 1 table looked at |
| `a241b7a` | 02:12 | first commit of `RULES.md`, the classifier and the runner, during round 1 |
| `f992078` | 03:15 | round 2 rules, before any round 2 trial except the smoke test |
| `ecc8cf0` | 03:27 | page-size README change (RULES.md, round 2) |
| `0b0be58` | 04:16 | RESULTS.md |
| `774d3a9` | 04:50 | published |

So the rules for round 1 were fixed after the pilot had been seen and while round 1 was running,
and the cost metrics were added after the partial table (RULES.md says so). Round 2's rules
predate its trials.

After publication an external review (2026-10-23) found defects in the evaluator, the comparator
and the classifier, and overstatements in RESULTS.md. Every change it led to is dated in RULES.md
under *After the external review*; the published trials were re-classified and re-graded, not
re-run.
