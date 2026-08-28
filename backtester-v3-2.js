let DATA=null;const $=x=>document.getElementById(x),N=x=>String(x??"").trim().toUpperCase();
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
function primitiveFeatures(x){
 let skip=new Set(["resultado","result","estadoResultado","resultadoFinal","status","mercado","market","symbol","simbolo","direccion","direction","tipoDireccion","prediction","confianza","confidence","scoreConfianza","confidencePct","timestamp","ts","fechaHora","createdAt","time","hora","timingRealMs","timingMs","desviacionTargetMs","targetDeviationMs","ajusteMs","calibracionMs","timing","timingOffsetMs"]);
 let out={};
 function scan(o,p="",depth=0){if(!o||typeof o!=="object"||depth>2)return;for(const [k,v] of Object.entries(o)){let key=p?p+"."+k:k;if(skip.has(k))continue;if(v==null)continue;if(typeof v==="string"||typeof v==="boolean"){let s=String(v);if(s.length<=40)out[key]=N(s)}else if(typeof v==="number"&&Number.isFinite(v)){out[key]=v}else if(typeof v==="object"&&!Array.isArray(v))scan(v,key,depth+1)}}
 scan(x);return out
}
function candidates(train,minN){
 let maps=new Map();
 for(const x of train){let f=primitiveFeatures(x);for(const [k,v] of Object.entries(f)){
   let val;if(typeof v==="number"){let step=Math.abs(v)<=1?0.1:Math.abs(v)<=10?1:Math.abs(v)<=100?10:100;val="≈"+(Math.round(v/step)*step)}else val=v;
   let id=k+"="+val;if(!maps.has(id)){maps.set(id,{key:k,val,train:[]})}maps.get(id).train.push(x)
 }}
 return [...maps.values()].filter(c=>c.train.length>=minN&&c.train.length<train.length*.9).map(c=>({...c,s:stat(c.train)})).sort((a,b)=>b.s.p-a.s.p||b.s.n-a.s.n).slice(0,80)
}
function matchFeature(x,c){let f=primitiveFeatures(x),v=f[c.key];if(v==null)return false;if(typeof v==="number"&&String(c.val).startsWith("≈")){let target=Number(String(c.val).slice(1)),step=Math.abs(v)<=1?.1:Math.abs(v)<=10?1:Math.abs(v)<=100?10:100;return Math.round(v/step)*step===target}return v===c.val}
function baseGroups(a,tb,cb){let m=new Map();for(const x of a){if(!result(x))continue;let r={m:market(x),d:direction(x),t:buck(timing(x),tb),c:cbuck(confidence(x),cb)};let k=[r.m,r.d,r.t,r.c].join("|");if(!m.has(k))m.set(k,{...r,a:[]});m.get(k).a.push(x)}return[...m.values()]}
function baseMatch(x,r,tb,cb){return market(x)===r.m&&direction(x)===r.d&&buck(timing(x),tb)===r.t&&cbuck(confidence(x),cb)===r.c}
$("file").onchange=async e=>{let f=e.target.files[0];if(!f)return;try{DATA=JSON.parse(await f.text());$("fileState").textContent=f.name+" · "+rows().length+" registros";let ms=[...new Set(rows().map(market))].sort();$("market").innerHTML='<option value="">Todos</option>'+ms.map(x=>`<option>${x}</option>`).join("");$("summary").textContent="TESTLOG cargado correctamente."}catch(e){alert("No se pudo leer el JSON: "+e.message)}};
$("clear").onclick=()=>{DATA=null;$("file").value="";$("results").classList.add("hidden");$("fileState").textContent="SIN ARCHIVO"};
$("run").onclick=()=>{if(!DATA)return alert("Primero cargue el TESTLOG.");
 let M=$("market").value,D=$("direction").value,tp=(+$("trainPct").value||70)/100,minTr=+$("minTrain").value||30,minTe=+$("minTest").value||15,minST=+$("minSubTrain").value||12,minSE=+$("minSubTest").value||8,maxDrop=+$("maxDrop").value||8,tb=+$("bucket").value||100,cb=+$("confBucket").value||10,B=+$("blocks").value||4;
 let all=rows().filter(x=>result(x)&&(!M||market(x)===M)&&(!D||direction(x)===D));
 let hasTime=all.filter(x=>time(x)!=null).length===all.length&&all.length>0;if(hasTime)all=[...all].sort((a,b)=>time(a)-time(b));
 let cut=Math.floor(all.length*tp),tr=all.slice(0,cut),te=all.slice(cut);
 let bases=baseGroups(tr,tb,cb).filter(g=>g.a.length>=minTr).map(g=>{let s=stat(g.a),test=stat(te.filter(x=>baseMatch(x,g,tb,cb)));return{g,s,test}}).filter(z=>z.test.n>=minTe&&z.test.p>=50&&z.s.p-z.test.p<=maxDrop).sort((a,b)=>b.test.p-a.test.p);
 if(!bases.length){$("base").innerHTML="<p>No hubo regla base validada.</p>";$("subs").innerHTML="";$("walk").innerHTML="";$("diag").innerHTML="";$("results").classList.remove("hidden");return}
 let base=bases[0],g=base.g,baseAll=all.filter(x=>baseMatch(x,g,tb,cb)),baseTr=tr.filter(x=>baseMatch(x,g,tb,cb)),baseTe=te.filter(x=>baseMatch(x,g,tb,cb));
 $("base").innerHTML=`<div class="rule good"><div class="title">${g.m} · ${g.d} · ${g.t>=0?"+":""}${g.t} ms · Conf. ${g.c}–${Math.min(100,g.c+cb-1)}%</div><div class="metrics"><div class="metric"><small>TRAIN</small><b>${base.s.w}/${base.s.n} · ${base.s.p.toFixed(1)}%</b></div><div class="metric"><small>TEST</small><b>${base.test.w}/${base.test.n} · ${base.test.p.toFixed(1)}%</b></div></div></div>`;
 let cs=candidates(baseTr,minST),valid=[];
 for(const c of cs){let st=c.s,se=stat(baseTe.filter(x=>matchFeature(x,c)));if(se.n>=minSE&&se.p>=base.test.p&&st.p-se.p<=maxDrop)valid.push({...c,se,gain:se.p-base.test.p})}
 valid.sort((a,b)=>b.se.p-a.se.p||b.se.n-a.se.n);valid=valid.slice(0,10);
 $("subs").innerHTML=valid.length?valid.map((c,i)=>`<div class="rule ${i===0?"good":""}"><div class="title">#${i+1} ${c.key} = ${c.val}</div><div class="metrics"><div class="metric"><small>TRAIN</small><b>${c.s.w}/${c.s.n} · ${c.s.p.toFixed(1)}%</b></div><div class="metric"><small>TEST</small><b>${c.se.w}/${c.se.n} · ${c.se.p.toFixed(1)}%</b></div><div class="metric"><small>Mejora vs base</small><b>${c.gain>=0?"+":""}${c.gain.toFixed(1)} pts</b></div><div class="metric"><small>TEST ops</small><b>${c.se.n}</b></div></div></div>`).join(""):"<div class='notice'>No apareció ningún subfiltro que superara a la regla base con suficiente muestra en TEST. Eso también es un resultado útil: evita añadir filtros por casualidad.</div>";
 if(valid.length){let c=valid[0],wa=baseAll.filter(x=>matchFeature(x,c)),blocks=[];for(let i=0;i<B;i++){let a=Math.floor(wa.length*i/B),b=Math.floor(wa.length*(i+1)/B);blocks.push(stat(wa.slice(a,b)))}let non=blocks.filter(x=>x.n),min=Math.min(...non.map(x=>x.p)),max=Math.max(...non.map(x=>x.p)),total=stat(wa);
 $("walk").innerHTML=`<div class="rule"><div class="title">${c.key} = ${c.val}</div>${blocks.map((s,i)=>`<div class="block"><b>Bloque ${i+1}</b> · ${s.n?`${s.w}/${s.n} · ${s.p.toFixed(1)}%`:"SIN MUESTRA"}<div class="bar"><div class="fill" style="width:${s.p}%"></div></div></div>`).join("")}<div class="metrics"><div class="metric"><small>Total</small><b>${total.w}/${total.n} · ${total.p.toFixed(1)}%</b></div><div class="metric"><small>Peor bloque</small><b>${min.toFixed(1)}%</b></div><div class="metric"><small>Mejor bloque</small><b>${max.toFixed(1)}%</b></div><div class="metric"><small>Variación</small><b>${(max-min).toFixed(1)} pts</b></div></div></div>`;
 }else $("walk").innerHTML="<p>Sin subfiltro validado para recorrer.</p>";
 $("diag").innerHTML=`<div class="notice"><b>Orden cronológico:</b> ${hasTime?"timestamp detectado":"orden original del TESTLOG"}.<br><b>Regla base:</b> ${baseAll.length} operaciones.<br><b>Campos candidatos examinados:</b> ${cs.length}.<br><b>Subfiltros que sobrevivieron TRAIN → TEST:</b> ${valid.length}.</div>`;
 $("summary").innerHTML=`Analizadas <b>${all.length}</b> · TRAIN <b>${tr.length}</b> · TEST <b>${te.length}</b> · Regla base validada <b>1</b> · Subfiltros validados <b>${valid.length}</b>.`;
 $("results").classList.remove("hidden");$("summary").scrollIntoView({behavior:"smooth"})
};