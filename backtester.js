(() => {
  'use strict';
  let source = null;
  let rows = [];
  const $ = id => document.getElementById(id);
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const text = v => String(v ?? '').trim();
  const upper = v => text(v).toUpperCase();
  const first = (o, keys) => { for (const k of keys) { const parts=k.split('.'); let v=o; for(const p of parts) v=v?.[p]; if(v!==undefined&&v!==null&&v!=='') return v; } return null; };
  const resultNorm = r => {
    const x=upper(r);
    if(['GANADA','GANADO','WIN','WON','PROFIT','SUCCESS','TRUE'].includes(x)) return 'WIN';
    if(['PERDIDA','PERDIDO','LOSS','LOST','FAILED','FAIL','FALSE'].includes(x)) return 'LOSS';
    return 'OTHER';
  };
  function normalize(op,i){
    const market=upper(first(op,['mercado','symbol','market','senal.mercado','signal.symbol','contrato.symbol']))||'--';
    let direction=upper(first(op,['direccion','direction','prediction','senal.direccion','signal.direction','contrato.direction','contractType']));
    direction=direction.replace('PAR','EVEN').replace('IMPAR','ODD').replace('SUBE','RISE').replace('BAJA','FALL');
    const confidence=n(first(op,['confianza','confidence','score','senal.confianza','signal.confidence','perfil.confianza']));
    const timing=n(first(op,['timingRealMs','timingMs','buyTimingMs','calibracionMs','desviacionTargetMs','targetDeviationMs','timing.realMs','telemetria.timingRealMs']));
    const mode=upper(first(op,['modoEjecucion','executionMode','modo','telemetria.modoEjecucion']));
    const rawResult=first(op,['resultado','result','status','resultadoFinal','contractStatus','ultimoResultado','resultadoDemo','ganada']);
    return {i:i+1,market,direction:direction||'--',confidence,timing,mode,result:resultNorm(rawResult),raw:op};
  }
  function extract(data){
    const candidates=[data?.telemetria,data?.operations,data?.operaciones,data?.trades,data?.historial,data?.data];
    let a=candidates.find(Array.isArray);
    if(!a && Array.isArray(data)) a=data;
    return (a||[]).map(normalize);
  }
  function buildMarkets(){
    const s=[...new Set(rows.map(r=>r.market).filter(x=>x&&x!=='--'))].sort();
    $('market').innerHTML='<option value="ALL">Todos</option>'+s.map(x=>`<option>${x}</option>`).join('');
  }
  function stats(a){
    let wins=0,losses=0,best=0,worst=0,cw=0,cl=0;
    for(const r of a){ if(r.result==='WIN'){wins++;cw++;cl=0;best=Math.max(best,cw);} else if(r.result==='LOSS'){losses++;cl++;cw=0;worst=Math.max(worst,cl);} }
    const finished=wins+losses; return {total:a.length,wins,losses,finished,accuracy:finished?wins/finished*100:0,best,worst};
  }
  function group(a,keyFn){
    const m=new Map(); for(const r of a){const k=keyFn(r); if(k===null||k===undefined||k==='')continue; if(!m.has(k))m.set(k,[]);m.get(k).push(r);} return [...m].map(([key,v])=>({key,...stats(v)}));
  }
  const pct=x=>`${x.toFixed(1)}%`;
  function table(bodyId,data){$(bodyId).innerHTML=data.map(x=>`<tr><td>${x.key}</td><td>${x.finished}</td><td>${x.wins}</td><td>${x.losses}</td><td class="${x.accuracy>=70?'good':x.accuracy<=50?'bad':'neutral'}">${pct(x.accuracy)}</td></tr>`).join('')||'<tr><td colspan="5">Sin datos suficientes</td></tr>';}
  function run(){
    if(!rows.length){alert('Primero cargue un TESTLOG JSON.');return;}
    const market=$('market').value, direction=$('direction').value, cmin=n($('confidence').value)??0, tmin=n($('timingMin').value)??-Infinity, tmax=n($('timingMax').value)??Infinity, bucket=n($('bucket').value)||100;
    let a=rows.filter(r=>(market==='ALL'||r.market===market)&&(direction==='ALL'||r.direction===direction)&&(r.confidence===null||r.confidence>=cmin)&&(r.timing===null||(r.timing>=tmin&&r.timing<=tmax)));
    if($('finishedOnly').checked)a=a.filter(r=>r.result==='WIN'||r.result==='LOSS');
    if($('autoOnly').checked)a=a.filter(r=>r.mode.includes('AUTO'));
    const s=stats(a); $('total').textContent=s.finished; $('wins').textContent=s.wins; $('losses').textContent=s.losses; $('accuracy').textContent=pct(s.accuracy); $('bestStreak').textContent=s.best; $('worstStreak').textContent=s.worst;
    const timing=group(a,r=>r.timing===null?null:`${Math.round(r.timing/bucket)*bucket>=0?'+':''}${Math.round(r.timing/bucket)*bucket} ms`).sort((x,y)=>parseInt(x.key)-parseInt(y.key));
    const markets=group(a,r=>r.market).sort((x,y)=>y.finished-x.finished); const dirs=group(a,r=>r.direction).sort((x,y)=>y.finished-x.finished);
    table('timingBody',timing);table('marketBody',markets);table('directionBody',dirs);
    const zones=timing.filter(x=>x.finished>=4).sort((a,b)=>b.accuracy-a.accuracy||b.finished-a.finished).slice(0,6);
    $('zones').innerHTML=zones.length?zones.map(z=>`<div class="zone"><strong class="${z.accuracy>=70?'good':'neutral'}">${z.key} · ${pct(z.accuracy)}</strong><small>${z.finished} operaciones · ${z.wins} G / ${z.losses} P</small></div>`).join(''):'<div class="zone">Aún no hay al menos 4 operaciones por zona de timing.</div>';
    $('opsBody').innerHTML=a.slice(-300).reverse().map(r=>`<tr><td>${r.i}</td><td>${r.market}</td><td>${r.direction}</td><td>${r.confidence??'--'}</td><td>${r.timing===null?'--':r.timing+' ms'}</td><td class="${r.result==='WIN'?'good':r.result==='LOSS'?'bad':'neutral'}">${r.result}</td></tr>`).join('');
    let msg=''; if(s.finished<20)msg=`Hay ${s.finished} operaciones finalizadas. Es una muestra pequeña; sirve para revisar funcionamiento, pero todavía no para concluir que existe una ventaja estable.`; else if(s.accuracy>=70)msg=`El filtro seleccionado alcanza ${pct(s.accuracy)} en ${s.finished} operaciones. Es una zona candidata, pero debe validarse fuera de muestra y con más operaciones antes de usarla como regla automática.`; else if(s.accuracy>55)msg=`El resultado es ${pct(s.accuracy)}. Hay una posible ventaja, pero todavía es débil y puede desaparecer con una muestra mayor.`; else msg=`El resultado es ${pct(s.accuracy)}. Con este filtro no aparece una ventaja histórica clara; conviene revisar timing, mercado, dirección y confianza.`;
    $('verdictText').textContent=msg; $('empty').hidden=true;$('results').hidden=false;
  }
  async function loadFile(file){try{const data=JSON.parse(await file.text());load(data,file.name);}catch(e){alert('No pude leer el JSON: '+e.message);}}
  function load(data,name='TESTLOG'){source=data;rows=extract(data);buildMarkets();$('badge').textContent=`${name} · ${rows.length} registros`;$('badge').classList.add('good');if(!rows.length)alert('El JSON se cargó, pero no encontré una lista de telemetría/operaciones reconocible.');else run();}
  function demo(){const ds=[]; const timings=[-300,-200,-100,0,100,200,300]; for(let i=0;i<80;i++){const t=timings[i%timings.length],dir=i%2?'ODD':'EVEN',fav=(dir==='ODD'&&t>=200)||(dir==='EVEN'&&t<=-200);ds.push({mercado:i%3?'R_50':'1HZ50V',direccion:dir,confianza:68+(i%18),timingRealMs:t,resultado:(fav?i%5!==0:i%5<2)?'GANADA':'PERDIDA',modoEjecucion:'AUTOMATICO'});} load({telemetria:ds},'EJEMPLO');}
  $('file').addEventListener('change',e=>e.target.files?.[0]&&loadFile(e.target.files[0]));$('run').addEventListener('click',run);$('demo').addEventListener('click',demo);$('reset').addEventListener('click',()=>location.reload());
})();
