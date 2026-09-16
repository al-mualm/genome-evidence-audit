import{parseFasta,audit,LIMITS}from './audit-core.mjs';
self.onmessage=async({data})=>{try{
  const records={},inputs={};
  for(const key of ['full','selected','markers']){const file=data[key];if(!(file instanceof Blob))throw new Error('Please select all three FASTA files.');const max=key==='markers'?LIMITS.markerBytes:LIMITS.assemblyBytes;if(file.size>max)throw new Error(`${key}: file exceeds ${max/1024/1024} MiB limit.`);self.postMessage({type:'progress',text:`Reading ${key} FASTA…`});const bytes=await file.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',bytes);inputs[key]={name:file.name,bytes:file.size,sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')};records[key]=parseFasta(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{markers:key==='markers',allowEmpty:key==='selected'});}
  const result=audit(records.full,records.selected,records.markers,(n,total)=>self.postMessage({type:'progress',text:`Checking marker ${n} of ${total}…`}));
  result.inputs=inputs;result.created_at=new Date().toISOString();result.example_only=Boolean(data.example);self.postMessage({type:'result',result});
}catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'Unable to read the files.'});}};
