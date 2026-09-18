// Public-only comparison. Historical local results use a different input generation.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseFasta,audit,VERSION} from '../public/audit-core.mjs';
const repository=resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=resolve(process.argv[2]||join(repository,'../klebsiella_public_validation'));
const output=resolve(process.argv[3]||join(repository,'docs/retention-validation.json'));
const reference=join(repository,'reference/evidence_stability.py');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const py=`import json,importlib.util,pathlib
r=pathlib.Path(${JSON.stringify(root)})
s=importlib.util.spec_from_file_location('reference',${JSON.stringify(reference)})
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
result={}
manifest=json.loads((r/'metadata/frozen_manifest.json').read_text())
for item in manifest:
 if not item['role'].startswith('public_'):continue
 p=r/'samples'/item['sample']
 if not (p/'done.json').exists():raise ValueError('Missing completed public sample '+p.name)
 read=lambda n:m.fasta(p/n) if (p/n).read_text().strip() else {}
 result[p.name]=m.audit(read('assembly.fasta'),read('selected_70.fasta'),read('markers.fasta'))
print(json.dumps(result))`;
const ref=spawnSync(process.env.PYTHON||'python3',['-c',py],{encoding:'utf8',maxBuffer:32*1024*1024});
if(ref.status!==0)throw new Error(ref.stderr);
const expected=JSON.parse(ref.stdout),inputs=[];let markers=0;
for(const[name,r]of Object.entries(expected)){
 const dir=join(root,'samples',name),read=n=>readFileSync(join(dir,n),'utf8');
 assert.equal(hash(join(dir,'assembly.fasta')),JSON.parse(read('done.json')).assembly_sha256,name+': archived assembly fingerprint');
 const result=audit(parseFasta(read('assembly.fasta')),parseFasta(read('selected_70.fasta'),{allowEmpty:true}),parseFasta(read('markers.fasta'),{markers:true,allowEmpty:true}));
 const common=result.markers.map(row=>Object.fromEntries(['marker','status','before_count','after_count','copy_count_decreased','before_hits','after_hits'].map(key=>[key,row[key]])));
 assert.deepEqual(common,r.markers,name);
 assert.equal(result.sequence_subset_consistent,r.sequence_subset_consistent,name);
 assert.deepEqual(result.selected_contigs_not_exact_parent_sequences,r.selected_contigs_not_exact_parent_sequences,name);
 inputs.push({sample:name,assembly_sha256:hash(join(dir,'assembly.fasta')),selected_sha256:hash(join(dir,'selected_70.fasta')),markers_sha256:hash(join(dir,'markers.fasta'))});
 markers+=result.markers.length;
}
assert.equal(inputs.length,103);assert.equal(markers,705);
const report={status:'passed',datasets:inputs.length,marker_transitions:markers,scope:'public datasets only; archived local analyses excluded',checks:['exact counts','hit coordinates and strands','retention states','copy-count decrease','sequence subset with multiplicity'],reference:'Python evidence_stability.py',reference_sha256:hash(reference),audit_core_version:VERSION,audit_core_sha256:hash(join(repository,'public/audit-core.mjs')),website_release:JSON.parse(readFileSync(join(repository,'package.json'),'utf8')).version,limitations:'Computational agreement only; not biological accuracy or clinical validation. Direct module invocation, not an end-to-end browser test. Header annotation fields are absent from the Python reference and are covered by separate unit tests.',date:new Date().toISOString(),inputs};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,datasets:inputs.length,marker_transitions:markers,output}));
