import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Windows refuses to remove a directory while a SQLite handle inside it is open, and node:test
// runs t.after hooks in registration order. Handles passed to own() close before the removal.
export function tempRoot(t,prefix){
  const root=mkdtempSync(join(tmpdir(),prefix)),handles=[];
  t.after(()=>{
    for(const handle of handles.reverse()){try{handle.close();}catch{/* already closed */}}
    rmSync(root,{recursive:true,force:true});
  });
  return {root,own:handle=>{handles.push(handle);return handle;}};
}
