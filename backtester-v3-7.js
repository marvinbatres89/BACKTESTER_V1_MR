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

function zFor(level){return level===90?1.644854:level===99?2.575829:1.959964}

function wilson(w,n,level){
  if(!n)return{lo:0,hi:0,center:0};
  let z=zFor(level),p=w/n,z2=z*z,den=1+z2/n;
  let center=(p+z2/(2*n))/den;
  let half=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/den;
  return{lo:Math.max(0,center-half),hi:Math.min(1,center+half),center};
}

function erf(x){
  let sign=x<0?-1:1; x=Math.abs(x);
  let a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
  let t=1/(1+p*x);
  let y=1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}
function normCdf(x){return .5*(1+erf(x/Math.sqrt(2)))}
function approxBinomP(w,n,p0=.5){
  if(!n)return 1;
  let mean=n*p0,sd=Math.sqrt(n*p0*(1-p0));
  let z=(w-.5-mean)/sd;
  return Math.max(0,Math.min(1,1-normCdf(z)));
}

function bootstrap(winFlags,B){
  let n=winFlags.length,out=[];
  if(!n)return out;
  for(let b=0;b<B;b++){
    let w=0;
    for(let i=0;i<n;i++)w+=winFlags[Math.floor(Math.random()*n)];
    out.push(w/n);
  }
  out.sort((a,b)=>a-b);
  return out;
}

