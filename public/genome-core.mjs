/** Browser-side Klebsiella assembly interpretation helpers. */
export const GENOME_VERSION = '0.3.0-alpha.2';
export const MLST_GENES = [
  'gapA',
  'infB',
  'mdh',
  'pgi',
  'phoE',
  'rpoB',
  'tonB',
];
export const VIRULENCE_GENES = {
  ybt: [
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
  ],
  iuc: ['iucA', 'iucB', 'iucC', 'iucD', 'iutA'],
  iro: ['iroB', 'iroC', 'iroD', 'iroN'],
  clb: [
    'clbA',
    'clbB',
    'clbC',
    'clbD',
    'clbE',
    'clbF',
    'clbG',
    'clbH',
    'clbI',
    'clbL',
    'clbM',
    'clbN',
    'clbO',
    'clbP',
    'clbQ',
  ],
  rmp: ['rmpA', 'rmpC', 'rmpD', 'rmpA2'],
};

export function parseFasta(text) {
  const records = [];
  let name = '';
  let sequence = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('>')) {
      if (name) records.push({ name, sequence });
      name = line.slice(1).trim().split(/\s+/)[0];
      sequence = '';
    } else {
      if (!name) throw new Error('FASTA sequence encountered before a header.');
      const clean = line.toUpperCase();
      if (!/^[ACGTNRYKMSWBDHV.-]+$/.test(clean))
        throw new Error(`Invalid FASTA characters in ${name}.`);
      sequence += clean.replace(/[.-]/g, 'N');
    }
  }
  if (name) records.push({ name, sequence });
  if (!records.length || records.some((r) => !r.sequence))
    throw new Error('The FASTA contains no usable sequences.');
  return records;
}

export function assemblyStats(records) {
  const lengths = records.map((r) => r.sequence.length).sort((a, b) => b - a);
  const totalBp = lengths.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  let n50 = 0;
  for (const length of lengths) {
    cumulative += length;
    if (cumulative >= totalBp / 2) {
      n50 = length;
      break;
    }
  }
  const ambiguousBp = records.reduce(
    (n, r) => n + (r.sequence.match(/[^ACGT]/g)?.length || 0),
    0,
  );
  const warnings = [];
  if (totalBp < 4_000_000 || totalBp > 7_000_000)
    warnings.push('assembly length outside the 4–7 Mb screening range');
  if (records.length > 500) warnings.push('more than 500 contigs');
  if (n50 < 20_000) warnings.push('N50 below 20 kb');
  if (ambiguousBp / totalBp > 0.01)
    warnings.push('more than 1% ambiguous bases');
  return {
    contigs: records.length,
    total_bp: totalBp,
    n50,
    ambiguous_bp: ambiguousBp,
    warnings,
  };
}

function mix32(value) {
  value >>>= 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function heapUp(heap, index) {
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (heap[parent] >= heap[index]) break;
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function heapDown(heap, index) {
  for (;;) {
    const left = index * 2 + 1;
    if (left >= heap.length) break;
    const right = left + 1;
    const child =
      right < heap.length && heap[right] > heap[left] ? right : left;
    if (heap[index] >= heap[child]) break;
    [heap[index], heap[child]] = [heap[child], heap[index]];
    index = child;
  }
}

export function sketchRecords(records, k = 15, size = 2000) {
  const mask = (2 ** (2 * k) - 1) >>> 0;
  const shift = 2 * (k - 1);
  const heap = [];
  const selected = new Set();
  const code = { A: 0, C: 1, G: 2, T: 3 };
  for (const record of records) {
    let forward = 0;
    let reverse = 0;
    let valid = 0;
    for (const char of record.sequence) {
      const base = code[char];
      if (base === undefined) {
        forward = reverse = valid = 0;
        continue;
      }
      forward = ((forward << 2) | base) & mask;
      reverse = (reverse >>> 2) | ((3 - base) << shift);
      valid += 1;
      if (valid < k) continue;
      const value = mix32(Math.min(forward >>> 0, reverse >>> 0));
      if (selected.has(value)) continue;
      if (heap.length < size) {
        heap.push(value);
        selected.add(value);
        heapUp(heap, heap.length - 1);
      } else if (value < heap[0]) {
        selected.delete(heap[0]);
        heap[0] = value;
        selected.add(value);
        heapDown(heap, 0);
      }
    }
  }
  return [...selected].sort((a, b) => a - b);
}

export function sketchDistance(a, b, k = 15) {
  let i = 0;
  let j = 0;
  let shared = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      shared += 1;
      i += 1;
      j += 1;
    } else if (a[i] < b[j]) i += 1;
    else j += 1;
  }
  const denominator = Math.min(a.length, b.length);
  const jaccard = denominator ? shared / denominator : 0;
  const distance =
    jaccard > 0 ? Math.max(0, -Math.log((2 * jaccard) / (1 + jaccard)) / k) : 1;
  return { shared, jaccard, distance };
}

