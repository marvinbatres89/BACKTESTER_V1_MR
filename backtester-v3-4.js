let DATA=null;
const $=x=>document.getElementById(x),N=x=>String(x??"").trim().toUpperCase();
const get=(o,ks,d=null)=>{for(const k of ks)if(o&&o[k]!=null)return o[k];return d};
const rows=()=>Array.isArray(DATA?.telemetria)?DATA.telemetria:[];

const result=x=>{
  let r=N(get(x,["resultado","result","estadoResultado","resultadoFinal","status"],""));
  return ["WIN","GANADA","GANADO","WON"].includes(r)?"W":
         ["LOSS","PERDIDA","PERDIDO","LOST"].includes(r)?"L":""
};

const market=x=>String(get(x,["mercado","market","symbol","simbolo"],"DESCONOCIDO"));
const direction=x=>N(get(x,["direccion","direction","tipoDireccion","prediction"],""));
const confidence=x=>Number(get(x,["confianza","confidence","scoreConfianza","confidencePct"],0))||0;
const timing=x=>Number(get(x,["timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs","ajusteMs","calibracionMs","timing","timingOffsetMs"],0))||0;
const time=x=>{
  let v=get(x,["timestamp","ts","fechaHora","createdAt","time","hora"],null);
  let n=typeof v==="number"?v:Date.parse(v);
  return Number.isFinite(n)?n:null
};

const buck=(v,n)=>Math.round(v/n)*n;
const cbuck=(v,n)=>Math.floor(Math.max(0,Math.min(100,v))/n)*n;
const pct=(w,n)=>n?100*w/n:0;
function stat(a){let w=a.filter(x=>result(x)==="W").length;return{n:a.length,w,l:a.length-w,p:pct(w,a.length)}}

/* Todo lo que pueda aparecer después de decidir o ejecutar queda fuera */
const BLOCK_PATTERNS = [
  /profit/i,/ganancia/i,/beneficio/i,/pnl/i,/netprofit/i,
  /resultado/i,/result/i,/outcome/i,/won/i,/lost/i,/win/i,/loss/i,
  /payout/i,/retorno/i,/return/i,
  /sell/i,/venta/i,/exit/i,/salida/i,/close/i,/cierre/i,
  /contract.*status/i,/estado.*contrato/i,/is_sold/i,/sold/i,
  /buy_price/i,/sell_price/i,/entry_spot/i,/exit_spot/i,
  /settlement/i,/settled/i,/final/i,/finished/i,/ended/i,
  /manualResult/i,/resultadoManual/i,/lastResult/i,/ultimoResultado/i,
  /balanceAfter/i,/saldoDespues/i,/durationReal/i,/duracionReal/i,

  /buy/i,/purchase/i,/compr/i,/proposal.*received/i,/proposalReceived/i,
  /confirm/i,/confirmed/i,/confirmation/i,/confirmacion/i,
  /execution/i,/ejecucion/i,/executed/i,/execute/i,
  /manualClick/i,/clickToBuy/i,/latency.*buy/i,/buyLatency/i,
  /transaction/i,/contractId/i,/contract_id/i,/proposalId/i,/proposal_id/i,
  /openContract/i,/monitorContract/i,/entryEpoch/i,/entryTime/i,
  /buyEpoch/i,/buyTime/i,/buyConfirmedEpoch/i,/buyConfirmedAt/i
];

const BASE_SKIP = new Set([
  "resultado","result","estadoResultado","resultadoFinal","status",
  "mercado","market","symbol","simbolo",
  "direccion","direction","tipoDireccion","prediction",
  "confianza","confidence","scoreConfianza","confidencePct",
  "timestamp","ts","fechaHora","createdAt","time","hora",
  "timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs",
  "ajusteMs","calibracionMs","timing","timingOffsetMs"
]);

function isBlockedPath(path){
  let simple=path.split(".").pop();
  if(BASE_SKIP.has(simple))return true;
  return BLOCK_PATTERNS.some(rx=>rx.test(path));
}

function primitiveFeatures(x,audit=null){
  let out={};
  function scan(o,p="",depth=0){
    if(!o||typeof o!=="object"||depth>2)return;
    for(const [k,v] of Object.entries(o)){
      let key=p?p+"."+k:k;

      if(isBlockedPath(key)){
        if(audit)audit.blocked.add(key);
        continue;
      }

      if(v==null)continue;

      if(typeof v==="string"||typeof v==="boolean"){
        let s=String(v);
        if(s.length<=40){
          out[key]=N(s);
          if(audit)audit.allowed.add(key);
        }
      }else if(typeof v==="number"&&Number.isFinite(v)){
        out[key]=v;
        if(audit)audit.allowed.add(key);
      }else if(typeof v==="object"&&!Array.isArray(v)){
        scan(v,key,depth+1);
      }
    }
  }
  scan(x);
  return out;
}

