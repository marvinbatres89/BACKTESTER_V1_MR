let DATA=null;
const $=x=>document.getElementById(x),N=x=>String(x??"").trim().toUpperCase();
const get=(o,ks,d=null)=>{for(const k of ks)if(o&&o[k]!=null)return o[k];return d};
const rows=()=>Array.isArray(DATA?.telemetria)?DATA.telemetria:[];
const result=x=>{let r=N(get(x,["resultado","result","estadoResultado","resultadoFinal","status"],""));return["WIN","GANADA","GANADO","WON"].includes(r)?"W":["LOSS","PERDIDA","PERDIDO","LOST"].includes(r)?"L":""};
const market=x=>String(get(x,["mercado","market","symbol","simbolo"],"DESCONOCIDO"));
const direction=x=>N(get(x,["direccion","direction","tipoDireccion","prediction"],""));
const confidence=x=>Number(get(x,["confianza","confidence","scoreConfianza","confidencePct"],0))||0;
const timing=x=>Number(get(x,["timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs","ajusteMs","calibracionMs","timing","timingOffsetMs"],0))||0;
const time=x=>{let v=get(x,["timestamp","ts","fechaHora","createdAt","time","hora"],null),n=typeof v==="number"?v:Date.parse(v);return Number.isFinite(n)?n:null};
const buck=(v,n)=>Math.round(v/n)*n,cbuck=(v,n)=>Math.floor(Math.max(0,Math.min(100,v))/n)*n,pct=(w,n)=>n?100*w/n:0;
function stat(a){let w=a.filter(x=>result(x)==="W").length;return{n:a.length,w,l:a.length-w,p:pct(w,a.length)}}
function baseGroups(a,tb,cb){let m=new Map();for(const x of a){if(!result(x))continue;let r={m:market(x),d:direction(x),t:buck(timing(x),tb),c:cbuck(confidence(x),cb)},k=[r.m,r.d,r.t,r.c].join("|");if(!m.has(k))m.set(k,{...r,a:[]});m.get(k).a.push(x)}return[...m.values()]}
function baseMatch(x,r,tb,cb){return market(x)===r.m&&direction(x)===r.d&&buck(timing(x),tb)===r.t&&cbuck(confidence(x),cb)===r.c}

function blocksStats(a,B){
  let out=[];
  for(let i=0;i<B;i++){
    let s=Math.floor(a.length*i/B),e=Math.floor(a.length*(i+1)/B);
    out.push(stat(a.slice(s,e)));
  }
  return out;
}

function expandingStats(a,B){
  let out=[];
  for(let i=1;i<=B;i++){
    let e=Math.floor(a.length*i/B);
    out.push(stat(a.slice(0,e)));
  }
  return out;
}

function rollingStats(a,size,step){
  let out=[];
  if(a.length<size)return out;
  for(let s=0;s+size<=a.length;s+=step){
    out.push({start:s+1,end:s+size,...stat(a.slice(s,s+size))});
  }
  if(out.length && out[out.length-1].end<a.length){
    let s=Math.max(0,a.length-size);
    out.push({start:s+1,end:a.length,...stat(a.slice(s))});
  }
  return out;
}

function calcStability(blocks,minN,minStable,minWorst,maxSpread){
  let valid=blocks.filter(b=>b.n>=minN);
  let coverage=blocks.length?valid.length/blocks.length:0;
  let min=valid.length?Math.min(...valid.map(b=>b.p)):0;
  let max=valid.length?Math.max(...valid.map(b=>b.p)):0;
  let avg=valid.length?valid.reduce((s,b)=>s+b.p,0)/valid.length:0;
  let spread=max-min;
  let passCount=valid.filter(b=>b.p>=minStable).length;
  let passRatio=valid.length?passCount/valid.length:0;
  return {valid,coverage,min,max,avg,spread,passRatio,pass:coverage===1&&min>=minWorst&&spread<=maxSpread&&passRatio>=0.8};
}

$("file").onchange=async e=>{
  let f=e.target.files[0]; if(!f)return;
  try{
    DATA=JSON.parse(await f.text());
    $("fileState").textContent=f.name+" · "+rows().length+" registros";
    let ms=[...new Set(rows().map(market))].sort();
    $("market").innerHTML='<option value="">Todos</option>'+ms.map(x=>`<option>${x}</option>`).join("");
    $("summary").textContent="TESTLOG cargado correctamente.";
  }catch(e){alert("No se pudo leer el JSON: "+e.message)}
};

