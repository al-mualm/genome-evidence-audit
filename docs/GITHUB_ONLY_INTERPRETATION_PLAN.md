# GitHub-only genome interpretation plan

## Objective

Extend Genome Evidence Audit from exact marker-retention reporting to reproducible *Klebsiella pneumoniae* genome interpretation while keeping GitHub Pages as the public interface and GitHub as the only hosting and automation platform.

The design separates four evidence levels so the report cannot silently turn a sequence match into a clinical conclusion:

1. **Sequence evidence:** exact or qualified genomic matches.
2. **Genotype interpretation:** species, MLST, AMR determinants, and virulence loci derived from versioned databases and explicit rules.
3. **Phenotype prediction:** drug-level predictions only for validated organism–drug rules, with an abstention when evidence is incomplete or conflicting.
4. **Epidemiological compatibility:** genomic relatedness combined with dates and locations. This can support compatible, incompatible, or inconclusive transmission; it cannot confirm direct transmission by itself.

## Architecture

### Local browser layer

GitHub Pages continues to serve a static application. Assembly files remain in browser memory. A Web Worker performs file validation, hashing, report rendering, and lightweight analyses.

- **Complete MLST:** search the seven scheme loci, assign an allele only when coverage, identity, orientation, and uniqueness criteria pass, then resolve an ST from a versioned profile table. Novel or partial alleles produce an abstention.
- **Species screening:** compare a genome sketch against a curated *Klebsiella* reference panel, then require minimum matched fraction and a sufficient gap between the best and second-best species. Ambiguous or low-quality genomes remain unassigned.
- **Evidence audit:** retain the existing before/after sequence audit so every automated call can be traced to its supporting sequence and checked for loss during processing.

### GitHub Actions analysis layer

Researchers who need the full database-backed workflow use a private fork or private repository. A pinned GitHub Actions workflow processes assembled FASTA files and produces a downloadable report artifact. Patient identifiers must not be included, and clinical genomes must not be committed to the public project repository.

The workflow should run:

- assembly quality checks;
- Kleborate for *Klebsiella* species-complex typing, MLST, AMR determinants, virulence loci, and K/O locus calls;
- AMRFinderPlus as an independent AMR determinant and mutation analysis;
- a reconciliation step that records agreement, disagreement, database versions, and abstentions;
- batch core-genome relatedness analysis only when multiple eligible genomes are supplied;
- report generation with tool versions, database releases, input SHA-256 values, thresholds, warnings, and output checksums.

The GitHub Pages application imports the resulting JSON locally and displays it without uploading it to the website.

### Database release process

A scheduled GitHub Action checks upstream releases, records licenses and source URLs, verifies checksums, runs benchmark genomes, and opens a pull request. Database updates are never applied silently. Each accepted database bundle receives a release tag and immutable manifest.

Curated Pasteur definitions must be used under the database provider's current access and redistribution policy. The project must not mirror restricted data merely because the software is public.

## Interpretation rules

### Antimicrobial resistance

Report detected genes, mutations, disruptions, coverage, identity, tool agreement, and the rule used. A drug-level resistant prediction is allowed only when a versioned validated rule supports it. “No determinant detected” must not be rewritten as “susceptible.” Phenotypic AST remains a separate measurement.

### Virulence

Report named loci, allele/lineage calls, completeness, and an established genomic score when available. Use “virulence-associated genotype” rather than predicting patient severity or clinical outcome.

### Species identity

Report the best-supported reference taxon, matched fraction, distance, runner-up, assembly quality, and decision threshold. Return “ambiguous” or “outside reference panel” when the evidence does not support a unique assignment.

### Complete sequence type

Assign an ST only when all required loci have acceptable, unique allele calls and the allele combination exists in the pinned profile database. Report novel profiles and partial types without inventing an ST.

### Transmission

Require multiple quality-controlled genomes. Report core-genome distance, callable-core proportion, recombination handling, collection interval, hospital/ward compatibility, and the prespecified interpretation rule. The highest permissible conclusion is genomic and epidemiological compatibility with recent transmission; direction and direct person-to-person transfer require additional evidence.

## Validation before manuscript claims

- Freeze an external benchmark set before implementation.
- Compare every module against the corresponding established command-line tool.
- Measure call agreement, error types, abstention frequency, and runtime.
- For AMR phenotype prediction, use isolates with linked AST and report sensitivity, specificity, predictive values, confidence intervals, and class balance by drug.
- For species and MLST, use independently curated reference labels.
- For transmission screening, use published outbreak and non-outbreak collections and preserve study-level separation during evaluation.
- Publish benchmark inputs when licensing and consent allow, expected outputs, manifests, and exact reproduction commands.

This plan can be implemented entirely with GitHub Pages, GitHub Releases, a public source repository, and optional GitHub Actions in researcher-controlled private repositories. It does not require a permanent analysis server.