function candidates(train,minN,audit){
  let maps=new Map();

  for(const x of train){
    let f=primitiveFeatures(x,audit);

    for(const [k,v] of Object.entries(f)){
      let val;
      if(typeof v==="number"){
        let step=Math.abs(v)<=1?0.1:
                 Math.abs(v)<=10?1:
                 Math.abs(v)<=100?10:100;
        val="≈"+(Math.round(v/step)*step);
      }else{
        val=v;
      }

      let id=k+"="+val;
      if(!maps.has(id))maps.set(id,{key:k,val,train:[]});
      maps.get(id).train.push(x);
    }
  }

  return [...maps.values()]
    .filter(c=>c.train.length>=minN&&c.train.length<train.length*.9)
    .map(c=>({...c,s:stat(c.train)}))
    .sort((a,b)=>b.s.p-a.s.p||b.s.n-a.s.n)
    .slice(0,120);
}

function matchFeature(x,c){
  let f=primitiveFeatures(x);
  let v=f[c.key];
  if(v==null)return false;

  if(typeof v==="number"&&String(c.val).startsWith("≈")){
    let target=Number(String(c.val).slice(1));
    let step=Math.abs(v)<=1?.1:
             Math.abs(v)<=10?1:
             Math.abs(v)<=100?10:100;
    return Math.round(v/step)*step===target;
  }

  return v===c.val;
}

function baseGroups(a,tb,cb){
  let m=new Map();

  for(const x of a){
    if(!result(x))continue;

    let r={
      m:market(x),
      d:direction(x),
      t:buck(timing(x),tb),
      c:cbuck(confidence(x),cb)
    };

    let k=[r.m,r.d,r.t,r.c].join("|");
    if(!m.has(k))m.set(k,{...r,a:[]});
    m.get(k).a.push(x);
  }

  return [...m.values()];
}

function baseMatch(x,r,tb,cb){
  return market(x)===r.m &&
         direction(x)===r.d &&
         buck(timing(x),tb)===r.t &&
         cbuck(confidence(x),cb)===r.c;
}

function walkStats(all,c,B){
  let wa=all.filter(x=>matchFeature(x,c));
  let blocks=[];

  for(let i=0;i<B;i++){
    let a=Math.floor(wa.length*i/B);
    let b=Math.floor(wa.length*(i+1)/B);
    blocks.push(stat(wa.slice(a,b)));
  }

  let non=blocks.filter(x=>x.n>0);
  let total=stat(wa);
  let min=non.length?Math.min(...non.map(x=>x.p)):0;
  let max=non.length?Math.max(...non.map(x=>x.p)):0;
  let spread=max-min;

  return {wa,blocks,total,min,max,spread,coverage:non.length/B};
}

$("file").onchange=async e=>{
  let f=e.target.files[0];
  if(!f)return;

  try{
    DATA=JSON.parse(await f.text());
    $("fileState").textContent=f.name+" · "+rows().length+" registros";

    let ms=[...new Set(rows().map(market))].sort();
    $("market").innerHTML='<option value="">Todos</option>'+ms.map(x=>`<option>${x}</option>`).join("");

    $("summary").textContent="TESTLOG cargado correctamente.";
  }catch(e){
    alert("No se pudo leer el JSON: "+e.message);
  }
};

$("clear").onclick=()=>{
  DATA=null;
  $("file").value="";
  $("results").classList.add("hidden");
  $("fileState").textContent="SIN ARCHIVO";
};

