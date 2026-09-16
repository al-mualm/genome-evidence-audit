# Genome Evidence Audit — browser edition

A research interface for the direct exact-sequence-retention component of the study software. Select an original assembly, its selected contigs, and marker FASTA; inspect the results and download CSV or JSON.

## Start

- Open the website in a current desktop browser.
- Click **Try an example** for invented short sequences (one retained marker, one lost marker, one absent marker).
- Choose your three uncompressed FASTA files and click **Run sequence audit**.
- Inspect the subset check before interpreting any sequence loss.
- Download the full report, including SHA-256 input fingerprints and 1-based inclusive match coordinates.

No FASTQ upload, assembly, reference alignment, automatic marker identification, ST assignment, resistance/virulence prediction, threshold optimization or empirical calibration runs in this edition. It is not a replacement for the full Python study pipeline. A supplied marker that has no exact hit in the original assembly cannot support a baseline-loss conclusion.

## Privacy and limits

Genome inputs stay in browser memory and are processed in a Web Worker. The application makes no network request containing input files, names, sequences or results, uses no analytics, and does not store inputs in browser storage. Ordinary site hosting/access logs are separate from the analysis. Downloads are saved only when requested. Closing the tab or clearing files releases application references; no forensic secure-deletion claim is made.

Assemblies: A/C/G/T/N, maximum 24 MiB each and 20,000 contigs. Markers: A/C/G/T only, maximum 256 KiB and 64 sequences. Matching aborts above 10,000 occurrences for a marker. Empty selected FASTA is supported; original and marker inputs must be nonempty. Use the command-line tool for larger or differently encoded inputs. No patient identifiers are necessary.

The subset certificate tolerates renamed/reordered/reverse-complemented contigs, checks multiplicity, and rejects novel or altered contig sequences. Match counts include overlaps, count palindromic markers once per coordinate, and search both strands. Retention and copy-count reduction are reported separately.

## Local development

Node 22.13 or newer:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Static output is `dist/client`. `public/audit-core.mjs` is the calculation implementation and `public/audit-worker.mjs` is the file-reading, hashing and progress adapter. There is no analysis backend or API key.

## GitHub and deployment

The public website is https://genome-evidence-audit.almualm.chatgpt.site and source code is at https://github.com/al-mualm/genome-evidence-audit. Release v0.1.0 identifies the browser edition reported in the manuscript. No patient metadata or study sequences are included. Project-authored code is available under the MIT License; dependencies retain their respective licenses.

A manual GitHub Pages workflow is included at `.github/workflows/pages.yml`. Enable Pages with GitHub Actions as the source and run the workflow when public release is intended and the repository/account plan supports it. The build sets the repository base path. GitHub Pages hosts static application files; all analysis executes on the visitor's device. The workflow is manual so ordinary source pushes do not publish unexpectedly.

## Validation and scientific status

`npm test` exercises exact matches, reverse complements, coordinates, overlapping matches, multiplicity, copy reduction, malformed inputs, output escaping, file limits and worker behavior. `tests/reconcile-study.mjs` compares the browser calculation core to the bundled reference Python `audit()` on the local study files without copying or publishing them. Aggregated parity results are in `docs/validation.json` when available.

This verifies computational agreement, not biological accuracy, clinical utility, novelty or superiority to existing tools. The reference-context and population-calibration portions of the study are outside this edition. Empty marker collections in the research archive can be compared at the core-function level; the web form intentionally rejects an empty marker file.

Broader browser interaction/visual testing was not requested and is not claimed. The optional read-only WebMCP summary tool is feature-detected; no supported WebMCP validation context was available, so its registration contract has not been independently verified.

## Citation and reference implementation

Genome Evidence Audit contributors. Genome Evidence Audit browser edition. Version 0.1.0. 2026. https://github.com/al-mualm/genome-evidence-audit/releases/tag/v0.1.0

The original Python audit core (v0.2.0) is in `reference/evidence_stability.py`; its version numbering is independent of the browser edition. The repository contains the audit reference and browser interface, not all assembly/calibration workflow scripts or raw study inputs. The release has no archival DOI.
