'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import GenomeWorkbench from '@/components/genome-workbench';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dna,
  ShieldCheck,
  ArrowRight,
  FileText,
  Code2,
  Download,
  Check,
  TriangleAlert,
  LoaderCircle,
} from 'lucide-react';
import { DEMO, reportCsv } from '../public/audit-core.mjs';
type Hit = { contig: string; start: number; end: number; strand: string };
type Category = 'resistance' | 'virulence' | 'mlst' | 'species' | 'other';
type Row = {
  marker: string;
  label: string;
  category: Category;
  trait: string;
  locus: string;
  allele: string;
  database: string;
  accession: string;
  status: string;
  before_count: number;
  after_count: number;
  copy_count_decreased: boolean;
  before_hits: Hit[];
  after_hits: Hit[];
};
type CategorySummary = {
  tested: number;
  detected_before: number;
  detected_after: number;
  lost: number;
};
type Summary = {
  markers_tested: number;
  baseline_markers: number;
  retained: number;
  lost: number;
  introduced: number;
  not_detected: number;
  copy_count_decreased: number;
  original_contigs: number;
  selected_contigs: number;
  original_bp: number;
  selected_bp: number;
  by_category: Record<Category, CategorySummary>;
};
type Report = {
  version: string;
  sequence_subset_consistent: boolean;
  selected_contigs_not_exact_parent_sequences: string[];
  summary: Summary;
  markers: Row[];
  example_only: boolean;
  inputs: Record<string, { name: string; bytes: number; sha256: string }>;
  created_at: string;
  limits: string;
};
const names: Record<string, string> = {
  retained_exact: 'Retained',
  lost_during_selection: 'Lost during processing',
  introduced_after_selection: 'Only in selected',
  not_detected_in_either: 'Not detected in either',
};
const categoryNames: Record<Category, string> = {
  resistance: 'Resistance evidence',
  virulence: 'Virulence evidence',
  mlst: 'MLST evidence',
  species: 'Species evidence',
  other: 'Unclassified marker',
};
const visibleEvidenceCategories: Category[] = [
  'resistance',
  'virulence',
  'mlst',
  'species',
];
const specs = [
  [
    'full',
    'Original assembly',
    'The complete assembly before contig selection.',
  ],
  ['selected', 'Selected assembly', 'The contigs retained after filtering.'],
  [
    'markers',
    'Marker sequences',
    'Exact sequences to track, with optional evidence annotations in each FASTA header.',
  ],
];
const locations = (h: Hit[]) =>
  h.map((x) => `${x.contig}:${x.start}–${x.end} (${x.strand})`).join('; ') ||
  'No exact match';
