import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
await build({entryPoints:[root+'ui/tools.mjs'],outfile:root+'ui/editor-bundle.js',bundle:true,format:'esm',minify:true,sourcemap:false,target:['es2022']});
