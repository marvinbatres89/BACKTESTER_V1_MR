let data=null;
const $=id=>document.getElementById(id);
const pick=(o,keys,def=null)=>{for(const k of keys){if(o&&o[k]!==undefined&&o[k]!==null)return o[k]}return def};
const norm=s=>String(s??"").trim().toUpperCase();
function telem(){return Array.isArray(data?.telemetria)?data.telemetria:[]}
function resultOf(x){const r=norm(pick(x,["resultado","result","estadoResultado","resultadoFinal","status"],""));if(["WIN","GANADA","GANADO","WON"].includes(r))return"W";if(["LOSS","PERDIDA","PERDIDO","LOST"].includes(r))return"L";return""}
function marketOf(x){return String(pick(x,["mercado","market","symbol","simbolo"],"DESCONOCIDO"))}
function dirOf(x){return norm(pick(x,["direccion","direction","tipoDireccion","prediction"],""))}
function confOf(x){return Number(pick(x,["confianza","confidence","scoreConfianza"],0))||0}
function timingOf(x){return Number(pick(x,["timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs","ajusteMs","calibracionMs","timing"],0))||0}
function modeOf(x){return norm(pick(x,["modoEjecucion","executionMode","modo"],""))}
function classOf(x){return norm(pick(x,["clasificacionPatron","patternClassification","clasificacion","decisionHistorica"],"SIN DATO"))||"SIN DATO"}
function bucket(v,n){return Math.round(v/n)*n}
function confBucket(v,n){return Math.floor(Math.max(0,Math.min(100,v))/n)*n}
function pct(w,n){return n?100*w/n:0}
function populate(){const ms=[...new Set(telem().map(marketOf))].sort();$("market").innerHTML='<option value="">Todos</option>'+ms.map(m=>`<option>${m}</option>`).join("")}
$("file").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{data=JSON.parse(await f.text());$("fileState").textContent=`${f.name} · ${telem().length} registros`;$("summary").textContent=`TESTLOG cargado: ${data.versionBot||"versión no indicada"} · ${telem().length} registros de telemetría.`;populate()}catch(err){alert("No se pudo leer el JSON: "+err.message)}})
$("clear").onclick=()=>{data=null;$("file").value="";$("fileState").textContent="SIN ARCHIVO";$("summary").textContent="Cargue el TESTLOG para comenzar.";$("results").classList.add("hidden")}
$("run").onclick=()=>{if(!data)return alert("Primero cargue el TESTLOG JSON.");
const market=$("market").value,dir=$("direction").value,min=+$("minSamples").value||20,tb=+$("bucket").value||100,cb=+$("confBucket").value||10,top=+$("topN").value||20;
let rows=telem().filter(x=>{const r=resultOf(x);if($("finalOnly").checked&&!r)return false;if($("autoOnly").checked&&modeOf(x)!=="AUTOMATICO"&&modeOf(x)!=="AUTOMÁTICO")return false;if(market&&marketOf(x)!==market)return false;if(dir&&dirOf(x)!==dir)return false;return !!r});
const groups=new Map(), timings=new Map();
for(const x of rows){const r=resultOf(x),t=bucket(timingOf(x),tb),c=confBucket(confOf(x),cb),cl=classOf(x),key=[marketOf(x),dirOf(x),t,c,cl].join("|");if(!groups.has(key))groups.set(key,{market:marketOf(x),dir:dirOf(x),t,c,cl,n:0,w:0,l:0});const g=groups.get(key);g.n++;r==="W"?g.w++:g.l++;
if(!timings.has(t))timings.set(t,{t,n:0,w:0,l:0});const z=timings.get(t);z.n++;r==="W"?z.w++:z.l++}
const best=[...groups.values()].filter(g=>g.n>=min).sort((a,b)=>pct(b.w,b.n)-pct(a.w,a.n)||b.n-a.n).slice(0,top);
$("bestBody").innerHTML=best.length?best.map((g,i)=>`<tr><td>${i+1}</td><td>${g.market}</td><td>${g.dir||"—"}</td><td>${g.t>=0?"+":""}${g.t} ms</td><td>${g.c}–${Math.min(100,g.c+cb-1)}%</td><td>${g.cl}</td><td>${g.n}</td><td>${g.w}</td><td>${g.l}</td><td class="${pct(g.w,g.n)>=60?"good":"warn"}">${pct(g.w,g.n).toFixed(1)}%</td></tr>`).join(""):`<tr><td colspan="10">Ninguna combinación alcanza la muestra mínima de ${min}. Bájela con cautela.</td></tr>`;
$("timingBody").innerHTML=[...timings.values()].sort((a,b)=>a.t-b.t).map(g=>`<tr><td>${g.t>=0?"+":""}${g.t} ms</td><td>${g.n}</td><td>${g.w}</td><td>${g.l}</td><td>${pct(g.w,g.n).toFixed(1)}%</td></tr>`).join("");
const pats=Array.isArray(data.patrones)?data.patrones:[];$("patterns").innerHTML=pats.slice(0,30).map(p=>`<div class="pattern"><b>${pick(p,["clave","key","patternKey"],"Patrón")}</b> · ${pick(p,["total","muestras","samples"],0)} muestras · ${Number(pick(p,["accuracy","precision","acierto"],0)||0).toFixed(1)}% · ${norm(pick(p,["clasificacion","classification"],"SIN DATO"))}</div>`).join("")||"<p>No hay arreglo de patrones en este TESTLOG.</p>";
$("summary").innerHTML=`Analizadas <b>${rows.length}</b> operaciones finalizadas. Se encontraron <b>${best.length}</b> combinaciones mostrables con mínimo ${min} muestras.`;
$("results").classList.remove("hidden");window.scrollTo({top:$("summary").offsetTop,behavior:"smooth"})}