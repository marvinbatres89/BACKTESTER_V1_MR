let data=null;const $=id=>document.getElementById(id);const norm=s=>String(s??"").trim().toUpperCase();
const pick=(o,ks,d=null)=>{for(const k of ks)if(o&&o[k]!==undefined&&o[k]!==null)return o[k];return d};
const telem=()=>Array.isArray(data?.telemetria)?data.telemetria:[];
function res(x){let r=norm(pick(x,["resultado","result","estadoResultado","resultadoFinal","status"],""));return["WIN","GANADA","GANADO","WON"].includes(r)?"W":["LOSS","PERDIDA","PERDIDO","LOST"].includes(r)?"L":""}
const market=x=>String(pick(x,["mercado","market","symbol","simbolo"],"DESCONOCIDO"));
const dir=x=>norm(pick(x,["direccion","direction","tipoDireccion","prediction"],""));
const conf=x=>Number(pick(x,["confianza","confidence","scoreConfianza","confidencePct"],0))||0;
const timing=x=>Number(pick(x,["timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs","ajusteMs","calibracionMs","timing","timingOffsetMs"],0))||0;
const mode=x=>norm(pick(x,["modoEjecucion","executionMode","modo"],""));
function classification(x){
 let v=pick(x,["clasificacionPatron","patternClassification","clasificacion","classification","memoryClassification","historicalClassification","decisionHistorica","patternClass"],null);
 if(v)return norm(v);
 const p=pick(x,["patron","pattern","patternInfo","memoriaPatron","memoryPattern"],null);
 if(p&&typeof p==="object"){v=pick(p,["clasificacion","classification","clase","status"],null);if(v)return norm(v)}
 return "SIN DATO";
}
const buck=(v,n)=>Math.round(v/n)*n, cbuck=(v,n)=>Math.floor(Math.max(0,Math.min(100,v))/n)*n, pct=(w,n)=>n?100*w/n:0;
function evidence(n){return n>=50?["SÓLIDA","solid"]:n>=20?["MEDIA","medium"]:["DÉBIL","weak"]}
function populate(){const a=[...new Set(telem().map(market))].sort();$("market").innerHTML='<option value="">Todos</option>'+a.map(v=>`<option>${v}</option>`).join("")}
$("file").onchange=async e=>{let f=e.target.files[0];if(!f)return;try{data=JSON.parse(await f.text());$("fileState").textContent=`${f.name} · ${telem().length} registros`;populate();$("summary").textContent=`TESTLOG cargado · ${telem().length} registros.`}catch(z){alert("No se pudo leer: "+z.message)}};
$("clear").onclick=()=>{data=null;$("file").value="";$("fileState").textContent="SIN ARCHIVO";$("results").classList.add("hidden")};
function card(g,i,cb){let [ev,cl]=evidence(g.n);return `<div class="result"><div class="resultTop"><div class="rank">#${i+1} ${g.market} · ${g.dir||"—"}</div><div class="accuracy">${pct(g.w,g.n).toFixed(1)}%</div></div><span class="tag">${g.t>=0?"+":""}${g.t} ms</span><span class="tag">Conf. ${g.c}–${Math.min(100,g.c+cb-1)}%</span><span class="tag">${g.cl}</span><span class="tag ${cl}">Evidencia ${ev}</span><div class="metrics"><div class="metric"><small>Operaciones</small><b>${g.n}</b></div><div class="metric"><small>Ganadas</small><b>${g.w}</b></div><div class="metric"><small>Perdidas</small><b>${g.l}</b></div></div></div>`}
$("run").onclick=()=>{if(!data)return alert("Primero cargue el TESTLOG.");let M=$("market").value,D=$("direction").value,min=+$("minSamples").value||20,tb=+$("bucket").value||100,cb=+$("confBucket").value||10,top=+$("topN").value||20;
let rows=telem().filter(x=>{let r=res(x);if($("finalOnly").checked&&!r)return false;if($("autoOnly").checked&&!["AUTOMATICO","AUTOMÁTICO"].includes(mode(x)))return false;if(M&&market(x)!==M)return false;if(D&&dir(x)!==D)return false;return !!r});
let gs=new Map(),ts=new Map();for(const x of rows){let r=res(x),t=buck(timing(x),tb),c=cbuck(conf(x),cb),cl=classification(x),k=[market(x),dir(x),t,c,cl].join("|");if(!gs.has(k))gs.set(k,{market:market(x),dir:dir(x),t,c,cl,n:0,w:0,l:0});let g=gs.get(k);g.n++;r==="W"?g.w++:g.l++;if(!ts.has(t))ts.set(t,{t,n:0,w:0,l:0});let q=ts.get(t);q.n++;r==="W"?q.w++:q.l++}
let best=[...gs.values()].filter(g=>g.n>=min).sort((a,b)=>pct(b.w,b.n)-pct(a.w,a.n)||b.n-a.n).slice(0,top);
$("bestCards").innerHTML=best.length?best.map((g,i)=>card(g,i,cb)).join(""):`<p>No hay combinaciones con mínimo ${min} muestras.</p>`;
$("timingCards").innerHTML=[...ts.values()].sort((a,b)=>a.t-b.t).map(g=>`<div class="result"><b>${g.t>=0?"+":""}${g.t} ms</b> · ${g.n} ops · ${g.w} W / ${g.l} L · <b>${pct(g.w,g.n).toFixed(1)}%</b></div>`).join("");
function agg(d,t){let a=rows.filter(x=>market(x)==="R_50"&&dir(x)===d&&buck(timing(x),tb)===t),w=a.filter(x=>res(x)==="W").length;return {n:a.length,w,l:a.length-w,p:pct(w,a.length)}}
let e=agg("EVEN",100),o=agg("ODD",300);$("keyCompare").innerHTML=`<div class="result"><b>EVEN +100 ms</b><div class="metrics"><div class="metric"><small>Ops</small><b>${e.n}</b></div><div class="metric"><small>W / L</small><b>${e.w} / ${e.l}</b></div><div class="metric"><small>Acierto</small><b>${e.p.toFixed(1)}%</b></div></div></div><div class="result"><b>ODD +300 ms</b><div class="metrics"><div class="metric"><small>Ops</small><b>${o.n}</b></div><div class="metric"><small>W / L</small><b>${o.w} / ${o.l}</b></div><div class="metric"><small>Acierto</small><b>${o.p.toFixed(1)}%</b></div></div></div>`;
let pats=Array.isArray(data.patrones)?data.patrones:[];$("patterns").innerHTML=pats.slice(0,40).map(p=>`<div class="pattern"><b>${pick(p,["clave","key","patternKey"],"Patrón")}</b> · ${pick(p,["total","muestras","samples"],0)} muestras · ${Number(pick(p,["accuracy","precision","acierto"],0)||0).toFixed(1)}% · ${norm(pick(p,["clasificacion","classification"],"SIN DATO"))}</div>`).join("")||"<p>No hay arreglo de patrones independiente en este TESTLOG.</p>";
$("summary").innerHTML=`Analizadas <b>${rows.length}</b> operaciones. Resultados mostrados con mínimo <b>${min}</b> muestras.`;$("results").classList.remove("hidden");$("summary").scrollIntoView({behavior:"smooth"})};