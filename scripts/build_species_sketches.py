#!/usr/bin/env python3
"""Build the small browser species-reference panel used by the web app.

The input genomes are the Kleborate v3 species-module test references.  The
output contains only deterministic bottom-k sketches and provenance, never the
reference genome sequence.
"""

from __future__ import annotations

import argparse
import gzip
import heapq
import json
from pathlib import Path


REFERENCES = {
    "GCF_000247855.1": "Klebsiella oxytoca",
    "GCF_000016305.1": "Klebsiella pneumoniae",
    "GCF_000492415.1": "Klebsiella quasipneumoniae subsp. quasipneumoniae",
    "GCF_000492795.1": "Klebsiella quasipneumoniae subsp. similipneumoniae",
    "GCF_000523395.1": "Klebsiella quasivariicola",
    "GCF_000019565.1": "Klebsiella variicola subsp. variicola",
    "GCF_002806645.1": "Klebsiella variicola subsp. tropica",
    "GCF_016804125.1": "Klebsiella africana",
    "GCF_004010735.1": "Salmonella enterica group",
    "GCF_003937345.1": "Citrobacter freundii group",
}


def sequences(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    seq = []
    with opener(path, "rt") as handle:
        for line in handle:
            if line.startswith(">"):
                if seq:
                    yield "".join(seq).upper()
                    seq = []
            else:
                seq.append(line.strip())
    if seq:
        yield "".join(seq).upper()


def mix32(value: int) -> int:
    value &= 0xFFFFFFFF
    value ^= value >> 16
    value = (value * 0x7FEB352D) & 0xFFFFFFFF
    value ^= value >> 15
    value = (value * 0x846CA68B) & 0xFFFFFFFF
    value ^= value >> 16
    return value & 0xFFFFFFFF


def sketch(records, k: int = 15, size: int = 2000):
    mask = (1 << (2 * k)) - 1
    reverse_shift = 2 * (k - 1)
    values = set()
    heap = []
    for sequence in records:
        forward = reverse = valid = 0
        for char in sequence:
            base = "ACGT".find(char)
            if base < 0:
                forward = reverse = valid = 0
                continue
            forward = ((forward << 2) | base) & mask
            reverse = (reverse >> 2) | ((3 - base) << reverse_shift)
            valid += 1
            if valid >= k:
                value = mix32(min(forward, reverse))
                if value in values:
                    continue
                if len(heap) < size:
                    heapq.heappush(heap, -value)
                    values.add(value)
                elif value < -heap[0]:
                    values.remove(-heapq.heapreplace(heap, -value))
                    values.add(value)
    return sorted(values)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    panel = []
    for accession, species in REFERENCES.items():
        path = args.source / f"{accession}.fna.gz"
        if not path.exists():
            raise FileNotFoundError(path)
        hashes = sketch(sequences(path))
        panel.append({"accession": accession, "species": species, "hashes": hashes})
    payload = {
        "schema": "genome-evidence-audit-species-sketch-v1",
        "method": "canonical-15-mer bottom-2000 MinHash using mix32",
        "k": 15,
        "sketch_size": 2000,
        "source": "Kleborate v3 species-module test reference genomes",
        "source_repository": "https://github.com/klebgenomics/Kleborate",
        "source_commit": args.commit,
        "scope": "Klebsiella-focused reference screen with three Enterobacterales outgroups",
        "references": panel,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
