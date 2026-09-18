# Genome Evidence Audit — browser edition

A research interface for the direct exact-sequence-retention component of the study software. Select an original assembly, its selected contigs, and marker FASTA; inspect the results and download CSV or JSON. Version 0.2.1 can classify user-annotated markers as resistance, virulence, MLST, species, or other evidence.

## Start

- Open the website in a current desktop browser.
- Click **Try an example** for invented resistance, virulence, MLST, and species markers (two retained markers, one lost marker, and one absent marker).
- Choose your three uncompressed FASTA files and click **Run sequence audit**.
- Optionally annotate marker headers, for example `>blaKPC-2|category=resistance|trait=carbapenem|database=AMRFinderPlus`.
- Inspect the subset check before interpreting any sequence loss.
- Download the full report, including SHA-256 input fingerprints and 1-based inclusive match coordinates.

The evidence category and descriptive fields come from the uploaded FASTA header; the website does not verify them against an external database. Exact detection can report that a supplied resistance-associated, virulence-associated, MLST, or species marker sequence is present or was lost during processing. It does not convert that match into antimicrobial susceptibility, disease severity, species confirmation, sequence type, or transmission.

No FASTQ upload, assembly, reference alignment, automatic marker identification, database search, ST assignment, phenotype prediction, threshold optimization or empirical calibration runs in this edition. It is not a replacement for AMRFinderPlus, Kleborate, Kaptive, a full MLST caller, phenotypic susceptibility testing, or an outbreak analysis pipeline. A supplied marker that has no exact hit in the original assembly cannot support a baseline-loss conclusion.

## Marker annotation format

Marker metadata are optional pipe-delimited `key=value` fields in the FASTA identifier. Supported categories are `resistance` (or `amr`), `virulence`, `mlst`, `species`, and `other`. Supported descriptive fields are `trait`, `locus`, `allele`, `database` (or `db`), and `accession`.

```fasta
>blaKPC-2|category=resistance|trait=carbapenem|database=AMRFinderPlus|accession=WP_000000001
ACGT...
>phoE_6|category=mlst|locus=phoE|allele=6|database=PubMLST
ACGT...
```

Use database names, versions, and accessions that can be independently checked. The annotation is included in CSV and JSON exports.

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

The public website is https://al-mualm.github.io/genome-evidence-audit/ and source code is at https://github.com/al-mualm/genome-evidence-audit. Release v0.1.1 identifies the browser edition reported in the manuscript. No patient metadata or study sequences are included. Project-authored code is available under the MIT License; dependencies retain their respective licenses.

A manual GitHub Pages workflow is included at `.github/workflows/pages.yml`. Enable Pages with GitHub Actions as the source and run the workflow when public release is intended and the repository/account plan supports it. The build sets the repository base path. GitHub Pages hosts static application files; all analysis executes on the visitor's device. The workflow is manual so ordinary source pushes do not publish unexpectedly.

## Validation and scientific status

`npm test` exercises exact matches, reverse complements, coordinates, overlapping matches, multiplicity, copy reduction, malformed inputs, output escaping, file limits and worker behavior. `tests/reconcile-study.mjs` compares the browser calculation core to the bundled reference Python `audit()` on the local study files without copying or publishing them. Aggregated parity results are in `docs/validation.json` when available.

This verifies computational agreement, not biological accuracy, clinical utility, novelty or superiority to existing tools. The reference-context and population-calibration portions of the study are outside this edition. Empty marker collections in the research archive can be compared at the core-function level; the web form intentionally rejects an empty marker file.

The interface and calculation core are v0.2.1. Exact retention behavior remains unchanged from the validated v0.1.1 interface; the annotation parser, four-category demonstration, and category summaries have automated tests. The Python reference remains v0.2.0. Computational parity does not substitute for biological validation, comprehensive browser compatibility, or usability testing.

The proposed GitHub-only extension for automated species, MLST, AMR, virulence, and multi-genome relatedness reporting is documented in [`docs/GITHUB_ONLY_INTERPRETATION_PLAN.md`](docs/GITHUB_ONLY_INTERPRETATION_PLAN.md). These proposed modules are not implemented or validated in the current browser release.

## Citation and reference implementation

Genome Evidence Audit contributors. Genome Evidence Audit browser edition. Version 0.2.1. 2026. https://github.com/al-mualm/genome-evidence-audit/releases/tag/v0.2.1

The original Python audit core (v0.2.0) is in `reference/evidence_stability.py`; its version numbering is independent of the browser edition. The repository contains the audit reference and browser interface, not all assembly/calibration workflow scripts or raw study inputs. The release has no archival DOI.
