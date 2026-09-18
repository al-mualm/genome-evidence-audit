# Genome Evidence Audit v0.3.1-alpha.1

This prerelease makes the integrated workbench easier to use in research reporting.

## Added

- A publication-oriented sample-by-feature genomic evidence matrix.
- A four-step workflow and editable, de-identified figure labels.
- Editable SVG and three-times-resolution PNG figure downloads.
- A sample-level CSV containing QC, species, MLST, AMR and virulence fields.
- A ready-to-edit scientific figure caption with interpretation limits.
- A visible provisional software citation, copy action and BibTeX download pending publication of the peer-reviewed article.

## Validation

The automated suite covers SVG escaping, CSV fields and caption boundaries in addition to the existing genomic-analysis tests. TypeScript checking and the optimized production build pass. The integrated genome workflow remains browser-only and does not upload genome files.
