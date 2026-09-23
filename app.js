const $ = (id) => document.getElementById(id);

const POLICIES = {
  B2C: {
    '2020-2023': { avista:{rate:50,type:'total'}, parcelado:{rate:25,type:'total'}, maxBoleto:3, maxCartao:8 },
    '2024':      { avista:{rate:40,type:'total'}, parcelado:{rate:20,type:'total'}, maxBoleto:3, maxCartao:8 },
    '2025':      { avista:{rate:20,type:'total'}, parcelado:{rate:10,type:'total'}, maxBoleto:3, maxCartao:8 },
    '2026':      { avista:{rate:50,type:'juros'}, parcelado:{rate:0,type:'none'}, maxBoleto:3, maxCartao:8 }
  },
  B2B: {
    '2020-2023': { avista:{rate:20,type:'originalPlusJurosLabel'}, parcelado:{rate:0,type:'juros'}, maxBoleto:8 },
    '2024':      { avista:{rate:10,type:'originalPlusJurosLabel'}, parcelado:{rate:50,type:'juros'}, maxBoleto:6 },
    '2025':      { avista:{rate:0,type:'none'}, parcelado:{rate:0,type:'none'}, maxBoleto:4 },
    '2026':      { avista:{rate:50,type:'juros'}, parcelado:{rate:0,type:'none'}, maxBoleto:3 }
  },
  LINK: {
    '2020-2023': { avista:{rate:20,type:'original'}, parcelado:{rate:0,type:'juros'}, maxBoleto:8 },
    '2024':      { avista:{rate:10,type:'original'}, parcelado:{rate:50,type:'juros'}, maxBoleto:6 },
    '2025':      { avista:{rate:0,type:'none'}, parcelado:{rate:0,type:'none'}, maxBoleto:4 },
    '2026':      { avista:{rate:50,type:'juros'}, parcelado:{rate:0,type:'none'}, maxBoleto:3 }
  }
};

const state = {
  scenario: null,
  comparisons: [],
  history: JSON.parse(localStorage.getItem('master-simulador-history') || '[]')
};

function money(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0); }
function pct(v){ return `${(Number(v)||0).toFixed(1).replace('.',',')}%`; }
function clamp(v,min,max){ return Math.min(max,Math.max(min,v)); }

function policyFor(profile, period){
  return POLICIES[profile]?.[period] || null;
}

function getPolicyInputs(profile=$('perfil').value, period=$('periodo').value, mode=$('modalidade').value){
  const p = policyFor(profile,period);
  if(!p) return null;
  return mode === 'avista' ? p.avista : p.parcelado;
}

function applyOfficialPolicy(){
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const mode = $('modalidade').value;
  const policy = getPolicyInputs(profile,period,mode);
  if(!policy) return;

  const normalized = policy.type === 'originalPlusJurosLabel' ? 'original' : policy.type;
  $('tipoDesconto').value = normalized;
  $('desconto').value = policy.rate;

  const max = profile === 'B2C'
    ? ($('metodo').value === 'cartao' ? (policyFor(profile,period).maxCartao || 8) : (policyFor(profile,period).maxBoleto || 3))
    : (policyFor(profile,period).maxBoleto || 3);
  const current = Number($('parcelas').value);
  $('parcelas').value = String(Math.min(current,max));
  updateValidation();
  recalc();
}

function calcScenario(){
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const mode = $('modalidade').value;
  const method = $('metodo').value;
  const original = Math.max(0, Number($('original').value) || 0);
  const interest = Math.max(0, Number($('juros').value) || 0);
  const gross = original + interest;
  let rate = clamp(Number($('desconto').value) || 0,0,100);
  let type = $('tipoDesconto').value;
  if(mode === 'avista') {
    // À vista is a single payment; entry is effectively 100%.
  }

  let discountValue = 0;
  if(type === 'total') discountValue = gross * rate/100;
  else if(type === 'juros') discountValue = interest * rate/100;
  else if(type === 'original') discountValue = original * rate/100;
  else discountValue = 0;

  const net = Math.max(0,gross-discountValue);
  let n = Math.max(1,Number($('parcelas').value)||1);
  let entryPct = clamp(Number($('entradaPct').value)||0,0,100);
  if(mode === 'avista') { n = 1; entryPct = 100; }
  if(n === 1) entryPct = 100;

  const entry = net * entryPct/100;
  const remainder = Math.max(0,net-entry);
  const installmentCount = Math.max(1,n-1);
  const each = installmentCount ? remainder/installmentCount : 0;
  const schedule = [];
  schedule.push({when:'Entrada', pct:entryPct, value:entry});
  if(n>1){
    for(let i=1;i<n;i++) schedule.push({when:`D+${i===1?30:(i===2?60:(i*30))}`, pct:(100-entryPct)/(n-1), value:each});
  }

  return {
    profile,period,mode,method,original,interest,gross,rate,type,discountValue,net,n,entryPct,entry,remainder,each,schedule,
    effectiveDiscount: gross ? discountValue/gross*100 : 0,
    d30: mode==='avista' ? net : schedule.slice(0,2).reduce((s,x)=>s+x.value,0),
    d60: mode==='avista' ? net : schedule.slice(0,3).reduce((s,x)=>s+x.value,0),
    policy: policyFor(profile,period)
  };
}

