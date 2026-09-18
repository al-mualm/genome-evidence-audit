# Genome Evidence Audit — browser edition

Genome Evidence Audit is a static, browser-only research application for _Klebsiella_ assembled genomes. Version `0.3.0-alpha.2` places two reproducible workflows on one website:

1. an exact sequence-retention audit comparing an original assembly, selected contigs and user-supplied marker sequences; and
2. an integrated _Klebsiella_ workbench for assembly QC, reference-panel species screening, seven-locus MLST, AMR-family evidence, virulence loci and pairwise genomic relatedness screening.

The public website is <https://al-mualm.github.io/genome-evidence-audit/>. Genome files are analysed locally in the browser and are not uploaded to an analysis server.

## Integrated genome workbench

Upload one to twelve uncompressed assembly FASTA files (`.fasta`, `.fa` or `.fna`, maximum 30 MiB each), then select **Run integrated analysis**. The downloadable JSON report contains input SHA-256 fingerprints, software and database versions, per-sample evidence and pairwise results.

- **Assembly QC:** total size, contig count, N50, ambiguous bases and screening warnings.
- **Species screen:** deterministic canonical 15-mer MinHash assignment against a fixed ten-genome _Klebsiella_-focused panel, with strong, weak, ambiguous and unassigned outcomes.
- **MLST:** seven-locus _K. pneumoniae_ complex allele calls and profile lookup.
- **AMR evidence:** non-redundant acquired or intrinsic resistance-family candidates aligned against Kleborate's CARD 3.2.9 snapshot. High-confidence and partial candidates are separated. The displayed allele is explicitly the closest reference allele, not a confirmed allele assignment.
- **Virulence evidence:** gene completeness for `ybt`, `iuc`, `iro`, `clb` and `rmp`, plus a Kleborate-style virulence score from 0 to 5.
- **Relatedness screen:** pairwise MinHash distances for uploaded assemblies. Close pairs require confirmation with a validated SNP or cgMLST workflow and epidemiological data.

The site does not infer phenotypic susceptibility from gene absence, predict patient disease severity, replace culture or validated whole-genome species confirmation, or prove direct transmission. These abstentions are part of the report rather than missing features.

The methods, thresholds and validation record are documented in [`docs/GENOME_WORKBENCH_METHODS.md`](docs/GENOME_WORKBENCH_METHODS.md) and [`docs/validation.json`](docs/validation.json).

## Exact sequence-retention audit

Select an original assembly, its selected contigs and a marker FASTA. Marker headers may include pipe-delimited annotations such as:

```fasta
>blaKPC-2|category=resistance|trait=carbapenem|database=AMRFinderPlus|accession=WP_000000001
ACGT...
>phoE_6|category=mlst|locus=phoE|allele=6|database=PubMLST
ACGT...
```

The audit checks exact matches on both strands, copy counts, 1-based inclusive coordinates and whether selected contigs are an exact sequence subset of the original assembly. Category and trait fields come from the uploaded header and are not independently verified. The **Try an example** button uses invented sequences solely to demonstrate reporting behavior.

## Privacy

Analysis runs in browser memory and the application has no analysis backend, account system or analytics. The workbench downloads pinned reference data and the minimap2 WebAssembly runtime, but does not send the uploaded assembly, filename, sequence or result in those requests. Ordinary GitHub Pages access logs are separate from analysis. A report is written to disk only when the user requests a download.

## Reproducibility and versions

- Application: `0.3.0-alpha.2`
- Browser alignment engine: minimap2 2.22 through Aioli/BioWasm
- Reference source: Kleborate commit `550ce22a2c01c76064f4dabf403704ee2293356e`
- AMR reference snapshot: CARD 3.2.9 as bundled by that Kleborate commit
- Species panel: canonical 15-mer, bottom-2000 MinHash sketches generated from ten pinned Kleborate test references

The workbench is an alpha research implementation. On public assembly ERR10921830, browser results agreed with official Kleborate for assembly size, contig count, N50, _K. pneumoniae_ assignment, ST147, 12 high-confidence AMR-family loci after non-redundancy/partial-hit handling, and virulence score 0. Exact AMR allele labels can differ because the website reports the closest nucleotide reference and does not reproduce Kleborate's protein-level mutation and truncation logic. QRDR, porin and colistin-resistance mutation calling are not implemented in this alpha release.

The earlier retention core retains computational parity with the bundled Python reference across 107 study datasets and 733 marker transitions. This checks calculation agreement, not biological or clinical validity.

## Local development

Node 22.13 or newer:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

Static output is written to `dist/client`. `public/genome-core.mjs` contains the integrated analysis helpers, while `public/audit-core.mjs` contains the exact-retention calculation. No API key or server is required.

## Deployment and citation

The manual GitHub Pages workflow is `.github/workflows/pages.yml`. The source is public at <https://github.com/al-mualm/genome-evidence-audit>. No patient metadata, study assemblies or raw reads are included.

Genome Evidence Audit contributors. Genome Evidence Audit browser edition. Version 0.3.0-alpha.2. 2026. <https://github.com/al-mualm/genome-evidence-audit/releases/tag/v0.3.0-alpha.2>

Project-authored code is available under the MIT License. Kleborate reference data and third-party software retain their original licenses and citation requirements.