const interpretation = (r: Row) => {
  if (!r.after_count)
    return r.before_count
      ? 'Exact evidence existed before processing but is absent from the selected assembly.'
      : 'No exact match; biological absence is not established.';
  if (r.category === 'resistance')
    return 'Resistance-associated sequence detected; phenotype still requires validated AMR rules and susceptibility testing.';
  if (r.category === 'virulence')
    return 'Virulence-associated sequence detected; this does not predict disease severity.';
  if (r.category === 'mlst')
    return 'MLST allele sequence detected; sequence type requires all scheme loci and profile lookup.';
  if (r.category === 'species')
    return 'Species-associated sequence detected; species confirmation requires whole-genome comparison.';
  return 'Exact user-supplied marker sequence detected.';
};
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export default function Home() {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [demo, setDemo] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const worker = useRef<Worker | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const current = useRef({ busy, report });
  current.current = { busy, report };
  const stop = () => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
  };
  const run = (chosen: Record<string, File> = files, isDemo = demo) => {
    if (!['full', 'selected', 'markers'].every((k) => chosen[k])) {
      setError('Please choose all three files.');
      return;
    }
    stop();
    setReport(null);
    setError('');
    setBusy(true);
    setProgress('Starting local sequence audit…');
    try {
      const w = new Worker(
        new URL('./audit-worker.mjs', window.location.href),
        { type: 'module' },
      );
      worker.current = w;
      w.onmessage = ({ data }) => {
        if (data.type === 'progress') setProgress(data.text);
        if (data.type === 'error') {
          setError(data.message);
          stop();
        }
        if (data.type === 'result') {
          setReport(data.result);
          stop();
          setProgress('Audit complete.');
          setTimeout(
            () =>
              resultRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              }),
            80,
          );
        }
      };
      w.onerror = () => {
        setError(
          'The browser could not complete the audit. Try a current desktop browser and smaller files.',
        );
        stop();
      };
      w.postMessage({ ...chosen, example: isDemo });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start audit.');
      stop();
    }
  };
  const example = () => {
    if (current.current.busy) return;
    const chosen = Object.fromEntries(
      Object.entries(DEMO).map(([k, v]) => [
        k,
        new File([String(v)], `example_${k}.fasta`, { type: 'text/plain' }),
      ]),
    );
    setFiles(chosen);
    setDemo(true);
    setResetKey((k) => k + 1);
    run(chosen, true);
  };
  useEffect(() => () => worker.current?.terminate(), []);
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#">
          <Dna size={27} />
          <span>
            Genome Evidence <b>Audit</b>
          </span>
        </a>
        <span className="version">RESEARCH TOOL · v0.3.0-alpha.1</span>
      </header>
      <div className="workspace">
        <section className="intro">
          <div>
            <p className="eyebrow">SEQUENCE RETENTION / BEFORE → AFTER</p>
            <h1>
              Did filtering change
              <br />
              your genetic evidence?
            </h1>
            <p className="lead">
              Compare two assemblies. Trace the exact sequences that
              survived—and the ones left behind.
            </p>
          </div>
          <div className="privacy">
            <ShieldCheck />
            <div>
              <b>Your sequences stay on your device</b>
              <p>
                Analysis runs in your browser. The tool does not upload or store
                your genome files.
              </p>
            </div>
          </div>
        </section>
        <GenomeWorkbench />
        <div className="audit-grid">
          <section className="panel">
            <div className="section-title">
              <span className="step">01</span>
              <div>
                <h2>Add your FASTA files</h2>
                <p>One assembly pair · up to 24 MiB per assembly</p>
              </div>
            </div>
            <div className="file-list">
              {specs.map(([key, title, hint], i) => (
                <label className="file-row" key={key}>
                  <span className="file-index">0{i + 1}</span>
                  <div>
                    <b>{title}</b>
                    <p>{hint}</p>
                    <input
                      key={`${key}-${resetKey}`}
                      disabled={busy}
                      type="file"
                      accept=".fa,.fna,.fasta,.fas,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setFiles((x) => {
                          const n = { ...x };
                          if (f) n[key] = f;
                          else delete n[key];
                          return n;
                        });
                        setDemo(false);
                        setReport(null);
                        setError('');
                      }}
                      aria-label={title}
                    />
                    {files[key] && (
                      <span className="chosen">
                        {files[key].name} ·{' '}
                        {(files[key].size / 1024).toFixed(1)} KiB
                      </span>
                    )}
                  </div>
                  <FileText size={22} />
                </label>
              ))}
            </div>
            <p className="file-help">
              Uncompressed FASTA only. Assemblies: A/C/G/T/N. Markers: A/C/G/T,
              up to 64 sequences and 256 KiB. An empty selected file is allowed.
              Add optional fields to a marker header with pipes, for example:{' '}
              <code>&gt;blaKPC-2|category=resistance|trait=carbapenem</code>
            </p>
            <div className="actions">
              <Button
                disabled={busy || Object.keys(files).length !== 3}
                onClick={() => run()}
              >
                {busy ? <LoaderCircle className="spin" /> : <ArrowRight />}
                {busy ? 'Running audit…' : 'Run sequence audit'}
              </Button>
              {busy ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    stop();
                    setProgress('Audit cancelled.');
                  }}
                >
                  Cancel
                </Button>
              ) : (
                <Button variant="outline" onClick={example}>
                  Try an example
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  stop();
                  setFiles({});
                  setReport(null);
                  setError('');
                  setProgress('');
                  setDemo(false);
                  setResetKey((k) => k + 1);
                }}
              >
                Clear files
              </Button>
            </div>
            <p className="progress" role="status" aria-live="polite">
              {progress}
            </p>
            {error && (
              <p role="alert" className="notice warning">
                <TriangleAlert size={18} />
                {error}
              </p>
            )}
          </section>
          <aside className="side">
            <p className="eyebrow">WHAT THE AUDIT CHECKS</p>
            <h2>
              Follow the evidence,
              <br />
              not just the final call.
            </h2>
            <ol>
              <li>
                <b>Find exact matches</b>
                <p>
                  Locate each supplied marker in both assemblies, on either
                  strand.
                </p>
              </li>
              <li>
                <b>Trace sequence loss</b>
                <p>
                  See which marker sequences disappear after contig selection.
                </p>
              </li>
              <li>
                <b>Keep a reviewable record</b>
                <p>Export match counts, locations, and file fingerprints.</p>
              </li>
            </ol>
            <div className="available-evidence">
              <b>Available annotation categories</b>
              <div>
                {visibleEvidenceCategories.map((category) => (
                  <span className={`category ${category}`} key={category}>
                    {categoryNames[category]}
                  </span>
                ))}
              </div>
              <p>
                These labels classify exact user-supplied markers. Select{' '}
                <b>Try an example</b> to see all four in the results.
              </p>
            </div>
            <div className="scope">
              <b>Research interpretation</b>
              <p>
                Missing exact matches do not establish biological gene absence.
                Annotated matches report genomic evidence; phenotype, species
                confirmation, and transmission require validated downstream
                analyses.
              </p>
            </div>
            <details>
              <summary>Which files do I need?</summary>
              <p>
                Use an assembled genome before filtering, its selected contigs,
                and a FASTA of exact marker sequences. Marker headers may label
                resistance, virulence, MLST, or species evidence. The tool does
                not identify or curate marker sequences automatically.
              </p>
              <p>
                Raw FASTQ, compressed archives, alignment files, and
                spreadsheets are not accepted in this browser edition.
              </p>
              <a href="./examples/markers.fasta" download>
                Download example marker FASTA
              </a>
            </details>
          </aside>
        </div>
        {report && (
          <section
            className="panel results"
            ref={resultRef}
            aria-label="Audit results"
          >
            <div className="result-top">
              <div className="section-title">
                <span className="step">02</span>
                <div>
                  <h2>
                    {report.example_only
                      ? 'Example audit'
                      : 'Your audit results'}
                  </h2>
                  <p>
                    {report.example_only
                      ? 'Invented short sequences for demonstration only.'
                      : 'Exact marker matches · coordinates are 1-based and inclusive.'}
                  </p>
                </div>
              </div>
              <div className="exports">
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      reportCsv(report),
                      'sequence-audit.csv',
                      'text/csv;charset=utf-8',
                    )
                  }
                >
                  <Download /> CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    download(
                      JSON.stringify(report, null, 2),
                      'sequence-audit.json',
                      'application/json',
                    )
                  }
                >
                  <Download /> Full report
                </Button>
                <Button variant="ghost" onClick={() => window.print()}>
                  Print / PDF
                </Button>
              </div>
            </div>
            <div
              className={`notice ${report.sequence_subset_consistent ? 'good' : 'warning'}`}
            >
              {report.sequence_subset_consistent ? (
                <Check size={20} />
              ) : (
                <TriangleAlert size={20} />
              )}
              <div>
                <b>
                  {report.sequence_subset_consistent
                    ? 'Selected sequences match the original assembly'
                    : 'Selected assembly is not an exact subset'}
                </b>
                <p>
                  {report.sequence_subset_consistent
                    ? 'Sequence identity and copy counts are consistent with contig selection; renamed and reverse-complemented contigs are allowed.'
                    : 'Some selected contigs are new, edited, or overrepresented. Treat the counts as a comparison; loss cannot be attributed solely to contig selection.'}
                </p>
              </div>
            </div>
            <div className="stats">
              <div>
                <span>Markers tested</span>
                <strong>{report.summary.markers_tested}</strong>
              </div>
              <div>
                <span>Retained</span>
                <strong>{report.summary.retained}</strong>
              </div>
              <div className={report.summary.lost ? 'loss' : ''}>
                <span>Lost during processing</span>
                <strong>{report.summary.lost}</strong>
              </div>
              <div>
                <span>Not detected in either</span>
                <strong>{report.summary.not_detected}</strong>
              </div>
            </div>
            {Object.values(report.summary.by_category).some(
              (value) => value.tested > 0,
            ) && (
              <div
                className="evidence-summary"
                aria-label="Annotated evidence summary"
              >
                {Object.entries(report.summary.by_category)
                  .filter(([, value]) => value.tested > 0)
                  .map(([category, value]) => (
                    <div key={category}>
                      <span>{categoryNames[category as Category]}</span>
                      <strong>
                        {value.detected_after}/{value.tested}
                      </strong>
                      <small>
                        exact matches after processing
                        {value.lost ? ` · ${value.lost} lost` : ''}
                      </small>
                    </div>
                  ))}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marker</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Sequence evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.markers.map((r) => (
                  <TableRow key={r.marker}>
                    <TableCell className="marker-name">
                      <b>{r.label}</b>
                      <span className={`category ${r.category}`}>
                        {categoryNames[r.category]}
                      </span>
                      {(r.trait || r.locus || r.allele) && (
                        <small className="marker-meta">
                          {[
                            r.trait,
                            r.locus && `locus ${r.locus}`,
                            r.allele && `allele ${r.allele}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                      {(r.database || r.accession) && (
                        <small className="marker-source">
                          {[r.database, r.accession]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                    </TableCell>
                    <TableCell>{r.before_count}</TableCell>
                    <TableCell>{r.after_count}</TableCell>
                    <TableCell>
                      <span className={`status ${r.status}`}>
                        {names[r.status]}
                      </span>
                      {r.copy_count_decreased && r.after_count > 0 && (
                        <small className="copy-note">
                          Copy count decreased
                        </small>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="interpretation">{interpretation(r)}</p>
                      <details>
                        <summary>View locations</summary>
                        <p>
                          <b>Before:</b> {locations(r.before_hits)}
                        </p>
                        <p>
                          <b>After:</b> {locations(r.after_hits)}
                        </p>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="result-note">
              Retained = an exact marker occurs in both assemblies. Counts are
              sequence occurrences, not bacterial cells. Evidence categories
              come from the uploaded FASTA headers and are not independently
              verified by this website.
            </p>
            <details className="fingerprints">
              <summary>Input fingerprints & audit limits</summary>
              <p>{report.limits}</p>
              {Object.entries(report.inputs).map(([k, v]) => (
                <p key={k}>
                  <b>{k}:</b> {v.name}
                  <br />
                  <code>SHA-256 {v.sha256}</code>
                </p>
              ))}
              <p>
                Browser edition {report.version} · {report.created_at}
              </p>
            </details>
          </section>
        )}
        <section className="method">
          <div>
            <p className="eyebrow">METHOD & SCOPE</p>
            <h2>A focused interface to the research audit</h2>
            <p>
              This browser edition implements the direct before/after
              exact-sequence check and reports optional resistance, virulence,
              MLST, and species marker annotations supplied by the researcher.
              It does not convert a marker match into a clinical phenotype,
              species confirmation, or transmission claim.
            </p>
          </div>
          <div>
            <h3>Start with the example</h3>
            <p>
              The invented example contains annotated resistance, virulence,
              MLST, and species markers: two retained, one lost, and one absent
              from both assemblies. It demonstrates reporting behavior, not
              biological performance.
            </p>
            <div className="example-links">
              {['full', 'selected', 'markers'].map((k) => (
                <a key={k} href={`./examples/${k}.fasta`} download>
                  {k}.fasta ↗
                </a>
              ))}
            </div>
          </div>
        </section>
        <section
          className="interpretation-roadmap"
          aria-labelledby="roadmap-title"
        >
          <div>
            <p className="eyebrow">METHOD &amp; VALIDATION STATUS</p>
            <h2 id="roadmap-title">
              Integrated analysis with explicit scientific limits
            </h2>
            <p>
              The workbench runs locally in the browser with a pinned reference
              snapshot and exports a versioned, auditable report. Every result
              records where genomic evidence ends and clinical inference begins.
            </p>
          </div>
          <div className="roadmap-grid">
            <article>
              <b>Species and complete MLST</b>
              <p>
                Reference-sketch screening, seven-locus allele calling, profile
                lookup, quality checks, and abstention for ambiguous genomes.
              </p>
            </article>
            <article>
              <b>Antimicrobial resistance</b>
              <p>
                CARD 3.2.9 family-level screening reports high-confidence and
                partial candidates separately. It never labels an isolate
                susceptible from gene absence.
              </p>
            </article>
            <article>
              <b>Virulence genotype</b>
              <p>
                Named loci and reproducible scores can be reported; a genome
                cannot predict an individual patient’s disease severity.
              </p>
            </article>
            <article>
              <b>Transmission compatibility</b>
              <p>
                Batch MinHash distances identify close genome pairs for
                follow-up. Confirmation still requires a validated SNP/cgMLST
                workflow plus dates, locations and epidemiological evidence.
              </p>
            </article>
          </div>
        </section>
        <footer>
          <span>
            Genome Evidence Audit · research prototype · files stay local
          </span>
          <a
            href="https://github.com/al-mualm/genome-evidence-audit"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={17} /> Source & documentation
          </a>
        </footer>
      </div>
    </main>
  );
}
