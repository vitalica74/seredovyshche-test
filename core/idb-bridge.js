// Experimental IndexedDB-compatible bridge for sandboxed applications.
// Host owns the actual IDB database. No app receives direct access to host IDB.
export function createIDBHostBridge({frame,getToken,getProjectId,onError}) {
  const ROOT='seredovyshche-sandbox-records-v1';
  let databasePromise;
  function db() {
    if(databasePromise)return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      const r=indexedDB.open(ROOT,1);
      r.onupgradeneeded=()=>r.result.createObjectStore('entries');
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
    return databasePromise;
  }
  function key(project,database,store,id){return JSON.stringify([project,database,store,id]);}
  function request(db,mode,fn){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('entries',mode),store=tx.objectStore('entries');
      let result;
      try{const req=fn(store);req.onsuccess=()=>result=req.result;req.onerror=()=>reject(req.error);}catch(e){reject(e);return;}
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'));
    });
  }
  async function handle(d,project) {
    const database=String(d.database||'').slice(0,160);
    if(!database)throw Error('Missing database name');
    const root=await db();
    const metaKey=key(project,database,'@meta','schema');
    const schema=await request(root,'readonly',s=>s.get(metaKey))||{version:0,stores:[]};
    if(d.action==='open')return schema;
    if(d.action==='upgrade'){
      const version=Number(d.version);
      if(!Number.isInteger(version)||version<schema.version||version>100000)throw Error('Invalid version');
      const stores=Array.isArray(d.stores)?d.stores.filter(x=>typeof x==='string'&&x.length<160):[];
      const next={version,stores:[...new Set([...schema.stores,...stores])]};
      await request(root,'readwrite',s=>s.put(next,metaKey));
      return next;
    }
    const store=String(d.store||'');
    if(!schema.stores.includes(store))throw Error('Object store not found: '+store);
    const prefix=JSON.stringify([project,database,store]).slice(0,-1)+',';
    if(d.action==='getAll'||d.action==='getAllKeys'||d.action==='count'||d.action==='clear'){
      const entries=await request(root,'readonly',s=>s.getAllKeys());
      const keys=entries.filter(k=>typeof k==='string'&&k.startsWith(prefix));
      if(d.action==='count')return keys.length;
      if(d.action==='clear'){
        for(const k of keys)await request(root,'readwrite',s=>s.delete(k));
        return undefined;
      }
      if(d.action==='getAllKeys')return keys.map(k=>JSON.parse(k)[3]);
      const values=[];
      for(const k of keys)values.push(await request(root,'readonly',s=>s.get(k)));
      return values;
    }
    const id=d.key??(d.value&&d.value.id);
    if(id===undefined||id===null)throw Error('Missing record key');
    const k=key(project,database,store,id);
    if(d.action==='get')return await request(root,'readonly',s=>s.get(k));
    if(d.action==='delete'){await request(root,'readwrite',s=>s.delete(k));return undefined;}
    if(d.action==='put'||d.action==='add'){
      if(d.action==='add'&&(await request(root,'readonly',s=>s.get(k)))!==undefined)throw Error('ConstraintError: duplicate key');
      await request(root,'readwrite',s=>s.put(d.value,k));return id;
    }
    throw Error('Unsupported operation '+d.action);
  }
  window.addEventListener('message',async event=>{
    const d=event.data,token=getToken(),project=getProjectId();
    if(event.source!==frame.contentWindow||!token||!project||!d||d.__svIDB!==token||!Number.isInteger(d.id))return;
    let result,err;
    try{result=await handle(d,project);}
    catch(e){err=String(e&&e.message||e);onError?.(err);}
    try{event.source.postMessage({__svIDBReply:token,id:d.id,result,error:err},'*');}catch(e){onError?.(String(e));}
  });
}

export function sandboxIndexedDBShim(token) {
  let seq=0;
  const pending=new Map();
  const call=(action,database,extras={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});
    parent.postMessage({__svIDB:token,id,action,database,...extras},'*');
  });
  addEventListener('message',e=>{
    if(e.source!==parent||!e.data||e.data.__svIDBReply!==token)return;
    const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);
    e.data.error?p.reject(new Error(e.data.error)):p.resolve(e.data.result);
  });
  function req(execute){
    const r={result:undefined,error:null,onsuccess:null,onerror:null};
    Promise.resolve().then(execute).then(result=>{
      r.result=result;
      r.onsuccess?.({target:r});
    }).catch(error=>{
      r.error=error;
      if(r.onerror)r.onerror({target:r});else console.error('IndexedDB operation:',error);
    });
    return r;
  }
  const factory={
    open(name,version){
      const r={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null};
      Promise.resolve().then(async()=>{
        const current=await call('open',name);
        const requested=version===undefined?Math.max(1,current.version):Number(version);
        if(requested<current.version)throw Error('VersionError');
        const names=[...current.stores];
        const database={
          name,version:requested,objectStoreNames:{contains:n=>names.includes(n)},
          createObjectStore(n,options={}){
            if(names.includes(n))throw Error('ConstraintError');
            names.push(n);
            return {name:n,keyPath:options.keyPath||null};
          },
          transaction(storeNames,mode='readonly'){
            const selected=Array.isArray(storeNames)?storeNames:[storeNames];
            return {
              mode,objectStore(store){
                if(!selected.includes(store)||!names.includes(store))throw Error('NotFoundError: '+store);
                const perform=(action,extras)=>req(()=>call(action,name,{store,...extras}));
                return {
                  getAll:()=>perform('getAll'),
                  getAllKeys:()=>perform('getAllKeys'),
                  count:()=>perform('count'),
                  get:key=>perform('get',{key}),
                  put:value=>perform('put',{value}),
                  add:value=>perform('add',{value}),
                  delete:key=>perform('delete',{key}),
                  clear:()=>perform('clear')
                };
              }
            };
          },
          close(){}
        };
        r.result=database;
        if(requested>current.version){
          r.onupgradeneeded?.({target:r,oldVersion:current.version,newVersion:requested});
          await call('upgrade',name,{version:requested,stores:names});
        }
        r.onsuccess?.({target:r});
      }).catch(error=>{r.error=error;r.onerror?.({target:r});});
      return r;
    },
    deleteDatabase(name){
      return req(()=>Promise.reject(new Error('Database deletion is disabled in experimental runtime to protect user data')));
    }
  };
  try{Object.defineProperty(window,'indexedDB',{configurable:true,value:factory});}
  catch(error){console.error('IndexedDB bridge unavailable',error);}
}
