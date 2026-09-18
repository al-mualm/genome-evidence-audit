> Validation correction 2026-09-18: the historical ERR10921830 comparison below has an inconsistent input fingerprint and is not accepted as verified biological validation. See `validation.json` and `GENOME_WORKBENCH_METHODS.md`. This note preserves the release history.

# Genome Evidence Audit v0.3.0-alpha.2

This prerelease contains the integrated browser-only _Klebsiella_ workbench introduced in v0.3.0-alpha.1 and corrects Aioli initialisation in the optimized GitHub Pages build.

## Included analysis

- Assembly QC and fixed-panel species screening.
- Complete seven-locus KpSC MLST and ST lookup.
- CARD 3.2.9 AMR-family screening with high-confidence and partial-hit separation.
- `ybt`, `iuc`, `iro`, `clb` and `rmp` evidence with a 0–5 genomic virulence score.
- Pairwise genomic relatedness screening for batches of up to 12 assemblies.
- Versioned JSON reports with SHA-256 fingerprints and reference provenance.

## Validation

All 23 automated tests, TypeScript checking and the production build pass. A real run on the deployed GitHub Pages site using public assembly ERR10921830 produced 5,677,976 bp, 196 contigs, N50 160,135, _K. pneumoniae_, ST147, 12 non-redundant high-confidence AMR-family loci and virulence score 0.

## Scientific limits

This is an alpha research release. Species results are panel assignments, AMR output is a nucleotide family screen, relatedness is MinHash triage, and clinical severity is not inferred. Phenotypic susceptibility, direct transmission and clinical diagnosis are outside the permissible interpretation.