$("clear").onclick=()=>{
  DATA=null;$("file").value="";$("results").classList.add("hidden");$("fileState").textContent="SIN ARCHIVO";
};

$("run").onclick=()=>{
  if(!DATA)return alert("Primero cargue el TESTLOG.");

  let M=$("market").value,D=$("direction").value,tp=(+$("trainPct").value||70)/100,
      minTr=+$("minTrain").value||30,minTe=+$("minTest").value||15,
      tb=+$("bucket").value||100,cb=+$("confBucket").value||10,
      B=+$("blocks").value||5,minBlockN=+$("minBlockN").value||10,
      minStable=+$("minStableAcc").value||55,minWorst=+$("minWorst").value||50,
      maxSpread=+$("maxSpread").value||20,rollSize=+$("rollingSize").value||20,
      rollStep=+$("rollingStep").value||5;

  let all=rows().filter(x=>result(x)&&(!M||market(x)===M)&&(!D||direction(x)===D));
  let hasTime=all.length>0&&all.every(x=>time(x)!=null);
  if(hasTime)all=[...all].sort((a,b)=>time(a)-time(b));

  let cut=Math.floor(all.length*tp),tr=all.slice(0,cut),te=all.slice(cut);

  let bases=baseGroups(tr,tb,cb)
    .filter(g=>g.a.length>=minTr)
    .map(g=>({g,s:stat(g.a),test:stat(te.filter(x=>baseMatch(x,g,tb,cb)))}))
    .filter(z=>z.test.n>=minTe&&z.test.p>=50&&z.s.p-z.test.p<=8)
    .sort((a,b)=>b.test.p-a.test.p||b.test.n-a.test.n);

  if(!bases.length){
    $("base").innerHTML="<p>No hubo regla base validada.</p>";
    $("decision").innerHTML="<div class='status no'>SIN REGLA</div>";
    $("results").classList.remove("hidden");
    return;
  }

  let base=bases[0],g=base.g,baseAll=all.filter(x=>baseMatch(x,g,tb,cb)),baseS=stat(baseAll);

  $("base").innerHTML=
    `<div class="rule good">
      <div class="title">${g.m} · ${g.d} · ${g.t>=0?"+":""}${g.t} ms · Conf. ${g.c}–${Math.min(100,g.c+cb-1)}%</div>
      <div class="metrics">
        <div class="metric"><small>TRAIN</small><b>${base.s.w}/${base.s.n} · ${base.s.p.toFixed(1)}%</b></div>
        <div class="metric"><small>TEST</small><b>${base.test.w}/${base.test.n} · ${base.test.p.toFixed(1)}%</b></div>
        <div class="metric"><small>Total</small><b>${baseS.w}/${baseS.n} · ${baseS.p.toFixed(1)}%</b></div>
        <div class="metric"><small>Operaciones</small><b>${baseS.n}</b></div>
      </div>
    </div>`;

  let bs=blocksStats(baseAll,B),stab=calcStability(bs,minBlockN,minStable,minWorst,maxSpread);
  $("blocksOut").innerHTML=
    `<div class="rule ${stab.pass?"good":"warnRule"}">
      ${bs.map((s,i)=>`<div class="block"><b>Bloque ${i+1}</b> · ${s.n?`${s.w}/${s.n} · ${s.p.toFixed(1)}%`:"SIN MUESTRA"}<div class="bar"><div class="fill" style="width:${s.p}%"></div></div></div>`).join("")}
      <div class="metrics">
        <div class="metric"><small>Promedio</small><b>${stab.avg.toFixed(1)}%</b></div>
        <div class="metric"><small>Peor bloque</small><b>${stab.min.toFixed(1)}%</b></div>
        <div class="metric"><small>Variación</small><b>${stab.spread.toFixed(1)} pts</b></div>
        <div class="metric"><small>Bloques ≥ ${minStable}%</small><b>${Math.round(stab.passRatio*100)}%</b></div>
      </div>
    </div>`;

  let ex=expandingStats(baseAll,B);
  $("expanding").innerHTML=
    `<div class="tableWrap"><table><thead><tr><th>Acumulado</th><th>W/L</th><th>Exactitud</th><th>N</th></tr></thead><tbody>
    ${ex.map((s,i)=>`<tr><td>Hasta bloque ${i+1}</td><td>${s.w}/${s.l}</td><td>${s.p.toFixed(1)}%</td><td>${s.n}</td></tr>`).join("")}
    </tbody></table></div>`;

  let ro=rollingStats(baseAll,rollSize,rollStep);
  let roValid=ro.filter(x=>x.n>=Math.min(minBlockN,rollSize));
  let roMin=roValid.length?Math.min(...roValid.map(x=>x.p)):0;
  let roMax=roValid.length?Math.max(...roValid.map(x=>x.p)):0;
  let roAvg=roValid.length?roValid.reduce((s,x)=>s+x.p,0)/roValid.length:0;
  let roBelow=roValid.filter(x=>x.p<minStable).length;
  $("rolling").innerHTML=ro.length?
    `<div class="tableWrap"><table><thead><tr><th>Ventana</th><th>W/L</th><th>Exactitud</th></tr></thead><tbody>
    ${ro.map(x=>`<tr><td>${x.start}–${x.end}</td><td>${x.w}/${x.l}</td><td>${x.p.toFixed(1)}%</td></tr>`).join("")}
    </tbody></table></div>
    <div class="metrics">
      <div class="metric"><small>Promedio ventanas</small><b>${roAvg.toFixed(1)}%</b></div>
      <div class="metric"><small>Peor ventana</small><b>${roMin.toFixed(1)}%</b></div>
      <div class="metric"><small>Mejor ventana</small><b>${roMax.toFixed(1)}%</b></div>
      <div class="metric"><small>Ventanas bajo ${minStable}%</small><b>${roBelow}/${roValid.length}</b></div>
    </div>`
    : "<div class='notice'>No hay suficientes operaciones para formar ventanas móviles con el tamaño seleccionado.</div>";

  let lastHalf=stat(baseAll.slice(Math.floor(baseAll.length/2)));
  let firstHalf=stat(baseAll.slice(0,Math.floor(baseAll.length/2)));
  let halfDiff=lastHalf.p-firstHalf.p;
  let rollingPass=roValid.length>0 && roBelow/roValid.length<=0.30 && roMin>=45;
  let expandingLast=ex.length?ex[ex.length-1].p:0;
  let overallPass=stab.pass && rollingPass && Math.abs(halfDiff)<=10 && expandingLast>=minStable;

  if(overallPass){
    $("decision").innerHTML=
      `<div class="status ok">PERSISTENCIA TEMPORAL ACEPTABLE</div>
       <p>La regla mantiene comportamiento razonablemente consistente entre bloques, ventanas móviles y acumulación temporal. Esto no garantiza rendimiento futuro, pero supera la prueba de persistencia configurada.</p>`;
  }else if(stab.pass || rollingPass){
    $("decision").innerHTML=
      `<div class="status mid">PERSISTENCIA PARCIAL</div>
       <p>La regla conserva parte de su ventaja, pero todavía muestra inestabilidad en alguna de las pruebas temporales.</p>`;
  }else{
    $("decision").innerHTML=
      `<div class="status no">NO PERSISTENTE</div>
       <p>El rendimiento cambia demasiado entre períodos. No conviene trasladar esta regla al BOT todavía.</p>`;
  }

  $("diag").innerHTML=
    `<div class="notice">
      <b>Orden temporal:</b> ${hasTime?"timestamp detectado":"orden original del TESTLOG"}.<br>
      <b>Regla base:</b> ${baseS.n} operaciones.<br>
      <b>Primera mitad:</b> ${firstHalf.w}/${firstHalf.n} · ${firstHalf.p.toFixed(1)}%.<br>
      <b>Segunda mitad:</b> ${lastHalf.w}/${lastHalf.n} · ${lastHalf.p.toFixed(1)}%.<br>
      <b>Cambio segunda vs primera:</b> ${halfDiff>=0?"+":""}${halfDiff.toFixed(1)} pts.<br>
      <b>Bloques consecutivos:</b> ${B}.<br>
      <b>Ventanas móviles:</b> ${ro.length}.<br><br>
      La V3.6 evalúa persistencia temporal de la regla base. No busca nuevos filtros.
    </div>`;

  $("summary").innerHTML=
    `Analizadas <b>${all.length}</b> operaciones · regla base <b>${baseS.n}</b> operaciones · exactitud total <b>${baseS.p.toFixed(1)}%</b>.`;

  $("results").classList.remove("hidden");
  $("summary").scrollIntoView({behavior:"smooth"});
};