$("run").onclick=()=>{
  if(!DATA)return alert("Primero cargue el TESTLOG.");

  let M=$("market").value;
  let D=$("direction").value;
  let tp=(+$("trainPct").value||70)/100;
  let minTr=+$("minTrain").value||30;
  let minTe=+$("minTest").value||15;
  let minST=+$("minSubTrain").value||18;
  let minSE=+$("minSubTest").value||12;
  let minTestAcc=+$("minTestAcc").value||58;
  let minWorst=+$("minWorstBlock").value||50;
  let maxSpread=+$("maxSpread").value||20;
  let tb=+$("bucket").value||100;
  let cb=+$("confBucket").value||10;
  let B=+$("blocks").value||4;

  let all=rows().filter(x=>
    result(x) &&
    (!M||market(x)===M) &&
    (!D||direction(x)===D)
  );

  let hasTime=all.length>0&&all.every(x=>time(x)!=null);
  if(hasTime)all=[...all].sort((a,b)=>time(a)-time(b));

  let cut=Math.floor(all.length*tp);
  let tr=all.slice(0,cut);
  let te=all.slice(cut);

  let bases=baseGroups(tr,tb,cb)
    .filter(g=>g.a.length>=minTr)
    .map(g=>{
      let s=stat(g.a);
      let test=stat(te.filter(x=>baseMatch(x,g,tb,cb)));
      return{g,s,test};
    })
    .filter(z=>z.test.n>=minTe&&z.test.p>=50&&z.s.p-z.test.p<=8)
    .sort((a,b)=>b.test.p-a.test.p||b.test.n-a.test.n);

  if(!bases.length){
    $("base").innerHTML="<p>No hubo regla base validada.</p>";
    $("audit").innerHTML="";
    $("subs").innerHTML="";
    $("walk").innerHTML="";
    $("finalClass").innerHTML="<div class='status no'>SIN REGLA</div>";
    $("diag").innerHTML="";
    $("results").classList.remove("hidden");
    return;
  }

  let base=bases[0],g=base.g;
  let baseAll=all.filter(x=>baseMatch(x,g,tb,cb));
  let baseTr=tr.filter(x=>baseMatch(x,g,tb,cb));
  let baseTe=te.filter(x=>baseMatch(x,g,tb,cb));

  $("base").innerHTML=
  `<div class="rule good">
    <div class="title">${g.m} · ${g.d} · ${g.t>=0?"+":""}${g.t} ms · Conf. ${g.c}–${Math.min(100,g.c+cb-1)}%</div>
    <div class="metrics">
      <div class="metric"><small>TRAIN</small><b>${base.s.w}/${base.s.n} · ${base.s.p.toFixed(1)}%</b></div>
      <div class="metric"><small>TEST</small><b>${base.test.w}/${base.test.n} · ${base.test.p.toFixed(1)}%</b></div>
      <div class="metric"><small>Cambio</small><b>${(base.test.p-base.s.p)>=0?"+":""}${(base.test.p-base.s.p).toFixed(1)} pts</b></div>
      <div class="metric"><small>TEST ops</small><b>${base.test.n}</b></div>
    </div>
  </div>`;

  let audit={blocked:new Set(),allowed:new Set()};
  let cs=candidates(baseTr,minST,audit);

  $("audit").innerHTML=
  `<div class="notice">
    <b>Bloqueados detectados:</b> ${audit.blocked.size}<br>
    <b>Permitidos detectados:</b> ${audit.allowed.size}
  </div>
  <h3>Bloqueados</h3>
  <div class="auditList">${[...audit.blocked].sort().map(x=>`<span class="blocked">${x}</span>`).join("")||"<span class='tag'>Ninguno detectado</span>"}</div>
  <h3>Permitidos pre-entry</h3>
  <div class="auditList">${[...audit.allowed].sort().slice(0,100).map(x=>`<span class="allowed">${x}</span>`).join("")||"<span class='tag'>Ninguno</span>"}</div>`;

  let evaluated=[];

  for(const c of cs){
    let se=stat(baseTe.filter(x=>matchFeature(x,c)));
    if(se.n<minSE)continue;

    let wf=walkStats(baseAll,c,B);
    let passTest=se.p>=minTestAcc;
    let passWorst=wf.min>=minWorst;
    let passSpread=wf.spread<=maxSpread;
    let passCoverage=wf.coverage===1;

    let score=
      se.p*0.45 +
      wf.total.p*0.25 +
      wf.min*0.20 -
      wf.spread*0.20 +
      Math.min(se.n,30)*0.25;

    evaluated.push({
      ...c,
      se,wf,
      passTest,passWorst,passSpread,passCoverage,
      passed:passTest&&passWorst&&passSpread&&passCoverage,
      score
    });
  }

  evaluated.sort((a,b)=>
    Number(b.passed)-Number(a.passed) ||
    b.score-a.score ||
    b.se.n-a.se.n
  );

  let top=evaluated.slice(0,10);

  $("subs").innerHTML=top.length
  ? top.map((c,i)=>
    `<div class="rule ${c.passed?"good":"warnRule"}">
      <div class="title">#${i+1} ${c.key} = ${c.val}</div>
      <div class="metrics">
        <div class="metric"><small>TRAIN</small><b>${c.s.w}/${c.s.n} · ${c.s.p.toFixed(1)}%</b></div>
        <div class="metric"><small>TEST</small><b>${c.se.w}/${c.se.n} · ${c.se.p.toFixed(1)}%</b></div>
        <div class="metric"><small>Peor bloque</small><b>${c.wf.min.toFixed(1)}%</b></div>
        <div class="metric"><small>Variación</small><b>${c.wf.spread.toFixed(1)} pts</b></div>
      </div>
      <div class="tags">
        <span class="tag">${c.passTest?"TEST OK":"TEST NO"}</span>
        <span class="tag">${c.passWorst?"PEOR BLOQUE OK":"PEOR BLOQUE NO"}</span>
        <span class="tag">${c.passSpread?"ESTABILIDAD OK":"VARIACIÓN ALTA"}</span>
        <span class="tag">${c.passCoverage?"COBERTURA 100%":"COBERTURA INCOMPLETA"}</span>
      </div>
    </div>`
  ).join("")
  : "<div class='notice'>No hubo subfiltros con muestra TEST suficiente.</div>";

  let best=top.find(x=>x.passed)||top[0];

  if(best){
    $("walk").innerHTML=
    `<div class="rule ${best.passed?"good":"warnRule"}">
      <div class="title">${best.key} = ${best.val}</div>
      ${best.wf.blocks.map((s,i)=>
        `<div class="block">
          <b>Bloque ${i+1}</b> · ${s.n?`${s.w}/${s.n} · ${s.p.toFixed(1)}%`:"SIN MUESTRA"}
          <div class="bar"><div class="fill" style="width:${s.p}%"></div></div>
        </div>`
      ).join("")}
      <div class="metrics">
        <div class="metric"><small>Total</small><b>${best.wf.total.w}/${best.wf.total.n} · ${best.wf.total.p.toFixed(1)}%</b></div>
        <div class="metric"><small>Peor bloque</small><b>${best.wf.min.toFixed(1)}%</b></div>
        <div class="metric"><small>Mejor bloque</small><b>${best.wf.max.toFixed(1)}%</b></div>
        <div class="metric"><small>Variación</small><b>${best.wf.spread.toFixed(1)} pts</b></div>
      </div>
    </div>`;
  }else{
    $("walk").innerHTML="<p>Sin candidato para walk-forward.</p>";
  }

  let passed=top.filter(x=>x.passed);

  if(passed.length){
    $("finalClass").innerHTML=
    `<div class="status ok">CANDIDATO ESTABLE</div>
     <p>${passed[0].key} = ${passed[0].val} superó TEST, peor bloque, variación máxima y cobertura temporal.</p>`;
  }else if(top.length){
    $("finalClass").innerHTML=
    `<div class="status mid">TODAVÍA INSUFICIENTE</div>
     <p>Hay candidatos interesantes, pero ninguno cumple todas las condiciones mínimas de estabilidad.</p>`;
  }else{
    $("finalClass").innerHTML=
    `<div class="status no">SIN CANDIDATO</div>`;
  }

  $("diag").innerHTML=
  `<div class="notice">
    <b>Orden cronológico:</b> ${hasTime?"timestamp detectado":"orden original del TESTLOG"}.<br>
    <b>Regla base:</b> ${baseAll.length} operaciones.<br>
    <b>Candidatos pre-entry examinados:</b> ${cs.length}.<br>
    <b>Campos bloqueados:</b> ${audit.blocked.size}.<br>
    <b>Candidatos con TEST suficiente:</b> ${evaluated.length}.<br>
    <b>Candidatos que pasan todos los filtros:</b> ${passed.length}.<br><br>
    La V3.4 no considera una regla estable solo por tener un porcentaje alto. También exige muestra mínima, peor bloque aceptable, variación limitada y cobertura completa.
  </div>`;

  $("summary").innerHTML=
  `Analizadas <b>${all.length}</b> · TRAIN <b>${tr.length}</b> · TEST <b>${te.length}</b> · Regla base validada <b>1</b> · Candidatos estables <b>${passed.length}</b>.`;

  $("results").classList.remove("hidden");
  $("summary").scrollIntoView({behavior:"smooth"});
};
