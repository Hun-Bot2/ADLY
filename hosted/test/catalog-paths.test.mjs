import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {attachCatalog} from '../mastery/catalog.mjs';
import {tempRoot} from './helpers/temp.mjs';

for(const name of ['space name','한글', 'hash#name', 'percent%41', "quote'name"]){
  test(`catalog path ${name} stays read-only without stray files`,t=>{
    const {root,own}=tempRoot(t,'catalog-path-');
    const path=join(root,`${name}.sqlite3`),source=new DatabaseSync(path);
    source.exec("CREATE TABLE catalog_meta(key TEXT,value TEXT); INSERT INTO catalog_meta VALUES('version','fixture')");source.close();
    const db=own(new DatabaseSync(':memory:'));
    assert.equal(attachCatalog(db,path,{verify:false}).version,'fixture');
    assert.throws(()=>db.exec("INSERT INTO catalog.catalog_meta VALUES('x','y')"),/readonly/i);
    assert.deepEqual(readdirSync(root),[`${name}.sqlite3`]);
  });
}