export function assignSpecies(sketch, panel) {
  const ranked = panel.references
    .map((reference) => ({
      ...reference,
      ...sketchDistance(sketch, reference.hashes, panel.k),
    }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  const runnerUp = ranked[1];
  const gap = runnerUp ? runnerUp.distance - best.distance : 0;
  let confidence =
    best.distance <= 0.02
      ? 'strong'
      : best.distance <= 0.04
        ? 'weak'
        : 'unassigned';
  if (confidence !== 'unassigned' && gap < 0.001) confidence = 'ambiguous';
  return {
    species: confidence === 'unassigned' ? 'Unassigned' : best.species,
    confidence,
    distance: best.distance,
    shared_hashes: best.shared,
    runner_up: runnerUp?.species || '',
    runner_up_distance: runnerUp?.distance ?? null,
    reference_accession: best.accession,
    panel_scope: panel.scope,
  };
}

export function parsePaf(text) {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const f = line.split('\t');
      if (f.length < 12) return null;
      const qlen = Number(f[1]);
      const qstart = Number(f[2]);
      const qend = Number(f[3]);
      const matches = Number(f[9]);
      const block = Number(f[10]);
      return {
        query: f[0],
        query_length: qlen,
        query_start: qstart,
        query_end: qend,
        strand: f[4],
        contig: f[5],
        target_start: Number(f[7]),
        target_end: Number(f[8]),
        identity: block ? (100 * matches) / block : 0,
        coverage: qlen ? (100 * (qend - qstart)) / qlen : 0,
        mapq: Number(f[11]),
      };
    })
    .filter(Boolean);
}

export function bestHits(
  alignments,
  minIdentity = 90,
  minCoverage = 80,
  nameParser = (x) => x,
) {
  const hits = new Map();
  for (const alignment of alignments) {
    if (alignment.identity < minIdentity || alignment.coverage < minCoverage)
      continue;
    const key = nameParser(alignment.query);
    const old = hits.get(key);
    const score = alignment.identity * alignment.coverage;
    if (!old || score > old.identity * old.coverage) hits.set(key, alignment);
  }
  return hits;
}

export function callMlst(alignments, profileText) {
  const hits = bestHits(alignments, 90, 80, (name) => name.split('_')[0]);
  const alleles = {};
  for (const gene of MLST_GENES) {
    const hit = hits.get(gene);
    alleles[gene] = hit ? hit.query.slice(gene.length + 1) : '';
  }
  const complete = MLST_GENES.every((gene) => /^\d+$/.test(alleles[gene]));
  let sequenceType = '';
  if (complete) {
    const rows = profileText
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('\t'));
    const header = rows.shift();
    const indexes = Object.fromEntries(header.map((name, i) => [name, i]));
    const row = rows.find((fields) =>
      MLST_GENES.every((gene) => fields[indexes[gene]] === alleles[gene]),
    );
    if (row) sequenceType = row[indexes.ST] || row[0];
  }
  return {
    status: sequenceType ? 'complete' : complete ? 'novel_profile' : 'partial',
    sequence_type: sequenceType || null,
    alleles,
    loci_found: MLST_GENES.filter((gene) => alleles[gene]).length,
  };
}

export function callVirulence(alignments) {
  const known = new Set(Object.values(VIRULENCE_GENES).flat());
  const hits = bestHits(alignments, 90, 80, (name) => name.split('_')[0]);
  const loci = {};
  for (const [locus, genes] of Object.entries(VIRULENCE_GENES)) {
    const found = genes.filter((gene) => known.has(gene) && hits.has(gene));
    loci[locus] = {
      found: found.length,
      expected: genes.length,
      genes: found,
      present: found.length >= Math.ceil(genes.length * 0.8),
    };
  }
  const ybt = loci.ybt.present;
  const iuc = loci.iuc.present;
  const clb = loci.clb.present;
  const score =
    clb && iuc ? 5 : iuc && ybt ? 4 : iuc ? 3 : clb ? 2 : ybt ? 1 : 0;
  return {
    score,
    loci,
    interpretation:
      'Genomic virulence potential; this is not a prediction of patient severity.',
  };
}

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else value += char;
  }
  fields.push(value);
  return fields;
}

