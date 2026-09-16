# Genome Evidence Audit browser edition v0.1.0

Public release of the browser interface and direct exact-sequence-retention calculation core.

- Input: original assembly, selected assembly and exact marker sequences, all in uncompressed FASTA.
- Processing: local browser Web Worker; files are not transmitted to an analysis server.
- Output: retention states, exact hit counts, 1-based inclusive coordinates, parent-subset check, CSV and JSON with SHA-256 input fingerprints.
- Reference: Python evidence_stability.py v0.2.0 included under reference/.
- Verification: 16 engineering tests passed. Browser core agreed with Python audit() on 107 study datasets and 733 marker transitions, including every recorded hit coordinate and strand. Aggregate evidence: docs/validation.json. Empty marker sets from the study archive were compared through the core API; the web file form requires nonempty markers.
- Scope: excludes raw-read assembly, automated marker discovery, reference-context alignment, threshold sweeps and population calibration. Engineering agreement does not measure diagnostic accuracy or usability.
- Public repository contains invented example sequences only; no patient data or real study sequences.

Website: https://genome-evidence-audit.almualm.chatgpt.site
Repository: https://github.com/al-mualm/genome-evidence-audit
