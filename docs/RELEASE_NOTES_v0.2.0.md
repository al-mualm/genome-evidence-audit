# Genome Evidence Audit v0.2.0

This release adds optional, structured annotations for exact genomic marker evidence.

- Marker FASTA headers can classify evidence as resistance, virulence, MLST, species, or other.
- Results summarize exact detections and losses by evidence category.
- CSV and JSON exports retain the marker label, trait, locus, allele, database, and accession supplied by the researcher.
- Each result states the interpretation boundary between exact sequence evidence and phenotype, species, sequence-type, or transmission conclusions.
- The demonstration uses invented annotated markers and remains unsuitable for biological interpretation.

The matching and subset calculations are unchanged. This release does not add a curated marker database, automatic gene calling, antimicrobial susceptibility prediction, species confirmation, or transmission inference.