export function parseAmrMetadata(text = '') {
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  if (!rows.length) return new Map();
  const header = rows.shift();
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  return new Map(
    rows.map((row) => [
      row[index.clusterid],
      {
        gene_family: row[index.gene],
        class: row[index.class],
        bla_class: row[index.bla_class],
        card_class: row[index.CARD_class],
        aro_class: row[index.ARO_class],
      },
    ]),
  );
}

function overlapFraction(a, b) {
  if (a.contig !== b.contig) return 0;
  const overlap = Math.max(
    0,
    Math.min(a.target_end, b.target_end) -
      Math.max(a.target_start, b.target_start),
  );
  const shortest = Math.min(
    a.target_end - a.target_start,
    b.target_end - b.target_start,
  );
  return shortest ? overlap / shortest : 0;
}

export function callAmr(alignments, metadataText = '') {
  // CARD_v3.2.9 FASTA headers begin with Kleborate's clustered-gene ID.
  // Collapse alternative alleles in the same cluster before reporting so one
  // genomic locus is not counted hundreds of times.
  const hits = [
    ...bestHits(alignments, 90, 80, (name) => name.split('__')[0]).values(),
  ].sort(
    (a, b) =>
      b.identity * b.coverage - a.identity * a.coverage ||
      b.coverage - a.coverage,
  );
  // Different CARD clusters can align to the same genomic locus. Retain the
  // best-supported candidate instead of counting one locus more than once.
  const nonRedundant = [];
  for (const hit of hits) {
    if (!nonRedundant.some((kept) => overlapFraction(hit, kept) >= 0.8))
      nonRedundant.push(hit);
  }
  const metadata = parseAmrMetadata(metadataText);
  const candidates = nonRedundant
    .map((hit) => {
      const parts = hit.query.split('__');
      const classField = parts[1] || '';
      const split = classField.lastIndexOf('_');
      const cluster = parts[0] || '';
      const row = metadata.get(cluster);
      const broadClass =
        row?.class || (split >= 0 ? classField.slice(split + 1) : classField);
      const classification =
        broadClass === 'Bla' && row?.bla_class && row.bla_class !== 'NA'
          ? row.bla_class
          : broadClass;
      return {
        cluster,
        gene_family:
          row?.gene_family ||
          (split >= 0 ? classField.slice(0, split) : classField),
        closest_reference_allele: parts[2] || hit.query,
        resistance_class: classification,
        card_drug_class: row?.card_class || '',
        aro_class: row?.aro_class || '',
        identity: hit.identity,
        coverage: hit.coverage,
        contig: hit.contig,
        target_start: hit.target_start,
        target_end: hit.target_end,
      };
    })
    .sort(
      (a, b) =>
        a.resistance_class.localeCompare(b.resistance_class) ||
        a.gene_family.localeCompare(b.gene_family),
    );
  const genes = candidates.filter((hit) => hit.coverage >= 90);
  const partialHits = candidates.filter((hit) => hit.coverage < 90);
  const resistantClasses = [
    ...new Set(genes.map((g) => g.resistance_class).filter(Boolean)),
  ];
  return {
    determinants: genes,
    partial_hits: partialHits,
    resistant_classes: resistantClasses,
    interpretation: genes.length
      ? 'High-confidence acquired or intrinsic resistance-family evidence detected; reported alleles are closest references, and phenotype requires validated rules and AST.'
      : 'No determinant met these thresholds; susceptibility is not inferred.',
  };
}

export function pairwiseRelatedness(samples, threshold = 0.001) {
  const pairs = [];
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const metrics = sketchDistance(samples[i].sketch, samples[j].sketch, 15);
      pairs.push({
        sample_a: samples[i].name,
        sample_b: samples[j].name,
        ...metrics,
        interpretation:
          metrics.distance <= threshold
            ? 'close at the selected genomic screening threshold'
            : 'not close at the selected genomic screening threshold',
      });
    }
  }
  return {
    threshold,
    pairs,
    limitation:
      'This screening comparison does not prove direct transmission or direction.',
  };
}