function typeLabel(type){
  return ({total:'original + juros',juros:'juros',original:'original',none:'sem desconto'})[type] || type;
}
function methodLabel(v){ return ({boleto:'Boleto',pix:'PIX',cartao:'Cartão'})[v] || v; }
function modeLabel(v){ return v==='avista'?'À vista':'Parcelado'; }

function renderScenario(r){
  $('kpiBruto').textContent=money(r.gross);
  $('kpiDesconto').textContent=money(r.discountValue);
  $('kpiLiquido').textContent=money(r.net);
  $('kpiEntrada').textContent=money(r.entry);
  $('mDesconto').textContent=pct(r.effectiveDiscount);
  $('mD30').textContent=money(Math.min(r.net,r.d30));
  $('mD60').textContent=money(Math.min(r.net,r.d60));
  $('mSaldo').textContent=money(Math.max(0,r.net-r.d60));
  $('resultTag').textContent=`${r.profile} · ${r.period}`;

  const schedule=$('schedulePreview');
  schedule.innerHTML='';
  r.schedule.forEach((x,i)=>{
    const div=document.createElement('div');
    div.className='schedule-item';
    div.innerHTML=`<div class="when">${x.when}</div><strong>${money(x.value)}</strong><small>${pct(x.pct)}</small>`;
    schedule.appendChild(div);
  });

  const timeline=$('timeline');
  timeline.innerHTML='';
  const nodes=r.mode==='avista' ? [{label:'Hoje',value:r.net},{label:'Quitação',value:r.net}] : [
    {label:'Hoje',value:r.entry},
    {label:'D+30',value:r.schedule[1]?.value||0},
    {label:'D+60',value:r.schedule[2]?.value||0},
    {label:`D+${Math.max(90,(r.n-1)*30)}`,value:r.schedule[3]?.value||0}
  ];
  nodes.forEach((n,i)=>{
    const d=document.createElement('div'); d.className='timeline-node';
    d.innerHTML=`<div class="timeline-dot">${i+1}</div><strong>${n.label}</strong><small>${money(n.value)}</small>`;
    timeline.appendChild(d);
  });

  let message=`O cenário usa <strong>${typeLabel(r.type)}</strong> com ${pct(r.rate)} de desconto. `;
  if(r.mode==='parcelado') message += `A entrada representa <strong>${pct(r.entryPct)}</strong> do valor líquido e deixa ${money(r.remainder)} para ${r.n-1} parcela(s). `;
  else message += `A quitação ocorre em parcela única. `;
  if(r.method==='cartao') message += `O cálculo não inclui juros da operadora, portanto esse componente deve ser tratado fora desta simulação.`;
  $('insightText').innerHTML=message;

  const badgeLabel = isPolicyMatch(r) ? 'Política oficial' : 'Política livre';
  $('policyBadge').textContent=badgeLabel;
}

function isPolicyMatch(r){
  const policy = getPolicyInputs(r.profile,r.period,r.mode);
  if(!policy) return false;
  const t = policy.type === 'originalPlusJurosLabel' ? 'original' : policy.type;
  return Number(r.rate)===Number(policy.rate) && r.type===t;
}

