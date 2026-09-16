/** Exact sequence retention audit; no species or phenotype inference. */
export const VERSION='0.1.0';
export const LIMITS={assemblyBytes:24*1024*1024,markerBytes:256*1024,markers:64,contigs:20000,hitsPerMarker:10000};
export function parseFasta(text,{markers=false,allowEmpty=false}={}){
  if(typeof text!=='string')throw new Error('Expected FASTA text.');
  const records=new Map();let id=null,chunks=[];
  function save(){if(id!==null){const seq=chunks.join('').toUpperCase();if(!seq)throw new Error(`Empty sequence: ${id}`);if(!(markers?/^[ACGT]+$/:/^[ACGTN]+$/).test(seq))throw new Error(markers?'Markers must contain only A, C, G and T.':'Assemblies must contain only A, C, G, T and N.');records.set(id,seq);}}
  for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    if(line.startsWith('>')){save();id=line.slice(1).trim().split(/\s+/)[0];if(!id||id.length>500)throw new Error('FASTA identifiers must contain 1–500 characters.');if(records.has(id))throw new Error(`Duplicate FASTA identifier: ${id}`);chunks=[];}
    else {if(id===null)throw new Error('Expected a FASTA header beginning with >. FASTQ and compressed files are not supported.');chunks.push(line);}
  }save();if(!records.size&&!allowEmpty)throw new Error('The FASTA file contains no sequences.');
  if(records.size>(markers?LIMITS.markers:LIMITS.contigs))throw new Error(`Too many sequences: limit ${markers?LIMITS.markers:LIMITS.contigs}.`);
  return records;
}
export function reverseComplement(seq){const map={A:'T',C:'G',G:'C',T:'A',N:'N'};const chunks=[];for(let end=seq.length;end>0;end-=16384){chunks.push(seq.slice(Math.max(0,end-16384),end).split('').reverse().map(c=>map[c]).join(''));}return chunks.join('');}
function canonical(seq){const rev=reverseComplement(seq);return seq<rev?seq:rev;}
export function hits(records,marker){const rev=reverseComplement(marker);const queries=rev===marker?[['+',marker]]:[['+',marker],['-',rev]];const found=[];
  for(const [contig,seq]of records){for(const [strand,q]of queries){let p=seq.indexOf(q);while(p!==-1){found.push({contig,start:p+1,end:p+q.length,strand});if(found.length>LIMITS.hitsPerMarker)throw new Error('Too many exact matches for a marker. Use longer, more specific marker sequences.');p=seq.indexOf(q,p+1);}}}return found;
}
export function audit(full,selected,markers,onProgress=()=>{}){
  const counts=new Map();for(const seq of full.values()){const c=canonical(seq);counts.set(c,(counts.get(c)||0)+1);}
  const unsupported=[];for(const [id,seq]of selected){const c=canonical(seq);const n=counts.get(c)||0;if(n>0)counts.set(c,n-1);else unsupported.push(id);}
  const rows=[];let completed=0;
  for(const [marker,seq]of markers){const before=hits(full,seq),after=hits(selected,seq);const status=before.length?(after.length?'retained_exact':'lost_during_selection'):(after.length?'introduced_after_selection':'not_detected_in_either');rows.push({marker,status,before_count:before.length,after_count:after.length,copy_count_decreased:after.length<before.length,before_hits:before,after_hits:after});onProgress(++completed,markers.size);}
  return {version:VERSION,analysis:'exact-sequence-retention-only',sequence_subset_consistent:unsupported.length===0,selected_contigs_not_exact_parent_sequences:unsupported,summary:{markers_tested:rows.length,baseline_markers:rows.filter(r=>r.before_count>0).length,retained:rows.filter(r=>r.status==='retained_exact').length,lost:rows.filter(r=>r.status==='lost_during_selection').length,introduced:rows.filter(r=>r.status==='introduced_after_selection').length,not_detected:rows.filter(r=>r.status==='not_detected_in_either').length,copy_count_decreased:rows.filter(r=>r.copy_count_decreased).length,original_contigs:full.size,selected_contigs:selected.size,original_bp:[...full.values()].reduce((n,s)=>n+s.length,0),selected_bp:[...selected.values()].reduce((n,s)=>n+s.length,0)},markers:rows,limits:'Exact matches to user-supplied markers only. No species identification, biological gene absence, culture purity, MLST assignment, resistance prediction or population calibration. A non-subset output may reflect editing or reassembly; selection-loss interpretation then requires review.'};
}
export function csvCell(value){let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function reportCsv(report){const headers=['marker','status','before_count','after_count','copy_count_decreased','before_locations_1based_inclusive','after_locations_1based_inclusive'];const loc=hits=>hits.map(h=>`${h.contig}:${h.start}-${h.end}(${h.strand})`).join('; ');return [headers,...report.markers.map(r=>[r.marker,r.status,r.before_count,r.after_count,r.copy_count_decreased,loc(r.before_hits),loc(r.after_hits)])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
export const DEMO={full:'>kept_contig\nTTTAGCTACGATTTGGG\n>removed_contig\nAAAGGTACCAAATTT\n',selected:'>renamed_kept_contig\nTTTAGCTACGATTTGGG\n',markers:'>example_retained\nAGCTACGA\n>example_lost\nGGTACCAA\n>example_not_detected\nCCCCAAAA\n'};
