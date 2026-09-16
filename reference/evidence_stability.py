"""Audit exact-marker stability under reference-contig selection.

Research prototype 0.2.0. This measures computational evidence retention,
not taxonomic truth, clinical absence, or culture purity. Standard library only.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

VERSION = '0.2.0'

def fasta(path):
    records = {}; name = None; chunks = []
    with Path(path).open() as stream:
        for raw in stream:
            line = raw.strip()
            if not line: continue
            if line.startswith('>'):
                if name is not None: records[name] = ''.join(chunks)
                name = line[1:].split()[0]
                if name in records: raise ValueError('Duplicate FASTA identifier: ' + name)
                chunks = []
            elif name is None: raise ValueError('Sequence before header')
            else: chunks.append(line.upper())
    if name is not None: records[name] = ''.join(chunks)
    if not records or any(not seq for seq in records.values()):
        raise ValueError('Empty FASTA')
    return records

def reverse_complement(seq):
    return seq.translate(str.maketrans('ACGT', 'TGCA'))[::-1]

def hits(records, marker):
    if not marker or set(marker) - set('ACGT'):
        raise ValueError('Markers must be unambiguous ACGT')
    queries = [('+', marker)]
    rc = reverse_complement(marker)
    if rc != marker: queries.append(('-', rc))
    result = []
    for contig, seq in records.items():
        for strand, query in queries:
            start = seq.find(query)
            while start >= 0:
                result.append({'contig': contig, 'start': start + 1,
                               'end': start + len(query), 'strand': strand})
                start = seq.find(query, start + 1)
    return result

def union_length(intervals):
    end = -1; total = 0
    for a, b in sorted(intervals):
        total += max(0, b - max(a, end)); end = max(end, b)
    return total

def contexts(paf, panel, lengths, mapq=20, identity=.95):
    """Reproduce inherited accepted alignment rules; retain subthreshold support.

    Minimap2 primary-only output cannot measure competition from suppressed
    secondary alignments. Ties reproduce inherited reverse lexical tie-breaking.
    """
    intervals = defaultdict(lambda: defaultdict(list))
    for line in Path(paf).read_text().splitlines():
        if not line.strip(): continue
        f = line.split('\t'); q, ref = f[0], f[5]
        tags = {v.split(':', 2)[0]: v.split(':', 2)[2] for v in f[12:]}
        block = int(f[10])
        ident = 1-float(tags['de']) if 'de' in tags else int(f[9])/block
        if int(f[11]) < mapq or ident < identity or block < min(1000, int(f[1])*.8):
            continue
        if q not in lengths or int(f[1]) != lengths[q]:
            raise ValueError('PAF query length or ID differs from assembly')
        intervals[q][panel[ref]['species']].append((int(f[2]), int(f[3])))
    out = {}
    for q, n in lengths.items():
        candidates = sorted([(union_length(v), sp) for sp, v in intervals[q].items()], reverse=True)
        out[q] = {'best_species': candidates[0][1] if candidates else None,
                  'support': candidates[0][0]/n if candidates else 0,
                  'by_species': {sp: union_length(v)/n for sp, v in intervals[q].items()},
                  'intervals': dict(intervals[q])}
    return out

def transition(before, after):
    if before and after: return 'retained_exact'
    if before: return 'lost_during_selection'
    if after: return 'introduced_after_selection'
    return 'not_detected_in_either'

def audit(full, selected, markers):
    # Exact sequence subset certificate tolerates rename, order and reverse complement.
    parent_counts = Counter(min(s, reverse_complement(s)) for s in full.values())
    unsupported = []
    for k, s in selected.items():
        canonical = min(s, reverse_complement(s))
        if parent_counts[canonical] == 0:
            unsupported.append(k)
        else:
            parent_counts[canonical] -= 1
    rows = []
    for marker, seq in markers.items():
        before, after = hits(full, seq), hits(selected, seq)
        rows.append({'marker': marker, 'status': transition(before, after),
                     'before_count': len(before), 'after_count': len(after),
                     'copy_count_decreased': len(after) < len(before),
                     'before_hits': before, 'after_hits': after})
    return {'selected_contigs_not_exact_parent_sequences': unsupported,
            'sequence_subset_consistent': not unsupported, 'markers': rows}

def csvout(path, rows):
    with Path(path).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)

def run(full_path, selected_path, markers_path, paf_path, panel_path, out, sample, target):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    full, selected, markers = map(fasta, [full_path, selected_path, markers_path])
    panel = json.loads(Path(panel_path).read_text())
    ctx = contexts(paf_path, panel, {k: len(s) for k, s in full.items()})
    report = audit(full, selected, markers)
    # Baseline reproduction is mandatory before interpreting the sensitivity sweep.
    expected = {k: s for k, s in full.items()
                if ctx[k]['best_species'] == target and ctx[k]['support'] >= .70}
    canonical = lambda d: sorted(min(s, reverse_complement(s)) for s in d.values())
    report['reproduces_original_70_percent_selection'] = canonical(expected) == canonical(selected)
    if not report['reproduces_original_70_percent_selection']:
        raise ValueError('70% baseline does not reproduce the delivered selected assembly')
    marker_rows = []
    for row in report['markers']:
        exact = row['before_hits']
        supported = [ctx[h['contig']]['support'] for h in exact
                     if ctx[h['contig']]['best_species'] == target]
        # Critical cutoff is exact for this fixed panel and alignment evidence.
        cutoff = max(supported) if supported else None
        row['max_retaining_cutoff'] = cutoff
        for h in exact:
            c = ctx[h['contig']]
            intervals = c['intervals'].get(target, [])
            overlaps = [(max(a, h['start']-1), min(b, h['end'])) for a, b in intervals
                        if max(a, h['start']-1) < min(b, h['end'])]
            marker_rows.append({'sample': sample, 'marker': row['marker'],
                'contig': h['contig'], 'start_1based': h['start'], 'end_1based': h['end'],
                'strand': h['strand'], 'best_reference_species': c['best_species'],
                'contig_support_percent': 100*c['support'],
                'marker_overlap_with_accepted_target_alignments_percent': 100*union_length(overlaps)/len(markers[row['marker']]),
                'max_retaining_cutoff_percent': 100*cutoff if cutoff is not None else '',
                'status_at_70_percent': row['status']})
    sweep = []
    for percent in range(50, 100):
        chosen = {q for q in full if ctx[q]['best_species'] == target and ctx[q]['support'] >= percent/100}
        n = sum(any(h['contig'] in chosen for h in r['before_hits']) for r in report['markers'])
        sweep.append({'sample': sample, 'coverage_cutoff_percent': percent,
                      'retained_contigs': len(chosen), 'retained_bp': sum(len(full[q]) for q in chosen),
                      'exact_markers_retained': n, 'markers_tested': len(markers)})
    report.update({'version': VERSION, 'sample': sample,
        'inputs': {key: {'path': str(Path(p).resolve()), 'sha256': hashlib.sha256(Path(p).read_bytes()).hexdigest()}
                   for key, p in [('full', full_path), ('selected', selected_path), ('markers', markers_path), ('paf', paf_path), ('panel', panel_path)]},
        'limits': 'Fixed reference panel and saved alignments. No organism purity, biological absence, strain attribution, or transmission inference. Lowering a threshold to recover an expected call is not a validated correction.'})
    (out/(sample+'.json')).write_text(json.dumps(report, indent=2))
    csvout(out/(sample+'_marker_evidence.csv'), marker_rows)
    csvout(out/(sample+'_threshold_sweep.csv'), sweep)
    return report, marker_rows, sweep

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['full','selected','markers','paf','panel','out','sample']:
        parser.add_argument('--'+name, required=True)
    parser.add_argument('--target', default='Klebsiella pneumoniae')
    a = parser.parse_args()
    run(a.full,a.selected,a.markers,a.paf,a.panel,a.out,a.sample,a.target)
