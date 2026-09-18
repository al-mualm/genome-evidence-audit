'use client';

import { useMemo, useRef, useState } from 'react';
import type Aioli from '@biowasm/aioli';
import {
  Activity,
  Download,
  Dna,
  FileArchive,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GENOME_VERSION,
  MLST_GENES,
  VIRULENCE_GENES,
  assignSpecies,
  callAmr,
  callMlst,
  callVirulence,
  pairwiseRelatedness,
  parsePaf,
} from '../public/genome-core.mjs';

const KLEBORATE_COMMIT = '550ce22a2c01c76064f4dabf403704ee2293356e';
const RAW = `https://raw.githubusercontent.com/klebgenomics/Kleborate/${KLEBORATE_COMMIT}/kleborate/modules`;
const MLST_BASE = `${RAW}/klebsiella_pneumo_complex__mlst/data`;
const AMR_BASE = `${RAW}/klebsiella_pneumo_complex__amr/data`;
const VIRULENCE_MODULES: Record<string, string> = {
  ybt: 'klebsiella__ybst',
  iuc: 'klebsiella__abst',
  iro: 'klebsiella__smst',
  clb: 'klebsiella__cbst',
  rmp: 'klebsiella__rmst',
};

type Result = {
  sample: string;
  sha256: string;
  qc: {
    contigs: number;
    total_bp: number;
    n50: number;
    ambiguous_bp: number;
    warnings: string[];
  };
  sketch: number[];
  species: Record<string, unknown>;
  mlst: {
    status: string;
    sequence_type: string | null;
    alleles: Record<string, string>;
    loci_found: number;
  };
  amr: {
    determinants: Array<{
      gene_family: string;
      closest_reference_allele: string;
      resistance_class: string;
      card_drug_class: string;
      identity: number;
      coverage: number;
      contig: string;
    }>;
    partial_hits: Array<{
      gene_family: string;
      closest_reference_allele: string;
      resistance_class: string;
      identity: number;
      coverage: number;
      contig: string;
    }>;
    resistant_classes: string[];
    interpretation: string;
  };
  virulence: {
    score: number;
    loci: Record<
      string,
      { found: number; expected: number; genes: string[]; present: boolean }
    >;
    interpretation: string;
  };
};

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Reference database request failed (${response.status}).`);
  return response.text();
}

async function combineFastas(urls: string[]) {
  const parts = await Promise.all(urls.map(fetchText));
  return parts.map((text) => `${text.trim()}\n`).join('');
}

async function analyseSketch(file: File) {
  const text = await file.text();
  return new Promise<{ stats: Result['qc']; sketch: number[] }>(
    (resolve, reject) => {
      const worker = new Worker(
        new URL('./genome-worker.mjs', window.location.href),
        { type: 'module' },
      );
      worker.onmessage = ({ data }) => {
        worker.terminate();
        if (data.ok) resolve({ stats: data.stats, sketch: data.sketch });
        else reject(new Error(data.error));
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error('The browser genome worker failed.'));
      };
      worker.postMessage({ id: file.name, text });
    },
  );
}

export default function GenomeWorkbench() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [relatedness, setRelatedness] = useState<Record<
    string,
    unknown
  > | null>(null);
  const cliRef = useRef<Aioli | null>(null);
  const totalBp = useMemo(
    () => results.reduce((n, r) => n + r.qc.total_bp, 0),
    [results],
  );

  const run = async () => {
    if (!files.length) return;
    setBusy(true);
    setError('');
    setResults([]);
    setRelatedness(null);
    try {
      if (files.length > 12)
        throw new Error('Select no more than 12 assemblies per browser run.');
      if (files.some((file) => file.size > 30 * 1024 * 1024))
        throw new Error('Each uncompressed FASTA must be 30 MiB or smaller.');
      setProgress('Loading pinned reference databases…');
      const virulenceUrls = Object.entries(VIRULENCE_GENES).flatMap(
        ([locus, genes]) =>
          genes
            .filter((gene) => gene !== 'rmpA2')
            .map(
              (gene) => `${RAW}/${VIRULENCE_MODULES[locus]}/data/${gene}.fasta`,
            ),
      );
      virulenceUrls.push(`${RAW}/klebsiella__rmpa2/data/rmpA2.fasta`);
      const [
        mlstFasta,
        profiles,
        virulenceFasta,
        amrFasta,
        amrMetadata,
        speciesPanel,
      ] = await Promise.all([
        combineFastas(MLST_GENES.map((gene) => `${MLST_BASE}/${gene}.fasta`)),
        fetchText(`${MLST_BASE}/profiles.tsv`),
        combineFastas(virulenceUrls),
        fetchText(`${AMR_BASE}/CARD_v3.2.9.fasta`),
        fetchText(`${AMR_BASE}/CARD_AMR_clustered.csv`),
        fetch(
          new URL('./db/species-sketches-v1.json', window.location.href),
        ).then((r) => {
          if (!r.ok) throw new Error('Species panel could not be loaded.');
          return r.json();
        }),
      ]);
      setProgress('Starting minimap2 WebAssembly…');
      if (!cliRef.current) {
        const { default: Aioli } = await import('@biowasm/aioli');
        // Aioli's constructor is thenable in the browser build even though its
        // TypeScript declaration presents a synchronous class instance.
        cliRef.current = await Promise.resolve(
          new Aioli(['minimap2/2.22'], { printInterleaved: false }),
        );
      }
      const cli = cliRef.current;
      const databasePaths = await cli.mount([
        { name: 'gea_mlst.fasta', data: mlstFasta },
        { name: 'gea_virulence.fasta', data: virulenceFasta },
        { name: 'gea_amr.fasta', data: amrFasta },
      ]);
      const produced: Result[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`Analysing ${file.name} (${index + 1}/${files.length})…`);
        const [path] = await cli.mount([file]);
        const [{ stats, sketch }, digest] = await Promise.all([
          analyseSketch(file),
          sha256(file),
        ]);
        const paf = [];
        for (const databasePath of databasePaths) {
          const output = await cli.exec('minimap2', [
            '-x',
            'asm5',
            '-c',
            '--secondary=no',
            '-t',
            '1',
            path,
            databasePath,
          ]);
          paf.push(typeof output === 'string' ? output : output.stdout);
        }
        produced.push({
          sample: file.name,
          sha256: digest,
          qc: stats,
          sketch,
          species: assignSpecies(sketch, speciesPanel),
          mlst: callMlst(parsePaf(paf[0]), profiles) as Result['mlst'],
          virulence: callVirulence(parsePaf(paf[1])) as Result['virulence'],
          amr: callAmr(parsePaf(paf[2]), amrMetadata),
        });
      }
      setResults(produced);
      setRelatedness(
        pairwiseRelatedness(
          produced.map((r) => ({ name: r.sample, sketch: r.sketch })),
        ),
      );
      setProgress('Genome analysis complete.');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Genome analysis failed.',
      );
      setProgress('');
    } finally {
      setBusy(false);
    }
  };

  const report = results.length
    ? {
        schema: 'genome-evidence-audit-integrated-report-v1',
        version: GENOME_VERSION,
        created_at: new Date().toISOString(),
        engines: {
          minimap2: '2.22 WebAssembly',
          kleborate_reference_commit: KLEBORATE_COMMIT,
          card_snapshot: '3.2.9',
        },
        samples: results.map(({ sketch: _sketch, ...result }) => result),
        relatedness,
        interpretation_limits: {
          ast: 'Genomic determinants do not replace phenotypic antimicrobial susceptibility testing.',
          severity:
            'Patient disease severity is not inferred from genome sequence.',
          species:
            'Reference-panel assignment with abstention, not culture confirmation.',
          transmission:
            'Relatedness screening cannot confirm direct transmission or its direction.',
        },
      }
    : null;

  return (
    <section
      className="genome-workbench"
      aria-labelledby="genome-workbench-title"
    >
      <div className="workbench-heading">
        <div>
          <p className="eyebrow">
            INTEGRATED GENOME WORKBENCH · {GENOME_VERSION}
          </p>
          <h2 id="genome-workbench-title">One upload, six evidence views</h2>
          <p>
            Analyse assembled Klebsiella FASTA files locally for assembly
            quality, reference-panel species assignment, seven-locus MLST, AMR
            determinants, virulence loci and pairwise genomic relatedness.
          </p>
        </div>
        <div className="privacy-pill">
          <ShieldCheck size={18} /> Genome files stay in this browser
        </div>
      </div>
      <div className="workbench-input">
        <label className="assembly-drop">
          <FileArchive size={28} />
          <span>
            <b>Select assembled genome FASTA files</b>
            <small>1–12 files; uncompressed .fasta, .fa or .fna</small>
          </span>
          <input
            type="file"
            multiple
            accept=".fasta,.fa,.fna,text/plain"
            disabled={busy}
            onChange={(event) => setFiles([...(event.target.files || [])])}
          />
        </label>
        <div className="chosen-files">
          {files.length ? (
            files.map((file) => (
              <span key={`${file.name}-${file.size}`}>{file.name}</span>
            ))
          ) : (
            <span>No assemblies selected</span>
          )}
        </div>
        <div className="actions">
          <Button disabled={busy || !files.length} onClick={run}>
            {busy ? <LoaderCircle className="spin" /> : <Activity />}
            {busy ? 'Analysing genomes…' : 'Run integrated analysis'}
          </Button>
          {report && (
            <Button
              variant="outline"
              onClick={() =>
                downloadJson(report, 'integrated-klebsiella-report.json')
              }
            >
              <Download />
              Download full JSON
            </Button>
          )}
        </div>
        {(progress || error) && (
          <p className={error ? 'analysis-error' : 'analysis-progress'}>
            {error || progress}
          </p>
        )}
      </div>
      {results.length > 0 && (
        <div className="integrated-results">
          <div className="result-overview">
            <span>
              <b>{results.length}</b> assemblies
            </span>
            <span>
              <b>{totalBp.toLocaleString()}</b> bp analysed
            </span>
            <span>
              <b>
                {results.reduce((n, r) => n + r.amr.determinants.length, 0)}
              </b>{' '}
              AMR hits
            </span>
            <span>
              <b>
                {results.filter((r) => r.mlst.status === 'complete').length}
              </b>{' '}
              complete ST calls
            </span>
          </div>
          {results.map((result) => (
            <article className="genome-result" key={result.sha256}>
              <div className="genome-result-title">
                <Dna size={21} />
                <div>
                  <h3>{result.sample}</h3>
                  <small>SHA-256 {result.sha256.slice(0, 16)}…</small>
                </div>
              </div>
              <div className="evidence-grid">
                <div>
                  <b>Assembly QC</b>
                  <strong>{result.qc.total_bp.toLocaleString()} bp</strong>
                  <span>
                    {result.qc.contigs} contigs · N50{' '}
                    {result.qc.n50.toLocaleString()}
                  </span>
                  <small>
                    {result.qc.warnings.length
                      ? result.qc.warnings.join('; ')
                      : 'No screening warning'}
                  </small>
                </div>
                <div>
                  <b>Species screen</b>
                  <strong>{String(result.species.species)}</strong>
                  <span>
                    {String(result.species.confidence)} · distance{' '}
                    {Number(result.species.distance).toFixed(4)}
                  </span>
                  <small>Runner-up: {String(result.species.runner_up)}</small>
                </div>
                <div>
                  <b>Seven-locus MLST</b>
                  <strong>
                    {result.mlst.sequence_type
                      ? `ST${result.mlst.sequence_type}`
                      : result.mlst.status.replace('_', ' ')}
                  </strong>
                  <span>{result.mlst.loci_found}/7 loci called</span>
                  <small>
                    {Object.entries(result.mlst.alleles)
                      .map(([k, v]) => `${k}:${v || '—'}`)
                      .join(' · ')}
                  </small>
                </div>
                <div>
                  <b>AMR genotype</b>
                  <strong>{result.amr.determinants.length} determinants</strong>
                  <span>
                    {result.amr.resistant_classes.join(', ') ||
                      'No class-level call'}
                  </span>
                  <small>{result.amr.interpretation}</small>
                  <details>
                    <summary>View AMR evidence</summary>
                    <ul>
                      {result.amr.determinants.map((hit) => (
                        <li key={`${hit.contig}-${hit.gene_family}`}>
                          <b>{hit.gene_family}</b> ({hit.resistance_class}) ·
                          closest reference {hit.closest_reference_allele} ·{' '}
                          {hit.identity.toFixed(1)}% identity /{' '}
                          {hit.coverage.toFixed(1)}% coverage
                        </li>
                      ))}
                      {result.amr.partial_hits.map((hit) => (
                        <li key={`partial-${hit.contig}-${hit.gene_family}`}>
                          <b>{hit.gene_family}</b> · partial candidate ·{' '}
                          {hit.identity.toFixed(1)}% identity /{' '}
                          {hit.coverage.toFixed(1)}% coverage
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <div>
                  <b>Virulence genotype</b>
                  <strong>Score {result.virulence.score}/5</strong>
                  <span>
                    {Object.entries(result.virulence.loci)
                      .filter(([, v]) => v.present)
                      .map(([k]) => k)
                      .join(', ') || 'No complete screened locus'}
                  </span>
                  <small>{result.virulence.interpretation}</small>
                  <details>
                    <summary>View screened loci</summary>
                    <ul>
                      {Object.entries(result.virulence.loci).map(
                        ([locus, value]) => (
                          <li key={locus}>
                            <b>{locus}</b>: {value.found}/{value.expected} genes
                            {value.genes.length
                              ? ` (${value.genes.join(', ')})`
                              : ''}
                          </li>
                        ),
                      )}
                    </ul>
                  </details>
                </div>
                <div>
                  <b>Clinical interpretation</b>
                  <strong>Not inferred</strong>
                  <span>
                    AST and disease severity require laboratory and patient
                    data.
                  </span>
                  <small>The report preserves this abstention.</small>
                </div>
              </div>
            </article>
          ))}
          {relatedness && results.length > 1 && (
            <article className="relatedness-result">
              <h3>Pairwise relatedness screen</h3>
              <p>
                Distances at or below 0.001 are labelled close for screening.
                Dates, wards and epidemiological evidence are still required.
              </p>
              <div className="pair-list">
                {(relatedness.pairs as Array<Record<string, unknown>>).map(
                  (pair) => (
                    <span
                      key={`${String(pair.sample_a)}-${String(pair.sample_b)}`}
                    >
                      <b>
                        {String(pair.sample_a)} ↔ {String(pair.sample_b)}
                      </b>{' '}
                      distance {Number(pair.distance).toFixed(5)} ·{' '}
                      {String(pair.interpretation)}
                    </span>
                  ),
                )}
              </div>
            </article>
          )}
        </div>
      )}
      <div className="workbench-limits">
        <b>Research-use boundaries</b>
        <p>
          The browser reports genomic evidence. It does not call an isolate
          susceptible when no resistance determinant is found, predict an
          individual patient’s disease severity, replace culture-based species
          confirmation, or prove direct transmission.
        </p>
      </div>
    </section>
  );
}
