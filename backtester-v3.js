let data=null;
const $=id=>document.getElementById(id);
const norm=s=>String(s??"").trim().toUpperCase();
const pick=(o,ks,d=null)=>{for(const k of ks){if(o&&o[k]!==undefined&&o[k]!==null)return o[k]}return d};
const telem=()=>Array.isArray(data?.telemetria)?data.telemetria:[];

function resultOf(x){
  const r=norm(pick(x,["resultado","result","estadoResultado","resultadoFinal","status"],""));
  if(["WIN","GANADA","GANADO","WON"].includes(r)) return "W";
  if(["LOSS","PERDIDA","PERDIDO","LOST"].includes(r)) return "L";
  return "";
}
const marketOf=x=>String(pick(x,["mercado","market","symbol","simbolo"],"DESCONOCIDO"));
const dirOf=x=>norm(pick(x,["direccion","direction","tipoDireccion","prediction"],""));
const confOf=x=>Number(pick(x,["confianza","confidence","scoreConfianza","confidencePct"],0))||0;
const timingOf=x=>Number(pick(x,["timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs","ajusteMs","calibracionMs","timing","timingOffsetMs"],0))||0;
const modeOf=x=>norm(pick(x,["modoEjecucion","executionMode","modo"],""));
const tsOf=x=>{
  const v=pick(x,["timestamp","ts","fechaHora","createdAt","time","hora"],null);
  if(v===null) return null;
  const n=typeof v==="number"?v:Date.parse(v);
  return Number.isFinite(n)?n:null;
};
function classification(x){
  let v=pick(x,["clasificacionPatron","patternClassification","clasificacion","classification","memoryClassification","historicalClassification","decisionHistorica","patternClass"],null);
  if(v) return norm(v);
  const p=pick(x,["patron","pattern","patternInfo","memoriaPatron","memoryPattern"],null);
  if(p&&typeof p==="object"){
    v=pick(p,["clasificacion","classification","clase","status"],null);
    if(v) return norm(v);
  }
  return "SIN DATO";
}
const bucket=(v,n)=>Math.round(v/n)*n;
const cbucket=(v,n)=>Math.floor(Math.max(0,Math.min(100,v))/n)*n;
const pct=(w,n)=>n?100*w/n:0;

function populate(){
  const ms=[...new Set(telem().map(marketOf))].sort();
  $("market").innerHTML='<option value="">Todos</option>'+ms.map(m=>`<option>${m}</option>`).join("");
}
$("file").onchange=async e=>{
  const f=e.target.files[0]; if(!f)return;
  try{
    data=JSON.parse(await f.text());
    $("fileState").textContent=`${f.name} · ${telem().length} registros`;
    $("summary").textContent=`TESTLOG cargado · ${telem().length} registros.`;
    populate();
  }catch(err){alert("No se pudo leer el JSON: "+err.message)}
};
$("clear").onclick=()=>{
  data=null;$("file").value="";$("fileState").textContent="SIN ARCHIVO";
  $("summary").textContent="Cargue el TESTLOG para comenzar.";$("results").classList.add("hidden");
};

function buildGroups(rows,tb,cb){
  const map=new Map();
  for(const x of rows){
    const r=resultOf(x), t=bucket(timingOf(x),tb), c=cbucket(confOf(x),cb), cl=classification(x);
    const k=[marketOf(x),dirOf(x),t,c,cl].join("|");
    if(!map.has(k)) map.set(k,{key:k,market:marketOf(x),dir:dirOf(x),t,c,cl,n:0,w:0,l:0});
    const g=map.get(k); g.n++; r==="W"?g.w++:g.l++;
  }
  return map;
}
function evalRule(rows,rule,tb,cb){
  let n=0,w=0,l=0;
  for(const x of rows){
    if(marketOf(x)!==rule.market||dirOf(x)!==rule.dir)continue;
    if(bucket(timingOf(x),tb)!==rule.t)continue;
    if(cbucket(confOf(x),cb)!==rule.c)continue;
    if(classification(x)!==rule.cl)continue;
    const r=resultOf(x); if(!r)continue;
    n++; r==="W"?w++:l++;
  }
  return {n,w,l,p:pct(w,n)};
}
function ruleCard(rule,tr,te,drop,maxDrop,ok,idx,cb){
  const cls=ok?"good":"bad", label=ok?"VALIDADA":"NO VALIDÓ", dcls=drop<=0?"up":"down";
  return `<div class="rule ${cls}">
    <div class="ruleTop"><div class="ruleTitle">#${idx+1} ${rule.market} · ${rule.dir}</div><div class="status ${cls}">${label}</div></div>
    <div class="tags"><span class="tag">${rule.t>=0?"+":""}${rule.t} ms</span><span class="tag">Conf. ${rule.c}–${Math.min(100,rule.c+cb-1)}%</span><span class="tag">${rule.cl}</span></div>
    <div class="metrics">
      <div class="metric"><small>TRAIN</small><b>${tr.w}/${tr.n} · ${tr.p.toFixed(1)}%</b></div>
      <div class="metric"><small>TEST</small><b>${te.w}/${te.n} · ${te.p.toFixed(1)}%</b></div>
      <div class="metric"><small>Caída</small><b class="delta ${dcls}">${drop>=0?"-":"+"}${Math.abs(drop).toFixed(1)} pts</b></div>
      <div class="metric"><small>Muestra TEST</small><b>${te.n}</b></div>
    </div>
  </div>`;
}