function renderDiscountPills(){
  const p=policyFor($('perfil').value,$('periodo').value);
  const mode=$('modalidade').value;
  const box=$('discountPills'); box.innerHTML='';
  if(!p) return;
  const values=[p.avista.rate,p.parcelado.rate].filter((x,i,a)=>a.indexOf(x)===i);
  values.forEach(v=>{
    const b=document.createElement('button'); b.className='pill'; b.textContent=`${v}% oficial`;
    b.onclick=()=>{ $('desconto').value=v; $('tipoDesconto').value=(mode==='avista'?p.avista.type:p.parcelado.type)==='originalPlusJurosLabel'?'original':(mode==='avista'?p.avista.type:p.parcelado.type); recalc(); };
    box.appendChild(b);
  });
}

function updateValidation(){
  const box=$('validationBox');
  const profile=$('perfil').value, period=$('periodo').value, method=$('metodo').value;
  const p=policyFor(profile,period);
  const max = profile==='B2C' ? (method==='cartao' ? (p?.maxCartao||8) : (p?.maxBoleto||3)) : (p?.maxBoleto||3);
  const n=Number($('parcelas').value);
  if(n>max){ box.className='validation error'; box.textContent=`Configuração incompatível com a política cadastrada: máximo de ${max} parcela(s) para esta combinação.`; }
  else { box.className='validation'; box.textContent=`Limite de referência: até ${max} parcela(s) para ${profile} / ${period} / ${methodLabel(method)}.`; }
}

function recalc(){
  updateValidation(); renderDiscountPills();
  const r=calcScenario();
  state.scenario=r; renderScenario(r);
}

function snapshotFromCurrent(){
  const r=calcScenario();
  return {
    id:crypto.randomUUID(),
    name:`${r.profile} ${r.period} · ${modeLabel(r.mode)}`,
    savedAt:new Date().toISOString(),
    ...r,
    schedule:undefined,
    policy:undefined
  };
}

function compactScenario(r){
  return {
    original:r.original,interest:r.interest,gross:r.gross,discountValue:r.discountValue,net:r.net,
    rate:r.rate,type:r.type,entryPct:r.entryPct,entry:r.entry,n:r.n,mode:r.mode,method:r.method,profile:r.profile,period:r.period
  };
}

function addComparison(r){
  state.comparisons.push(compactScenario(r));
  if(state.comparisons.length>4) state.comparisons.shift();
  renderComparison();
}