function quantile(arr,q){
  if(!arr.length)return 0;
  let pos=(arr.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return arr[lo];
  let h=pos-lo; return arr[lo]*(1-h)+arr[hi]*h;
}

function sensitivity(a){
  let sizes=[20,30,40,50,60,70,80,100,120].filter(n=>n<=a.length);
  if(!sizes.includes(a.length))sizes.push(a.length);
  return sizes.map(n=>{
    let s=stat(a.slice(0,n));
    let ci=wilson(s.w,s.n,95);
    return{n:s.n,w:s.w,p:s.p,lo:ci.lo*100,hi:ci.hi*100};
  });
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
      ciLevel=+$("ciLevel").value||95,bootN=+$("bootstrapN").value||3000,
      edgeThreshold=+$("edgeThreshold").value||55,targetN=+$("targetN").value||100;

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

  let base=bases[0],g=base.g,baseAll=all.filter(x=>baseMatch(x,g,tb,cb)),s=stat(baseAll);

  $("base").innerHTML=
    `<div class="rule good">
      <div class="title">${g.m} · ${g.d} · ${g.t>=0?"+":""}${g.t} ms · Conf. ${g.c}–${Math.min(100,g.c+cb-1)}%</div>
      <div class="metrics">
        <div class="metric"><small>Ganadas</small><b>${s.w}</b></div>
        <div class="metric"><small>Perdidas</small><b>${s.l}</b></div>
        <div class="metric"><small>Total</small><b>${s.n}</b></div>
        <div class="metric"><small>Exactitud</small><b>${s.p.toFixed(1)}%</b></div>
      </div>
    </div>`;

  let ci=wilson(s.w,s.n,ciLevel);
  let ciLo=ci.lo*100,ciHi=ci.hi*100;

  $("ci").innerHTML=
    `<div class="rule ${ciLo>50?"good":"warnRule"}">
      <div class="metrics">
        <div class="metric"><small>Estimación</small><b>${s.p.toFixed(1)}%</b></div>
        <div class="metric"><small>Límite inferior</small><b>${ciLo.toFixed(1)}%</b></div>
        <div class="metric"><small>Límite superior</small><b>${ciHi.toFixed(1)}%</b></div>
        <div class="metric"><small>Nivel</small><b>${ciLevel}%</b></div>
      </div>
      <p>${ciLo>50?"El intervalo completo queda por encima del 50%.":"El intervalo todavía incluye 50%; la muestra no separa claramente la regla del azar al nivel elegido."}</p>
    </div>`;

  let pOne=approxBinomP(s.w,s.n,.5);
  $("binom").innerHTML=
    `<div class="rule ${pOne<.05?"good":"warnRule"}">
      <div class="metrics">
        <div class="metric"><small>p aproximado</small><b>${pOne.toFixed(4)}</b></div>
        <div class="metric"><small>Referencia</small><b>50%</b></div>
        <div class="metric"><small>Diferencia</small><b>+${(s.p-50).toFixed(1)} pts</b></div>
        <div class="metric"><small>Lectura</small><b>${pOne<.05?"EVIDENCIA":"NO CONCLUYENTE"}</b></div>
      </div>
      <p>${pOne<.05?"La ventaja observada sería poco común si la probabilidad real fuera exactamente 50%.":"Con esta muestra, el resultado todavía puede aparecer con frecuencia suficiente bajo un escenario de 50%."}</p>
    </div>`;

  let flags=baseAll.map(x=>result(x)==="W"?1:0);
  let boot=bootstrap(flags,bootN);
  let bLo=quantile(boot,.025)*100,bHi=quantile(boot,.975)*100;
  let prob50=boot.filter(x=>x>.5).length/boot.length;
  let probEdge=boot.filter(x=>x>=edgeThreshold/100).length/boot.length;

  $("bootstrap").innerHTML=
    `<div class="rule ${prob50>=.95?"good":"warnRule"}">
      <div class="metrics">
        <div class="metric"><small>Simulaciones</small><b>${bootN}</b></div>
        <div class="metric"><small>95% bootstrap</small><b>${bLo.toFixed(1)}–${bHi.toFixed(1)}%</b></div>
        <div class="metric"><small>P(>50%)</small><b>${(prob50*100).toFixed(1)}%</b></div>
        <div class="metric"><small>P(≥${edgeThreshold}%)</small><b>${(probEdge*100).toFixed(1)}%</b></div>
      </div>
    </div>`;

  let sens=sensitivity(baseAll);
  $("sensitivity").innerHTML=
    `<div class="tableWrap"><table>
      <thead><tr><th>N</th><th>W</th><th>Exactitud</th><th>IC95% inferior</th><th>IC95% superior</th></tr></thead>
      <tbody>${sens.map(x=>`<tr><td>${x.n}</td><td>${x.w}</td><td>${x.p.toFixed(1)}%</td><td>${x.lo.toFixed(1)}%</td><td>${x.hi.toFixed(1)}%</td></tr>`).join("")}</tbody>
    </table></div>`;

  let needMore=Math.max(0,targetN-s.n);
  let strong=ciLo>50&&pOne<.05&&prob50>=.95&&probEdge>=.70;
  let moderate=(pOne<.10||prob50>=.90)&&s.p>=55;

  if(strong){
    $("decision").innerHTML=
      `<div class="status ok">EVIDENCIA ESTADÍSTICA FAVORABLE</div>
       <p>La regla supera los criterios estadísticos configurados. Aun así, esto describe este historial y no garantiza rendimiento futuro.</p>`;
  }else if(moderate){
    $("decision").innerHTML=
      `<div class="status mid">EVIDENCIA PROMETEDORA, AÚN INSUFICIENTE</div>
       <p>La ventaja observada es interesante, pero todavía conviene acumular más operaciones antes de trasladarla al BOT.</p>`;
  }else{
    $("decision").innerHTML=
      `<div class="status no">EVIDENCIA ESTADÍSTICA INSUFICIENTE</div>
       <p>Con la muestra actual no se puede distinguir con suficiente claridad esta regla de una tasa cercana al 50%.</p>`;
  }

  $("diag").innerHTML=
    `<div class="notice">
      <b>Orden temporal:</b> ${hasTime?"timestamp detectado":"orden original del TESTLOG"}.<br>
      <b>Regla base:</b> ${s.w}/${s.n} = ${s.p.toFixed(1)}%.<br>
      <b>Objetivo de muestra:</b> ${targetN} operaciones.<br>
      <b>Faltan para ese objetivo:</b> ${needMore}.<br>
      <b>Prueba binomial:</b> aproximación normal unilateral contra 50%.<br>
      <b>Intervalo:</b> Wilson.<br>
      <b>Bootstrap:</b> remuestreo con reemplazo del historial de la regla.<br><br>
      Esta versión mide robustez estadística; no busca filtros nuevos ni modifica el BOT.
    </div>`;

  $("summary").innerHTML=
    `Regla analizada: <b>${s.w}/${s.n}</b> · exactitud <b>${s.p.toFixed(1)}%</b> · IC${ciLevel}% <b>${ciLo.toFixed(1)}–${ciHi.toFixed(1)}%</b>.`;

  $("results").classList.remove("hidden");
  $("summary").scrollIntoView({behavior:"smooth"});
};