function keyAgg(rows,d,t,tb){
  const a=rows.filter(x=>marketOf(x)==="R_50"&&dirOf(x)===d&&bucket(timingOf(x),tb)===t);
  const w=a.filter(x=>resultOf(x)==="W").length;
  return {n:a.length,w,l:a.length-w,p:pct(w,a.length)};
}
function walkBlocks(rows,tb){
  let ordered=[...rows];
  ordered.sort((a,b)=>{
    const ta=tsOf(a),tbx=tsOf(b);
    if(ta!==null&&tbx!==null)return ta-tbx;
    return 0;
  });
  const out=[];
  for(let i=0;i<4;i++){
    const s=Math.floor(ordered.length*i/4), e=Math.floor(ordered.length*(i+1)/4);
    const block=ordered.slice(s,e);
    out.push({
      i:i+1,
      even0:keyAgg(block,"EVEN",0,tb),
      even100:keyAgg(block,"EVEN",100,tb),
      odd300:keyAgg(block,"ODD",300,tb)
    });
  }
  return out;
}

$("run").onclick=()=>{
  if(!data)return alert("Primero cargue el TESTLOG.");
  const M=$("market").value,D=$("direction").value,trainPct=(+$("trainPct").value||70)/100;
  const minTrain=+$("minTrain").value||30,minTest=+$("minTest").value||15,tb=+$("bucket").value||100,cb=+$("confBucket").value||10,top=+$("topN").value||15,maxDrop=+$("maxDrop").value||8;

  let rows=telem().filter(x=>{
    const r=resultOf(x); if($("finalOnly").checked&&!r)return false;
    if($("autoOnly").checked&&!["AUTOMATICO","AUTOMÁTICO"].includes(modeOf(x)))return false;
    if(M&&marketOf(x)!==M)return false; if(D&&dirOf(x)!==D)return false;
    return !!r;
  });

  rows=[...rows].sort((a,b)=>{
    const ta=tsOf(a),tbx=tsOf(b);
    if(ta!==null&&tbx!==null)return ta-tbx;
    return 0;
  });
  const cut=Math.max(1,Math.min(rows.length-1,Math.floor(rows.length*trainPct)));
  const train=rows.slice(0,cut), test=rows.slice(cut);

  const groups=buildGroups(train,tb,cb);
  let candidates=[...groups.values()].filter(g=>g.n>=minTrain).sort((a,b)=>pct(b.w,b.n)-pct(a.w,a.n)||b.n-a.n).slice(0,top*3);

  const evaluated=candidates.map(rule=>{
    const tr={n:rule.n,w:rule.w,l:rule.l,p:pct(rule.w,rule.n)};
    const te=evalRule(test,rule,tb,cb);
    const drop=tr.p-te.p;
    const ok=te.n>=minTest && drop<=maxDrop && te.p>=50;
    return {rule,tr,te,drop,ok};
  }).sort((a,b)=>(b.ok-a.ok)||(b.te.p-a.te.p)||(b.te.n-a.te.n));

  const surv=evaluated.filter(x=>x.ok).slice(0,top);
  const fail=evaluated.filter(x=>!x.ok).slice(0,top);
  $("survivors").innerHTML=surv.length?surv.map((x,i)=>ruleCard(x.rule,x.tr,x.te,x.drop,maxDrop,true,i,cb)).join(""):"<p>Ninguna regla superó los criterios actuales.</p>";
  $("failed").innerHTML=fail.length?fail.map((x,i)=>ruleCard(x.rule,x.tr,x.te,x.drop,maxDrop,false,i,cb)).join(""):"<p>No hay reglas fallidas entre las candidatas mostradas.</p>";

  const keys=[
    ["EVEN",0],["EVEN",100],["ODD",300]
  ].map(([d,t])=>{
    const tr=keyAgg(train,d,t,tb),te=keyAgg(test,d,t,tb);
    return `<div class="rule"><div class="ruleTitle">R_50 · ${d} · ${t>=0?"+":""}${t} ms</div>
    <div class="metrics"><div class="metric"><small>TRAIN</small><b>${tr.w}/${tr.n} · ${tr.p.toFixed(1)}%</b></div>
    <div class="metric"><small>TEST</small><b>${te.w}/${te.n} · ${te.p.toFixed(1)}%</b></div>
    <div class="metric"><small>Ops TEST</small><b>${te.n}</b></div>
    <div class="metric"><small>Diferencia</small><b>${(te.p-tr.p)>=0?"+":""}${(te.p-tr.p).toFixed(1)} pts</b></div></div></div>`;
  }).join("");
  $("keyCompare").innerHTML=keys;

  $("walk").innerHTML=walkBlocks(rows,tb).map(b=>`<div class="block"><b>Bloque ${b.i}</b><br>
  EVEN 0 ms: ${b.even0.w}/${b.even0.n} · ${b.even0.p.toFixed(1)}%<br>
  EVEN +100 ms: ${b.even100.w}/${b.even100.n} · ${b.even100.p.toFixed(1)}%<br>
  ODD +300 ms: ${b.odd300.w}/${b.odd300.n} · ${b.odd300.p.toFixed(1)}%</div>`).join("");

  $("summary").innerHTML=`Total analizado: <b>${rows.length}</b> operaciones · TRAIN: <b>${train.length}</b> · TEST: <b>${test.length}</b> · Reglas validadas: <b>${surv.length}</b>.`;
  $("results").classList.remove("hidden");
  $("summary").scrollIntoView({behavior:"smooth"});
};