function renderComparison(){
  const cols=['Cenário 1','Cenário 2','Cenário 3','Cenário 4'];
  cols.forEach((h,i)=>{ $(`headC${i}`).textContent=state.comparisons[i]?.name || h; });
  const metrics=[
    ['Valor bruto',r=>money(r.gross)],
    ['Desconto',r=>money(r.discountValue)],
    ['Valor líquido',r=>money(r.net)],
    ['Desconto efetivo',r=>pct(r.gross?r.discountValue/r.gross*100:0)],
    ['Entrada',r=>money(r.entry)],
    ['Entrada (%)',r=>pct(r.entryPct)],
    ['Parcelas',r=>String(r.n)],
    ['Forma de pagamento',r=>methodLabel(r.method)],
    ['Tipo de desconto',r=>typeLabel(r.type)]
  ];
  const body=$('compareBody'); body.innerHTML='';
  metrics.forEach(([label,fn])=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${label}</td>`+state.comparisons.map(fn).map(v=>`<td>${v}</td>`).join('');
    body.appendChild(tr);
  });
  const bars=$('compareBars'); bars.innerHTML='';
  if(!state.comparisons.length){ bars.innerHTML='<div class="bar-card"><strong>Nenhum cenário adicionado ainda.</strong><p class="compare-note">Volte ao simulador e clique em “Adicionar cenário atual”.</p></div>'; return; }
  const max=Math.max(...state.comparisons.map(r=>r.net),1);
  const card=document.createElement('div'); card.className='bar-card'; card.innerHTML='<strong>Valor líquido por cenário</strong>';
  state.comparisons.forEach((r,i)=>card.innerHTML+=`<div class="bar-row"><span>${i+1}. ${r.profile} ${r.period}</span><div class="bar-track"><div class="bar-fill" style="width:${(r.net/max)*100}%"></div></div><b>${money(r.net)}</b></div>`);
  bars.appendChild(card);
  const card2=document.createElement('div'); card2.className='bar-card'; card2.innerHTML='<strong>Caixa na entrada</strong>';
  const maxE=Math.max(...state.comparisons.map(r=>r.entry),1);
  state.comparisons.forEach((r,i)=>card2.innerHTML+=`<div class="bar-row"><span>${i+1}. ${r.profile} ${r.period}</span><div class="bar-track"><div class="bar-fill" style="width:${(r.entry/maxE)*100}%"></div></div><b>${money(r.entry)}</b></div>`);
  bars.appendChild(card2);
}

function renderPolicies(){
  const box=$('policyCards'); box.innerHTML='';
  ['B2C','B2B'].forEach(profile=>{
    ['2020-2023','2024','2025','2026'].forEach(period=>{
      const p=POLICIES[profile][period];
      const card=document.createElement('div'); card.className='policy-card';
      const label=profile==='B2C'?'B2C':'B2B';
      card.innerHTML=`<h3>${label} · ${period}</h3><div class="policy-meta">Condição cadastrada na matriz de políticas.</div>
      <div class="policy-row"><span>À vista</span><strong>${p.avista.rate}% · ${typeLabel(p.avista.type==='originalPlusJurosLabel'?'original':p.avista.type)}</strong></div>
      <div class="policy-row"><span>Parcelado</span><strong>${p.parcelado.rate}% · ${typeLabel(p.parcelado.type==='originalPlusJurosLabel'?'original':p.parcelado.type)}</strong></div>
      <div class="policy-row"><span>Limite boleto</span><strong>${p.maxBoleto}x</strong></div>`;
      box.appendChild(card);
    });
  });
}

function saveScenario(){
  const name=($('scenarioName').value||'').trim(); if(!name) return;
  const r=state.scenario||calcScenario();
  const item={id:crypto.randomUUID(),name,savedAt:new Date().toISOString(),...compactScenario(r)};
  state.history.unshift(item); state.history=state.history.slice(0,30);
  localStorage.setItem('master-simulador-history',JSON.stringify(state.history));
  $('saveDialog').close(); $('scenarioName').value=''; renderHistory();
}

function renderHistory(){
  const box=$('historyList'); box.innerHTML='';
  if(!state.history.length){ box.innerHTML='<div class="history-item"><div><h4>Nenhum cenário salvo</h4><small>Use “Salvar cenário” para guardar uma configuração neste navegador.</small></div></div>'; return; }
  state.history.forEach(item=>{
    const d=document.createElement('div'); d.className='history-item';
    d.innerHTML=`<div><h4>${item.name}</h4><small>${new Date(item.savedAt).toLocaleString('pt-BR')}</small></div>
      <div class="history-meta"><span>${item.profile} · ${item.period}</span><span>${money(item.net)}</span><button class="secondary-btn load-history">Carregar</button><button class="ghost-btn danger delete-history">Excluir</button></div>`;
    d.querySelector('.load-history').onclick=()=>loadHistory(item);
    d.querySelector('.delete-history').onclick=()=>{state.history=state.history.filter(x=>x.id!==item.id);localStorage.setItem('master-simulador-history',JSON.stringify(state.history));renderHistory();};
    box.appendChild(d);
  });
}

function loadHistory(item){
  $('perfil').value=item.profile; $('periodo').value=item.period; $('modalidade').value=item.mode; $('metodo').value=item.method; $('original').value=item.original; $('juros').value=item.interest; $('desconto').value=item.rate; $('tipoDesconto').value=item.type; $('entradaPct').value=item.entryPct; $('parcelas').value=item.n;
  recalc(); switchTab('simulador');
}

function switchTab(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`));
  if(name==='comparador') renderComparison();
  if(name==='politicas') renderPolicies();
  if(name==='historico') renderHistory();
}

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
['perfil','periodo','modalidade','metodo','parcelas','original','juros','desconto','tipoDesconto','entradaPct'].forEach(id=>$(id).addEventListener('input',recalc));
$('btnApplyPolicy').onclick=applyOfficialPolicy;
$('btnSimular').onclick=recalc;
$('btnAddCurrent').onclick=()=>addComparison(state.scenario||calcScenario());
$('btnClearCompare').onclick=()=>{state.comparisons=[];renderComparison();};
$('btnReset').onclick=()=>{ location.reload(); };
$('btnSave').onclick=()=>$('saveDialog').showModal();
$('saveForm').addEventListener('submit',(e)=>{e.preventDefault();saveScenario();});
$('btnClearHistory').onclick=()=>{if(confirm('Excluir todos os cenários salvos?')){state.history=[];localStorage.removeItem('master-simulador-history');renderHistory();}};

recalc(); renderPolicies(); renderHistory(); renderComparison();
