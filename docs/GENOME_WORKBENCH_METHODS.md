# Integrated genome workbench: methods and interpretation

## Scope

The workbench accepts assembled bacterial genomes in FASTA format. It is designed as a rapid, local, reproducible screening layer for _Klebsiella_ research. Raw-read QC, read mapping, assembly and contamination deconvolution remain upstream requirements.

## Execution and provenance

Genome files are read in a Web Worker and aligned in the browser with minimap2 2.22 compiled to WebAssembly and loaded through Aioli/BioWasm. Reference files are fetched directly from Kleborate commit `550ce22a2c01c76064f4dabf403704ee2293356e`. Every exported report records the application version, minimap2 version, Kleborate commit, CARD snapshot and a SHA-256 fingerprint of each input assembly.

## Assembly QC

The program calculates total assembled bases, contig count, N50 and ambiguous bases. It warns when total size is outside 4–7 Mb, the assembly contains more than 500 contigs, N50 is below 20 kb or more than 1% of positions are ambiguous. These are screening thresholds and do not replace read-level QC or contamination analysis.

## Species reference screen

Each assembly is converted to a strand-invariant sketch of the 2,000 smallest deterministic hashes from canonical 15-mers. The same method was applied to ten pinned Kleborate test reference genomes. Mash-style distance is calculated from sketch similarity. A best distance of at most 0.02 is called strong, 0.02–0.04 weak and above 0.04 unassigned. A margin smaller than 0.001 over the runner-up is labelled ambiguous. Because the panel is deliberately small, the result is a reference-panel assignment and not definitive taxonomic confirmation.

## Seven-locus MLST

Alleles for `gapA`, `infB`, `mdh`, `pgi`, `phoE`, `rpoB` and `tonB` are aligned to the assembly with minimap2 `asm5`, secondary alignments disabled, minimum 90% nucleotide identity and 80% query coverage. A sequence type is reported only when all seven allele identifiers are present and their combination exactly matches the pinned Kleborate profile table. A complete unmatched combination is reported as a novel profile; missing loci produce a partial call.

## AMR-family evidence

The CARD 3.2.9 nucleotide sequences bundled with the pinned Kleborate commit are aligned with the same minimap2 preset and 90% identity/80% query-coverage screening thresholds. Alternative alleles from one Kleborate cluster are collapsed, and candidates that overlap at least 80% of the shorter target interval are reduced to the best-scoring candidate so one genomic locus is not counted repeatedly. Candidates with at least 90% query coverage are placed in the high-confidence list; candidates with 80–90% coverage are retained separately as partial hits. The output uses Kleborate cluster metadata to report gene family, AMR class, CARD drug class and ARO class. The nucleotide allele name is labelled as the closest reference rather than a confirmed allele.

This alpha algorithm does not reproduce Kleborate's translated-protein exact-match correction, truncation logic, SHV mutation interpretation, QRDR mutation calling, porin changes or colistin-resistance mutation analysis. It therefore supports gene-family screening and candidate prioritisation, not a complete AMR genotype or a clinical susceptibility report. A missing determinant never produces a susceptible call.

## Virulence loci

The workbench screens the genes of `ybt`, `iuc`, `iro`, `clb` and `rmp` at 90% identity and 80% query coverage. A locus is marked present when at least 80% of its expected genes are detected. The score follows the Kleborate hierarchy used by the browser implementation: 0 for neither `ybt`, `iuc` nor `clb`; 1 for `ybt`; 2 for `clb`; 3 for `iuc`; 4 for `iuc` plus `ybt`; and 5 for `iuc` plus `clb`. The output describes genomic virulence potential and does not predict patient severity.

## Pairwise relatedness

For batches, the program calculates Mash-style distances from the species sketches. Pairs at or below the prespecified screening threshold of 0.001 are labelled close for follow-up. The threshold is a triage rule, not an outbreak cutoff. Direct transmission, its direction and exclusion of transmission require a validated core-genome method, recombination handling, sampling dates, locations and epidemiological investigation.

## Validation status

Unit tests cover deterministic and strand-invariant sketches, reference assignment, complete MLST, AMR non-redundancy, partial-hit separation, virulence scoring and pairwise reporting. A browser end-to-end run on public assembly ERR10921830 was compared with official Kleborate at the pinned source commit. Both reported 5,677,976 bp, 196 contigs, N50 160,135, _K. pneumoniae_, ST147, 12 non-redundant high-confidence AMR-family loci and virulence score 0. The comparison does not establish sensitivity or specificity across diverse lineages. Independent validation on curated positive and negative collections is required before clinical or surveillance use.

## Publication exports

After analysis, the browser creates a sample-by-feature evidence matrix. The matrix separates high-confidence and partial AMR-family evidence and complete and incomplete virulence loci, while displaying species, MLST and virulence score as annotation rows. The figure can be downloaded as editable SVG or as a three-times-resolution PNG. A matching CSV preserves the plotted values and additional QC fields, and a plain-text caption records the interpretation boundaries. Researchers can replace filenames with short, de-identified figure labels before analysis. The source filename remains in the JSON and CSV audit records but is not used as the figure label.
