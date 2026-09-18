import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assemblyStats,
  assignSpecies,
  callAmr,
  callMlst,
  callVirulence,
  pairwiseRelatedness,
  parseFasta,
  parsePaf,
  sketchRecords,
} from '../public/genome-core.mjs';

const paf = (query, qlen, matches, block, contig = 'ctg1') =>
  `${query}\t${qlen}\t0\t${qlen}\t+\t${contig}\t5000000\t10\t${10 + qlen}\t${matches}\t${block}\t60`;

test('assembly QC and sketches are deterministic and strand invariant', () => {
  const forward = parseFasta('>a\nACGTTGCAACGTTGCAACGTTGCA\n');
  const reverse = parseFasta('>b\nTGCAACGTTGCAACGTTGCAACGT\n');
  assert.deepEqual(sketchRecords(forward), sketchRecords(reverse));
  const stats = assemblyStats(forward);
  assert.equal(stats.total_bp, 24);
  assert.equal(stats.contigs, 1);
});

test('species assignment reports an exact panel sketch as strong', () => {
  const sketch = [1, 2, 3, 4];
  const result = assignSpecies(sketch, {
    k: 15,
    scope: 'test',
    references: [
      { species: 'Klebsiella pneumoniae', accession: 'A', hashes: sketch },
      {
        species: 'Klebsiella variicola',
        accession: 'B',
        hashes: [100, 101, 102, 103],
      },
    ],
  });
  assert.equal(result.species, 'Klebsiella pneumoniae');
  assert.equal(result.confidence, 'strong');
  assert.equal(result.distance, 0);
});

test('complete seven-locus MLST resolves a profile', () => {
  const genes = ['gapA', 'infB', 'mdh', 'pgi', 'phoE', 'rpoB', 'tonB'];
  const alignments = parsePaf(
    genes.map((gene, i) => paf(`${gene}_${i + 1}`, 450, 450, 450)).join('\n'),
  );
  const profiles = `ST\t${genes.join('\t')}\n29\t1\t2\t3\t4\t5\t6\t7\n`;
  const result = callMlst(alignments, profiles);
  assert.equal(result.status, 'complete');
  assert.equal(result.sequence_type, '29');
});

test('AMR and virulence calls keep genotype separate from phenotype', () => {
  const metadata = [
    'clusterid,queryID,class,gene,allele,seqID,accession,positions,size,cluster_contains_multiple_genes,gene_found_in_multiple_clusters,bla_description,bla_class,CARD_class,ARO_class',
    '1,KPC-2,Bla,KPC,blaKPC-2,1,ACC,-,-,no,no,carbapenemase,Bla_Carb,carbapenem,ARO:1',
  ].join('\n');
  const amr = callAmr(
    parsePaf(paf('1__KPC_Bla__blaKPC-2__1', 882, 882, 882)),
    metadata,
  );
  assert.equal(amr.determinants[0].gene_family, 'KPC');
  assert.equal(amr.determinants[0].closest_reference_allele, 'blaKPC-2');
  assert.equal(amr.determinants[0].resistance_class, 'Bla_Carb');
  assert.match(amr.interpretation, /phenotype requires/);
  const vir = callVirulence(
    parsePaf(
      [
        'ybtS',
        'ybtX',
        'ybtQ',
        'ybtP',
        'ybtA',
        'irp2',
        'irp1',
        'ybtU',
        'ybtT',
        'ybtE',
        'fyuA',
      ]
        .map((gene) => paf(`${gene}_1`, 500, 500, 500))
        .join('\n'),
    ),
  );
  assert.equal(vir.loci.ybt.present, true);
  assert.equal(vir.score, 1);
  assert.match(vir.interpretation, /not a prediction/);
});

test('AMR screening removes overlapping duplicate families and separates partial hits', () => {
  const rows = [
    paf('1__SHV_Bla__SHV-11__1', 860, 859, 860, 'same'),
    paf('2__AAK_Bla__AAK-1__2', 840, 810, 840, 'same'),
    `${'3__Sul_Sul__sul1__3'}\t840\t136\t840\t+\tother\t5000000\t20\t724\t703\t704\t60`,
  ];
  const result = callAmr(parsePaf(rows.join('\n')));
  assert.equal(result.determinants.length, 1);
  assert.equal(result.determinants[0].gene_family, 'SHV');
  assert.equal(result.partial_hits.length, 1);
  assert.equal(result.partial_hits[0].gene_family, 'Sul');
});

test('relatedness returns each pair and does not claim direct transmission', () => {
  const result = pairwiseRelatedness([
    { name: 'A', sketch: [1, 2, 3] },
    { name: 'B', sketch: [1, 2, 3] },
    { name: 'C', sketch: [90, 91, 92] },
  ]);
  assert.equal(result.pairs.length, 3);
  assert.match(result.limitation, /does not prove direct transmission/);
});
