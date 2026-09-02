const IDENTITY_COLLECTIONS=new Set(['people','accounts','liabilities','assets','properties','propertyIntents','careers','serviceHistories','plannedEvents','goals']);
const UNSAFE_KEYS=new Set(['__proto__','prototype','constructor']);

export function canonicalize(value,{path='',seen=new WeakSet(),sortIdentityCollections=false}={}){
  if(value===null||['string','boolean'].includes(typeof value))return value;
  if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError(`Non-finite number at ${path||'root'}.`);return Object.is(value,-0)?0:value;}
  if(typeof value!=='object')throw new TypeError(`Unsupported canonical value at ${path||'root'}.`);
  if(seen.has(value))throw new TypeError(`Circular structure at ${path||'root'}.`);seen.add(value);
  if(Array.isArray(value)){let rows=value.map((item,index)=>canonicalize(item,{path:`${path}.${index}`,seen,sortIdentityCollections}));const key=path.split('.').at(-1);if(sortIdentityCollections&&IDENTITY_COLLECTIONS.has(key)&&rows.every(item=>item&&typeof item==='object'&&typeof item.id==='string'))rows=rows.toSorted((a,b)=>a.id.localeCompare(b.id));seen.delete(value);return rows;}
  const result={};for(const key of Object.keys(value).sort()){if(UNSAFE_KEYS.has(key))throw new TypeError(`Unsafe key ${key} at ${path||'root'}.`);const item=value[key];if(item!==undefined)result[key]=canonicalize(item,{path:path?`${path}.${key}`:key,seen,sortIdentityCollections});}seen.delete(value);return result;
}

export const canonicalStringify=value=>JSON.stringify(canonicalize(value));
export const serializeModel=model=>canonicalStringify(model);

export function parseUntrustedJson(serialized,{maxBytes=2_000_000}={}){
  if(typeof serialized!=='string')return{ok:false,error:{code:'IMPORT_TYPE_INVALID',message:'Import must be a JSON string.'}};
  if(serialized.length>maxBytes)return{ok:false,error:{code:'IMPORT_TOO_LARGE',message:`Import exceeds ${maxBytes} characters.`}};
  try{const value=JSON.parse(serialized);canonicalize(value);return{ok:true,value};}catch(cause){return{ok:false,error:{code:'JSON_PARSE_FAILED',message:cause.message}};}
}

export function deserializeModel(serialized,options){const parsed=parseUntrustedJson(serialized,options);if(!parsed.ok)return parsed;return{ok:true,model:parsed.value};}

// Browser-compatible deterministic fingerprint. It is an identity checksum, not a security primitive.
export function stableFingerprint(value){const text=typeof value==='string'?value:canonicalStringify(value);let hash=0xcbf29ce484222325n;for(let i=0;i<text.length;i++){hash^=BigInt(text.charCodeAt(i));hash=BigInt.asUintN(64,hash*0x100000001b3n);}return`fnv1a64:${hash.toString(16).padStart(16,'0')}`;}

export function financialModelInput(model){const copy=structuredClone(model);delete copy.savedAt;if(copy.extensions){delete copy.extensions.ui;delete copy.extensions.presentation;}return copy;}
export const modelFingerprint=model=>stableFingerprint(canonicalize(financialModelInput(model),{sortIdentityCollections:true}));
