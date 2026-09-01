import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const EXPECTED={
  'index.html':'a9efc9885cf12df1f655e3411e1ed7ca107a6055',
  'styles.css':'c3538d4ec0bfa3f66e949ef5705128e94b47f8f6',
  'app.js':'0d198d9d7226ad400d7a2a365877cbcfc9b1b714'
};
function gitBlobSha(buffer){const header=Buffer.from(`blob ${buffer.length}\0`);return crypto.createHash('sha1').update(Buffer.concat([header,buffer])).digest('hex');}
test('frozen V1 production files remain byte-identical to pre-Milestone main',()=>{for(const [name,sha] of Object.entries(EXPECTED)){const data=fs.readFileSync(new URL(`../../../${name}`,import.meta.url));assert.equal(gitBlobSha(data),sha,name);}});
