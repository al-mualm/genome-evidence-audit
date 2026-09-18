> Validation correction 2026-09-18: the historical ERR10921830 comparison below has an inconsistent input fingerprint and is not accepted as verified biological validation. See `validation.json` and `GENOME_WORKBENCH_METHODS.md`. This note preserves the release history.

# Genome Evidence Audit v0.3.0-alpha.1

This prerelease adds an integrated, browser-only _Klebsiella_ assembly workbench to the existing exact sequence-retention audit.

## Added

- Assembly QC with explicit screening warnings.
- Fixed-panel species assignment with confidence and runner-up reporting.
- Complete seven-locus KpSC MLST and ST lookup.
- CARD 3.2.9 AMR-family screening with overlapping-hit removal, high-confidence/partial separation and closest-reference labels.
- `ybt`, `iuc`, `iro`, `clb` and `rmp` evidence plus a 0–5 genomic virulence score.
- Pairwise genomic relatedness screening for batches of up to 12 assemblies.
- Versioned JSON reports containing SHA-256 fingerprints and reference provenance.
- Arabic usage documentation and a detailed methods/validation statement.

## Validation

The automated suite contains 23 tests. A real browser run on public assembly ERR10921830 agreed with official Kleborate for assembly QC, _K. pneumoniae_ assignment, ST147, 12 non-redundant high-confidence AMR-family loci and virulence score 0.

## Scientific limits

This is an alpha research release. Species results are panel assignments, AMR output is a nucleotide family screen, relatedness is MinHash triage, and clinical severity is not inferred. Phenotypic susceptibility, direct transmission and clinical diagnosis are outside the permissible interpretation.
