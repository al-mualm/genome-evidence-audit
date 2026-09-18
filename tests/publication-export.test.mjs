import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEvidenceSvg,
  figureCaption,
  resultsToCsv,
} from '../public/publication-export.mjs';

const result = {
  sample: 'sample-A.fasta',
  source_file: 'original-file.fasta',
  sha256: 'abc',
  qc: {
    total_bp: 5500000,
    contigs: 100,
    n50: 100000,
    ambiguous_bp: 0,
    warnings: [],
  },
  species: {
    species: 'Klebsiella pneumoniae',
    confidence: 'strong',
    distance: 0.01,
  },
  mlst: { status: 'complete', sequence_type: '147', alleles: { gapA: '3' } },
  amr: {
    determinants: [{ gene_family: 'NDM', resistance_class: 'Bla_Carb' }],
    partial_hits: [{ gene_family: 'Sul', resistance_class: 'Sul' }],
    resistant_classes: ['Bla_Carb'],
  },
  virulence: {
    score: 1,
    loci: {
      ybt: { found: 11, expected: 11, genes: [], present: true },
      iuc: { found: 1, expected: 5, genes: [], present: false },
      iro: { found: 0, expected: 4, genes: [], present: false },
      clb: { found: 0, expected: 15, genes: [], present: false },
      rmp: { found: 0, expected: 4, genes: [], present: false },
    },
  },
};

test('publication SVG contains escaped labels, evidence and a legend', () => {
  const svg = buildEvidenceSvg([{ ...result, sample: 'A&B.fasta' }], 'test');
  assert.match(svg, /^<svg/);
  assert.match(svg, /A&amp;B/);
  assert.match(svg, /NDM/);
  assert.match(svg, /Virulence locus complete/);
  assert.doesNotMatch(svg, /A&B/);
});

test('summary CSV contains reproducible sample-level fields', () => {
  const output = resultsToCsv([result]);
  assert.match(output, /"sequence_type"/);
  assert.match(output, /"source_file"/);
  assert.match(output, /"147"/);
  assert.match(output, /"NDM"/);
  assert.match(output, /"yes"/);
});

test('figure caption states the main interpretation boundary', () => {
  assert.match(figureCaption([result], 'test'), /does not establish/);
});
