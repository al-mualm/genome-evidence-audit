import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFasta,
  audit,
  DEMO,
  reverseComplement,
  reportCsv,
  markerMetadata,
} from '../public/audit-core.mjs';
const run = (a, b, m) =>
  audit(
    parseFasta(a),
    parseFasta(b, { allowEmpty: true }),
    parseFasta(m, { markers: true }),
  );
test('invented example: retained, lost and not detected', () => {
  const r = run(DEMO.full, DEMO.selected, DEMO.markers);
  assert.equal(r.sequence_subset_consistent, true);
  assert.deepEqual(
    r.markers.map((x) => x.status),
    ['retained_exact', 'lost_during_selection', 'not_detected_in_either'],
  );
  assert.equal(r.summary.lost, 1);
});
test('renaming and reverse complement preserve subset', () => {
  const r = run('>old\nAACGTTAG\n', '>new\nCTAACGTT\n', '>m\nACGTTA\n');
  assert.equal(r.sequence_subset_consistent, true);
  assert.equal(r.markers[0].after_hits[0].strand, '-');
  assert.equal(r.markers[0].after_hits[0].start, 2);
  assert.equal(r.markers[0].after_hits[0].end, 7);
});
test('palindromic marker counted once per coordinate', () => {
  const r = run('>a\nATAT\n', '>a\nATAT\n', '>m\nATAT\n');
  assert.equal(r.markers[0].before_count, 1);
});
test('overlapping hits counted', () => {
  const r = run('>a\nAAAA\n', '', '>m\nAAA\n');
  assert.equal(r.markers[0].before_count, 2);
  assert.equal(r.markers[0].after_count, 0);
});
test('extra copies fail subset check', () => {
  const r = run('>a\nACGT\n', '>x\nACGT\n>y\nACGT\n', '>m\nACGT\n');
  assert.equal(r.sequence_subset_consistent, false);
  assert.deepEqual(r.selected_contigs_not_exact_parent_sequences, ['y']);
});
test('copy reduction is reported even when marker retained', () => {
  const r = run('>a\nACGT\n>b\nACGT\n', '>a\nACGT\n', '>m\nACGT\n');
  assert.equal(r.markers[0].status, 'retained_exact');
  assert.equal(r.markers[0].copy_count_decreased, true);
});
test('newly introduced marker is not called retained', () => {
  const r = run('>a\nAAAA\n', '>b\nCCCC\n', '>m\nCCCC\n');
  assert.equal(r.markers[0].status, 'introduced_after_selection');
  assert.equal(r.sequence_subset_consistent, false);
});
test('empty selected file is legitimate full removal', () => {
  const r = run('>a\nACGT\n', '', '>m\nACGT\n');
  assert.equal(r.summary.selected_contigs, 0);
  assert.equal(r.summary.lost, 1);
});
test('malformed and duplicate input fail deliberately', () => {
  for (const text of [
    'ACGT',
    '>a\n',
    '>a\nACGT\n>a\nAAAA',
    '>\nACGT',
    '@a\nACGT\n+\nIIII',
  ])
    assert.throws(() => parseFasta(text));
});
test('ambiguous markers and non-DNA input rejected', () => {
  assert.throws(() => parseFasta('>m\nACGN', { markers: true }));
  assert.throws(() => parseFasta('>a\nZZZZ'));
  assert.equal(parseFasta('>a\nacgtn').get('a'), 'ACGTN');
});
test('Windows newlines, BOM and descriptions supported', () =>
  assert.equal(
    parseFasta('\uFEFF>a description\r\nACGT\r\n').get('a'),
    'ACGT',
  ));
test('CSV safely quotes malicious-looking identifiers', () => {
  const r = run('>a\nACGT\n', '>a\nACGT\n', '>=1+1\nACGT\n');
  const csv = reportCsv(r);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('a:1-4(+)'));
});
test('long reverse complement crosses chunk boundaries correctly', () => {
  const s = 'AACGTN'.repeat(5000);
  assert.equal(reverseComplement(reverseComplement(s)), s);
});
test('marker and occurrence limits protect browser memory', () => {
  assert.throws(() =>
    parseFasta(
      Array.from({ length: 65 }, (_, i) => `>m${i}\nACGT`).join('\n'),
      { markers: true },
    ),
  );
  assert.throws(() => run('>a\n' + 'A'.repeat(10002), '', '>m\nA'));
});
test('structured marker headers produce auditable evidence categories', () => {
  const meta = markerMetadata(
    'blaKPC-2|category=amr|trait=beta_lactam|database=AMRFinderPlus|accession=WP_000000001',
  );
  assert.deepEqual(meta, {
    label: 'blaKPC-2',
    category: 'resistance',
    trait: 'beta lactam',
    locus: '',
    allele: '',
    database: 'AMRFinderPlus',
    accession: 'WP_000000001',
  });
  const r = run(
    '>a\nACGT\n',
    '>a\nACGT\n',
    '>blaKPC-2|category=resistance|trait=carbapenem\nACGT\n',
  );
  assert.equal(r.markers[0].category, 'resistance');
  assert.equal(r.summary.by_category.resistance.detected_after, 1);
  assert.match(reportCsv(r), /"category"/);
});
