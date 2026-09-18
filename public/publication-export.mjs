/** Publication-oriented exports for integrated Klebsiella results. */

const VIRULENCE_LOCI = ['ybt', 'iuc', 'iro', 'clb', 'rmp'];

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function csv(value) {
  const text = Array.isArray(value) ? value.join(';') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function shortSample(name, max = 18) {
  const clean = String(name).replace(/\.(fasta|fna|fa)(\.gz)?$/i, '');
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function resultsToCsv(results) {
  const headers = [
    'sample',
    'source_file',
    'sha256',
    'total_bp',
    'contigs',
    'n50',
    'ambiguous_bp',
    'qc_warnings',
    'species_assignment',
    'species_confidence',
    'species_distance',
    'mlst_status',
    'sequence_type',
    'mlst_alleles',
    'amr_high_confidence_count',
    'amr_gene_families',
    'amr_partial_count',
    'amr_partial_families',
    'amr_classes',
    'virulence_score',
    ...VIRULENCE_LOCI.map((locus) => `${locus}_genes_found`),
    ...VIRULENCE_LOCI.map((locus) => `${locus}_complete`),
  ];
  const rows = results.map((result) => [
    result.sample,
    result.source_file,
    result.sha256,
    result.qc.total_bp,
    result.qc.contigs,
    result.qc.n50,
    result.qc.ambiguous_bp,
    result.qc.warnings,
    result.species.species,
    result.species.confidence,
    result.species.distance,
    result.mlst.status,
    result.mlst.sequence_type || '',
    Object.entries(result.mlst.alleles)
      .map(([gene, allele]) => `${gene}:${allele || '-'}`)
      .join(';'),
    result.amr.determinants.length,
    result.amr.determinants.map((hit) => hit.gene_family),
    result.amr.partial_hits.length,
    result.amr.partial_hits.map((hit) => hit.gene_family),
    result.amr.resistant_classes,
    result.virulence.score,
    ...VIRULENCE_LOCI.map((locus) => result.virulence.loci[locus]?.found ?? 0),
    ...VIRULENCE_LOCI.map((locus) =>
      result.virulence.loci[locus]?.present ? 'yes' : 'no',
    ),
  ]);
  return [headers, ...rows].map((row) => row.map(csv).join(',')).join('\n');
}

export function figureCaption(results, version) {
  const sampleWord = results.length === 1 ? 'assembly' : 'assemblies';
  return `Genomic evidence profile for ${results.length} ${sampleWord}. Cells show high-confidence or partial AMR-family evidence and complete or incomplete virulence loci. Species and MLST are reference-based screening results. Absence of a detected determinant does not establish phenotypic susceptibility. Generated locally with Genome Evidence Audit ${version}.`;
}

export function buildEvidenceSvg(results, version) {
  if (!results.length) throw new Error('At least one result is required.');
  const amrFamilies = [
    ...new Set(
      results.flatMap((result) => [
        ...result.amr.determinants.map((hit) => hit.gene_family),
        ...result.amr.partial_hits.map((hit) => hit.gene_family),
      ]),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const columnWidth =
    results.length <= 4 ? 150 : results.length <= 8 ? 120 : 100;
  const left = 240;
  const top = 138;
  const rowHeight = 30;
  const metadataRows = 3;
  const amrRows = Math.max(1, amrFamilies.length);
  const groupGap = 34;
  const matrixRows = metadataRows + amrRows + VIRULENCE_LOCI.length;
  const width = Math.max(900, left + results.length * columnWidth + 70);
  const height = top + matrixRows * rowHeight + groupGap * 2 + 112;
  const xFor = (index) => left + index * columnWidth;
  let y = top;
  const elements = [];
  const text = (x, atY, content, attrs = '') =>
    `<text x="${x}" y="${atY}" ${attrs}>${xml(content)}</text>`;
  const cell = (x, atY, fill, label = '', title = '') =>
    `<g><title>${xml(title || label)}</title><rect x="${x + 2}" y="${atY + 2}" width="${columnWidth - 4}" height="${rowHeight - 4}" rx="3" fill="${fill}" stroke="#D7DDD5"/>${
      label
        ? text(
            x + columnWidth / 2,
            atY + 20,
            label,
            'text-anchor="middle" class="cell-text"',
          )
        : ''
    }</g>`;

  elements.push(
    `<rect width="100%" height="100%" fill="#FFFFFF"/>`,
    text(32, 38, 'Genomic evidence profile', 'class="title"'),
    text(
      32,
      62,
      `${results.length} ${results.length === 1 ? 'assembly' : 'assemblies'} · Genome Evidence Audit ${version}`,
      'class="subtitle"',
    ),
  );

  results.forEach((result, index) => {
    const x = xFor(index) + columnWidth / 2;
    elements.push(
      `<g><title>${xml(result.sample)}</title>${text(x, 105, shortSample(result.sample), 'text-anchor="middle" class="sample"')}</g>`,
    );
  });

  const metadata = [
    ['Species', (r) => shortSample(r.species.species, 19)],
    ['MLST', (r) => (r.mlst.sequence_type ? `ST${r.mlst.sequence_type}` : '—')],
    ['Virulence score', (r) => `${r.virulence.score}/5`],
  ];
  metadata.forEach(([label, getter]) => {
    elements.push(
      text(left - 12, y + 20, label, 'text-anchor="end" class="row-label"'),
    );
    results.forEach((result, index) => {
      const value = getter(result);
      elements.push(
        cell(xFor(index), y, '#EAF0E5', value, String(getter(result))),
      );
    });
    y += rowHeight;
  });

  y += groupGap;
  elements.push(text(32, y - 11, 'AMR FAMILY EVIDENCE', 'class="group-label"'));
  const amrRowsToDraw = amrFamilies.length
    ? amrFamilies
    : ['No AMR family detected'];
  amrRowsToDraw.forEach((family) => {
    elements.push(
      text(left - 12, y + 20, family, 'text-anchor="end" class="row-label"'),
    );
    results.forEach((result, index) => {
      const high = result.amr.determinants.some(
        (hit) => hit.gene_family === family,
      );
      const partial = result.amr.partial_hits.some(
        (hit) => hit.gene_family === family,
      );
      elements.push(
        cell(
          xFor(index),
          y,
          high ? '#B24A3A' : partial ? '#E7AE65' : '#F4F5F1',
          high ? '●' : partial ? '◐' : '',
          high
            ? 'High-confidence evidence'
            : partial
              ? 'Partial evidence'
              : 'Not detected',
        ),
      );
    });
    y += rowHeight;
  });

  y += groupGap;
  elements.push(
    text(32, y - 11, 'VIRULENCE LOCUS EVIDENCE', 'class="group-label"'),
  );
  VIRULENCE_LOCI.forEach((locus) => {
    elements.push(
      text(
        left - 12,
        y + 20,
        locus,
        'text-anchor="end" class="row-label italic"',
      ),
    );
    results.forEach((result, index) => {
      const value = result.virulence.loci[locus];
      const complete = Boolean(value?.present);
      const partial = Boolean(value?.found);
      elements.push(
        cell(
          xFor(index),
          y,
          complete ? '#2C7A68' : partial ? '#9BC9BE' : '#F4F5F1',
          complete ? '●' : partial ? '◐' : '',
          complete
            ? `Complete: ${value.found}/${value.expected} genes`
            : partial
              ? `Incomplete: ${value.found}/${value.expected} genes`
              : 'Not detected',
        ),
      );
    });
    y += rowHeight;
  });

  const legendY = height - 62;
  const legend = [
    ['#B24A3A', 'AMR high confidence'],
    ['#E7AE65', 'AMR partial'],
    ['#2C7A68', 'Virulence locus complete'],
    ['#9BC9BE', 'Virulence locus incomplete'],
    ['#F4F5F1', 'Not detected'],
  ];
  let legendX = 32;
  legend.forEach(([colour, label]) => {
    elements.push(
      `<rect x="${legendX}" y="${legendY}" width="14" height="14" rx="2" fill="${colour}" stroke="#C9D0C7"/>`,
      text(legendX + 20, legendY + 12, label, 'class="legend"'),
    );
    legendX += 44 + label.length * 6.2;
  });
  elements.push(
    text(
      32,
      height - 20,
      'Screening evidence only; absence does not establish susceptibility and genomic proximity does not prove transmission.',
      'class="footnote"',
    ),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">Genomic evidence profile</title><desc id="desc">Publication-ready matrix of typing, AMR-family and virulence-locus evidence.</desc><style>
    text{font-family:Arial,Helvetica,sans-serif;fill:#18362D}.title{font-size:25px;font-weight:700}.subtitle{font-size:13px;fill:#5E6E65}.sample{font-size:12px;font-weight:700}.row-label{font-size:12px}.italic{font-style:italic}.cell-text{font-size:11px;font-weight:700;fill:#17362D}.group-label{font-size:11px;font-weight:700;letter-spacing:1.2px;fill:#6B776F}.legend{font-size:11px}.footnote{font-size:10px;fill:#69766E}
  </style>${elements.join('')}</svg>`;
}
