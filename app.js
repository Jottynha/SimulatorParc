const $ = (id) => document.getElementById(id);

// Políticas extraídas da matriz de negociação enviada.
// Os descontos agora são separados entre ORIGINAL e JUROS/MULTAS.
const POLICIES = {
  B2C: {
    '2020-2023': {
      avista: { originalRate: 50, interestRate: 50, maxBoleto: 3, maxCartao: 8 },
      parcelado: { originalRate: 25, interestRate: 25, maxBoleto: 3, maxCartao: 8 }
    },
    '2024': {
      avista: { originalRate: 40, interestRate: 40, maxBoleto: 3, maxCartao: 8 },
      parcelado: { originalRate: 20, interestRate: 20, maxBoleto: 3, maxCartao: 8 }
    },
    '2025': {
      avista: { originalRate: 20, interestRate: 20, maxBoleto: 3, maxCartao: 8 },
      parcelado: { originalRate: 10, interestRate: 10, maxBoleto: 3, maxCartao: 8 }
    },
    '2026': {
      avista: { originalRate: 0, interestRate: 50, maxBoleto: 3, maxCartao: 8 },
      parcelado: { originalRate: 0, interestRate: 0, maxBoleto: 3, maxCartao: 8 }
    }
  },
  B2B: {
    '2020-2023': {
      avista: { originalRate: 20, interestRate: 100, maxBoleto: 8, maxCartao: 8 },
      parcelado: { originalRate: 0, interestRate: 100, maxBoleto: 8, maxCartao: 8 }
    },
    '2024': {
      avista: { originalRate: 10, interestRate: 100, maxBoleto: 6, maxCartao: 6 },
      parcelado: { originalRate: 0, interestRate: 50, maxBoleto: 6, maxCartao: 6 }
    },
    '2025': {
      avista: { originalRate: 0, interestRate: 100, maxBoleto: 4, maxCartao: 4 },
      parcelado: { originalRate: 0, interestRate: 0, maxBoleto: 4, maxCartao: 4 }
    },
    '2026': {
      avista: { originalRate: 0, interestRate: 50, maxBoleto: 3, maxCartao: 3 },
      parcelado: { originalRate: 0, interestRate: 0, maxBoleto: 3, maxCartao: 3 }
    }
  }
};

const state = {
  scenario: null,
  comparisons: [],
  highlight: 'none',
  history: JSON.parse(localStorage.getItem('master-simulador-history') || '[]')
};

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function pct(value) {
  return `${(Number(value) || 0).toFixed(1).replace('.', ',')}%`;
}

function num(value) {
  return Math.max(0, Number(value) || 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function policyFor(profile, period) {
  const normalizedProfile = profile === 'LINK' ? 'B2B' : profile;
  return POLICIES[normalizedProfile]?.[period] || null;
}

function officialFor(profile, period, mode) {
  const p = policyFor(profile, period);
  return p ? (mode === 'avista' ? p.avista : p.parcelado) : null;
}

function typeLabelFromRates(originalRate, interestRate) {
  if (originalRate === 0 && interestRate === 0) return 'Sem desconto';
  if (originalRate === 0) return 'Somente juros';
  if (interestRate === 0) return 'Somente original';
  if (originalRate === interestRate) return 'Original + juros';
  return 'Original e juros separados';
}

function methodLabel(value) {
  return ({ boleto: 'Boleto', pix: 'PIX', cartao: 'Cartão' })[value] || value;
}

function modeLabel(value) {
  return value === 'avista' ? 'À vista' : 'Parcelado';
}

function profileLabel(value) {
  return ({ B2C: 'B2C', B2B: 'B2B', LINK: 'Link Dedicado' })[value] || value;
}

function buildScenarioName(r) {
  const custom = ($('scenarioName')?.value || '').trim();
  if (custom) return custom;
  return `${profileLabel(r.profile)} ${r.period} · ${modeLabel(r.mode)}`;
}

function getDefaultMethod(profile, mode) {
  if (mode === 'avista') return 'pix';
  if (profile === 'B2B' || profile === 'LINK') return 'boleto';
  return 'boleto';
}

function applyPreset(mode) {
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const official = officialFor(profile, period, mode);
  if (!official) return;

  $('modalidade').value = mode;
  $('metodo').value = getDefaultMethod(profile, mode);
  $('descontoOriginal').value = official.originalRate;
  $('descontoJuros').value = official.interestRate;

  if (mode === 'avista') {
    $('parcelas').value = '1';
    $('entradaPct').value = '100';
  } else {
    $('parcelas').value = '3';
    $('entradaPct').value = '50';
  }

  renderPresetButtons();
  recalc();
}

function renderPresetButtons() {
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const currentMode = $('modalidade').value;
  const box = $('presetButtons');
  box.innerHTML = '';

  ['avista', 'parcelado'].forEach((mode) => {
    const p = officialFor(profile, period, mode);
    if (!p) return;

    const maxBoleto = p.maxBoleto || 3;
    const maxCartao = p.maxCartao || maxBoleto;
    const currentIsPreset = num($('descontoOriginal').value) === p.originalRate && num($('descontoJuros').value) === p.interestRate && currentMode === mode;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `preset-btn${currentIsPreset ? ' active' : ''}`;
    button.innerHTML = `
      <div class="preset-top">
        <strong>${modeLabel(mode)}</strong>
        <span class="preset-mode">Política oficial</span>
      </div>
      <span class="preset-main">${pct(p.originalRate)} original · ${pct(p.interestRate)} juros</span>
      <span class="preset-meta">${mode === 'avista' ? 'Pagamento único · PIX' : `Entrada 50% · Boleto até ${maxBoleto}x · Cartão até ${maxCartao}x`}</span>
    `;
    button.addEventListener('click', () => applyPreset(mode));
    box.appendChild(button);
  });
}

function getMaxInstallments(profile, period, method) {
  const p = officialFor(profile, period, $('modalidade').value);
  if (!p) return 8;
  if (method === 'cartao') return p.maxCartao || 8;
  return p.maxBoleto || 3;
}

function updatePaymentControls() {
  const mode = $('modalidade').value;
  const parcelasWrap = $('parcelasWrap');
  const entradaWrap = $('entradaWrap');
  const parcelas = $('parcelas');
  const entrada = $('entradaPct');

  const isAvista = mode === 'avista';
  parcelasWrap.style.display = isAvista ? 'none' : '';
  entradaWrap.style.display = isAvista ? 'none' : '';

  if (isAvista) {
    parcelas.value = '1';
    entrada.value = '100';
  } else if (Number(parcelas.value) < 2) {
    parcelas.value = '3';
  }

  updatePaymentRule();
}

function updatePaymentRule() {
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const mode = $('modalidade').value;
  const method = $('metodo').value;
  const max = getMaxInstallments(profile, period, method);

  let text = `Referência atual: ${profileLabel(profile)} / ${period}. `;
  if (mode === 'avista') {
    text += 'Pagamento em parcela única.';
  } else {
    text += `Limite configurado para ${methodLabel(method)}: até ${max} parcela(s).`;
  }

  if (profile === 'LINK') {
    text += ' Link Dedicado deve ser tratado como negociação sob medida; esta tela funciona como simulador de referência.';
  }

  $('paymentRule').textContent = text;
}

function updateValidation() {
  const box = $('validationBox');
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const method = $('metodo').value;
  const mode = $('modalidade').value;
  const p = officialFor(profile, period, mode);
  const n = mode === 'avista' ? 1 : Number($('parcelas').value);
  const max = getMaxInstallments(profile, period, method);

  if (mode === 'parcelado' && n > max) {
    box.className = 'validation error';
    box.textContent = `Configuração acima do limite de referência: ${methodLabel(method)} permite até ${max} parcela(s) neste cenário.`;
    return;
  }

  if (p) {
    box.className = 'validation';
    box.textContent = `Política disponível para teste: ${pct(p.originalRate)} de desconto no original e ${pct(p.interestRate)} nos juros/multas para ${modeLabel(mode).toLowerCase()}.`;
  } else {
    box.className = 'validation';
    box.textContent = 'Cenário livre sem política oficial correspondente.';
  }
}

function calcScenario() {
  const profile = $('perfil').value;
  const period = $('periodo').value;
  const mode = $('modalidade').value;
  const method = $('metodo').value;
  const original = num($('original').value);
  const interest = num($('juros').value);
  const originalRate = clamp(num($('descontoOriginal').value), 0, 100);
  const interestRate = clamp(num($('descontoJuros').value), 0, 100);
  const gross = original + interest;

  const discountOriginalValue = original * originalRate / 100;
  const discountInterestValue = interest * interestRate / 100;
  const discountValue = discountOriginalValue + discountInterestValue;
  const net = Math.max(0, gross - discountValue);

  let n = mode === 'avista' ? 1 : Math.max(2, Number($('parcelas').value) || 3);
  let entryPct = mode === 'avista' ? 100 : clamp(num($('entradaPct').value), 0, 100);

  const entry = net * entryPct / 100;
  const remainder = Math.max(0, net - entry);
  const installmentCount = Math.max(1, n - 1);
  const each = installmentCount ? remainder / installmentCount : 0;
  const schedule = [];

  if (mode === 'avista') {
    schedule.push({ when: 'Hoje', pct: 100, value: net });
  } else {
    schedule.push({ when: 'Entrada', pct: entryPct, value: entry });
    for (let i = 1; i < n; i += 1) {
      schedule.push({
        when: i === 1 ? 'D+30' : i === 2 ? 'D+60' : `D+${i * 30}`,
        pct: installmentCount ? (100 - entryPct) / installmentCount : 0,
        value: each
      });
    }
  }

  const d30 = mode === 'avista' ? net : schedule.slice(0, 2).reduce((sum, item) => sum + item.value, 0);
  const d60 = mode === 'avista' ? net : schedule.slice(0, 3).reduce((sum, item) => sum + item.value, 0);

  return {
    profile, period, mode, method, original, interest, gross,
    originalRate, interestRate, discountOriginalValue, discountInterestValue,
    discountValue, net, n, entryPct, entry, remainder, each, schedule,
    effectiveDiscount: gross ? discountValue / gross * 100 : 0,
    d30, d60,
    official: officialFor(profile, period, mode),
    name: buildScenarioName({ profile, period, mode })
  };
}

function scenarioMatchesOfficial(r) {
  const p = officialFor(r.profile, r.period, r.mode);
  if (!p) return false;
  return Number(r.originalRate) === Number(p.originalRate) && Number(r.interestRate) === Number(p.interestRate);
}

function renderScenario(r) {
  $('kpiBruto').textContent = money(r.gross);
  $('kpiDesconto').textContent = money(r.discountValue);
  $('kpiLiquido').textContent = money(r.net);
  $('kpiEntrada').textContent = money(r.entry);
  $('mDescOriginal').textContent = money(r.discountOriginalValue);
  $('mDescJuros').textContent = money(r.discountInterestValue);
  $('mDesconto').textContent = pct(r.effectiveDiscount);
  $('mD30').textContent = money(Math.min(r.net, r.d30));
  $('mD60').textContent = money(Math.min(r.net, r.d60));
  $('mSaldo').textContent = money(Math.max(0, r.net - r.d60));
  $('resultTag').textContent = `${profileLabel(r.profile)} · ${r.period}`;
  $('origRateDisplay').textContent = pct(r.originalRate);
  $('jurosRateDisplay').textContent = pct(r.interestRate);
  $('discountSummary').textContent = `Desconto total: ${money(r.discountValue)} · Original: ${money(r.discountOriginalValue)} · Juros/multas: ${money(r.discountInterestValue)}`;

  const schedule = $('schedulePreview');
  schedule.innerHTML = '';
  r.schedule.slice(0, 8).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'schedule-item';
    div.innerHTML = `<div class="when">${item.when}</div><strong>${money(item.value)}</strong><small>${pct(item.pct)}</small>`;
    schedule.appendChild(div);
  });

  const timeline = $('timeline');
  timeline.innerHTML = '';
  const nodes = r.mode === 'avista'
    ? [{ label: 'Hoje', value: r.net }, { label: 'Quitação', value: r.net }]
    : [
      { label: 'Hoje', value: r.entry },
      { label: 'D+30', value: r.schedule[1]?.value || 0 },
      { label: 'D+60', value: r.schedule[2]?.value || 0 },
      { label: `D+${Math.max(90, (r.n - 1) * 30)}`, value: r.schedule[3]?.value || 0 }
    ];

  nodes.forEach((node, index) => {
    const div = document.createElement('div');
    div.className = 'timeline-node';
    div.innerHTML = `<div class="timeline-dot">${index + 1}</div><strong>${node.label}</strong><small>${money(node.value)}</small>`;
    timeline.appendChild(div);
  });

  let message = `O cenário aplica <strong>${typeLabelFromRates(r.originalRate, r.interestRate)}</strong>: ${pct(r.originalRate)} sobre o original e ${pct(r.interestRate)} sobre juros/multas. `;
  if (r.mode === 'parcelado') {
    message += `A entrada representa <strong>${pct(r.entryPct)}</strong> do valor líquido, seguida de ${r.n - 1} parcela(s). `;
  } else {
    message += 'A quitação ocorre em parcela única. ';
  }
  if (r.method === 'cartao') {
    message += 'Juros da operadora do cartão não estão incluídos no cálculo.';
  }
  $('insightText').innerHTML = message;

  const badge = scenarioMatchesOfficial(r) ? 'Política oficial' : 'Simulação livre';
  $('policyBadge').textContent = badge;
}

function recalc() {
  updatePaymentControls();
  updateValidation();
  renderPresetButtons();
  const r = calcScenario();
  state.scenario = r;
  renderScenario(r);
}

function compactScenario(r) {
  return {
    original: r.original,
    interest: r.interest,
    gross: r.gross,
    discountOriginalValue: r.discountOriginalValue,
    discountInterestValue: r.discountInterestValue,
    discountValue: r.discountValue,
    net: r.net,
    originalRate: r.originalRate,
    interestRate: r.interestRate,
    entryPct: r.entryPct,
    entry: r.entry,
    n: r.n,
    mode: r.mode,
    method: r.method,
    profile: r.profile,
    period: r.period,
    each: r.each,
    name: r.name
  };
}

function addComparison(r) {
  const item = compactScenario(r);
  if (!item.name || item.name === `${profileLabel(r.profile)} ${r.period} · ${modeLabel(r.mode)}`) {
    item.name = `Cenário ${state.comparisons.length + 1}`;
  }
  state.comparisons.push(item);
  if (state.comparisons.length > 4) state.comparisons.shift();
  renderComparison();
}

function highlightConfig(key) {
  return {
    none: { label: 'Nenhum', metric: null, direction: null },
    liquido: { label: 'Maior valor líquido', metric: 'net', direction: 'max' },
    entrada: { label: 'Maior entrada', metric: 'entry', direction: 'max' },
    descontoTotal: { label: 'Menor desconto total', metric: 'discountValue', direction: 'min' },
    descontoOriginal: { label: 'Menor desconto no original', metric: 'discountOriginalValue', direction: 'min' },
    descontoJuros: { label: 'Menor desconto nos juros', metric: 'discountInterestValue', direction: 'min' },
    parcelas: { label: 'Menos parcelas', metric: 'n', direction: 'min' }
  }[key] || { label: 'Nenhum', metric: null, direction: null };
}

function getHighlightedIndexes() {
  const config = highlightConfig(state.highlight);
  if (!config.metric || !state.comparisons.length) return [];
  const values = state.comparisons.map((r) => Number(r[config.metric]) || 0);
  const target = config.direction === 'max' ? Math.max(...values) : Math.min(...values);
  return values.map((value, index) => value === target ? index : -1).filter((index) => index >= 0);
}

function renderComparison() {
  const headFallback = ['Cenário 1', 'Cenário 2', 'Cenário 3', 'Cenário 4'];
  headFallback.forEach((label, i) => {
    $(`headC${i}`).textContent = state.comparisons[i]?.name || label;
  });

  const metrics = [
    { key: 'original', label: 'Valor original', formatter: (r) => money(r.original) },
    { key: 'interest', label: 'Juros / multas', formatter: (r) => money(r.interest) },
    { key: 'gross', label: 'Valor bruto', formatter: (r) => money(r.gross) },
    { key: 'discountOriginalValue', label: 'Desconto no original', formatter: (r) => money(r.discountOriginalValue) },
    { key: 'discountInterestValue', label: 'Desconto nos juros', formatter: (r) => money(r.discountInterestValue) },
    { key: 'discountValue', label: 'Desconto total', formatter: (r) => money(r.discountValue) },
    { key: 'net', label: 'Valor líquido', formatter: (r) => money(r.net) },
    { key: 'effectiveDiscount', label: 'Desconto efetivo', formatter: (r) => pct(r.gross ? r.discountValue / r.gross * 100 : 0) },
    { key: 'entry', label: 'Entrada', formatter: (r) => money(r.entry) },
    { key: 'entryPct', label: 'Entrada (%)', formatter: (r) => pct(r.entryPct) },
    { key: 'n', label: 'Parcelas', formatter: (r) => String(r.n) },
    { key: 'each', label: 'Valor das parcelas seguintes', formatter: (r) => money(r.each) },
    { key: 'mode', label: 'Modalidade', formatter: (r) => modeLabel(r.mode) },
    { key: 'method', label: 'Forma de pagamento', formatter: (r) => methodLabel(r.method) },
    { key: 'originalRate', label: 'Taxa no original', formatter: (r) => pct(r.originalRate) },
    { key: 'interestRate', label: 'Taxa nos juros', formatter: (r) => pct(r.interestRate) }
  ];

  const body = $('compareBody');
  body.innerHTML = '';
  const highlighted = getHighlightedIndexes();
  const config = highlightConfig(state.highlight);

  metrics.forEach((metric) => {
    const tr = document.createElement('tr');
    if (config.metric === metric.key) tr.classList.add('highlight-row');

    const labelCell = document.createElement('td');
    labelCell.className = 'label-cell';
    labelCell.textContent = metric.label;
    tr.appendChild(labelCell);

    state.comparisons.forEach((scenario, idx) => {
      const td = document.createElement('td');
      td.textContent = metric.formatter(scenario);
      if (config.metric === metric.key && highlighted.includes(idx)) {
        td.classList.add('highlight-cell');
      }
      tr.appendChild(td);
    });

    for (let i = state.comparisons.length; i < 4; i += 1) {
      tr.appendChild(document.createElement('td'));
    }

    body.appendChild(tr);
  });

  $('compareCount').textContent = String(state.comparisons.length);
  $('compareHighlightLabel').textContent = config.label;

  renderCompareBars();
  renderCompareDetail();
}

function renderCompareBars() {
  const bars = $('compareBars');
  bars.innerHTML = '';

  if (!state.comparisons.length) {
    bars.innerHTML = '<div class="bar-card"><strong>Nenhum cenário adicionado ainda.</strong><p class="compare-note">Volte ao simulador e clique em “Adicionar cenário atual”.</p></div>';
    return;
  }

  const charts = [
    { title: 'Valor líquido', key: 'net' },
    { title: 'Caixa na entrada', key: 'entry' }
  ];

  charts.forEach((chartData) => {
    const card = document.createElement('div');
    card.className = 'bar-card';
    card.innerHTML = `<strong>${chartData.title}</strong>`;
    const max = Math.max(...state.comparisons.map((r) => Number(r[chartData.key]) || 0), 1);

    state.comparisons.forEach((r, index) => {
      const selected = getHighlightedIndexes().includes(index);
      card.insertAdjacentHTML('beforeend', `
        <div class="bar-row"${selected ? ' style="font-weight:900"' : ''}>
          <span>${index + 1}. ${r.name}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${((Number(r[chartData.key]) || 0) / max) * 100}%"></div></div>
          <b>${money(r[chartData.key])}</b>
        </div>
      `);
    });

    bars.appendChild(card);
  });
}

function renderCompareDetail() {
  const box = $('compareDetail');
  box.innerHTML = '';
  if (!state.comparisons.length) return;

  const highlighted = getHighlightedIndexes();
  if (!highlighted.length) return;

  const config = highlightConfig(state.highlight);
  const cards = highlighted.map((index) => {
    const r = state.comparisons[index];
    return `
      <div class="detail-card">
        <strong>${r.name}</strong> — destaque: ${config.label.toLowerCase()}.
        <div class="detail-list">
          <div class="detail-item"><span>Original</span><b>${money(r.original)}</b></div>
          <div class="detail-item"><span>Juros</span><b>${money(r.interest)}</b></div>
          <div class="detail-item"><span>Desconto total</span><b>${money(r.discountValue)}</b></div>
          <div class="detail-item"><span>Valor líquido</span><b>${money(r.net)}</b></div>
          <div class="detail-item"><span>Entrada</span><b>${money(r.entry)} (${pct(r.entryPct)})</b></div>
          <div class="detail-item"><span>Parcelas</span><b>${r.n} · ${methodLabel(r.method)}</b></div>
        </div>
      </div>
    `;
  }).join('');
  box.innerHTML = cards;
}

function renderPolicies() {
  const box = $('policyCards');
  box.innerHTML = '';

  ['B2C', 'B2B'].forEach((profile) => {
    ['2020-2023', '2024', '2025', '2026'].forEach((period) => {
      const p = POLICIES[profile][period];
      const card = document.createElement('div');
      card.className = 'policy-card';
      card.innerHTML = `
        <h3>${profile} · ${period}</h3>
        <div class="policy-meta">Descontos separados por componente.</div>
        <div class="policy-row"><span>À vista — original</span><strong>${pct(p.avista.originalRate)}</strong></div>
        <div class="policy-row"><span>À vista — juros</span><strong>${pct(p.avista.interestRate)}</strong></div>
        <div class="policy-row"><span>Parcelado — original</span><strong>${pct(p.parcelado.originalRate)}</strong></div>
        <div class="policy-row"><span>Parcelado — juros</span><strong>${pct(p.parcelado.interestRate)}</strong></div>
        <div class="policy-row"><span>Limite boleto</span><strong>${p.parcelado.maxBoleto}x</strong></div>
        <div class="policy-row"><span>Limite cartão</span><strong>${p.parcelado.maxCartao}x</strong></div>
      `;
      box.appendChild(card);
    });
  });
}

function saveScenario() {
  const name = ($('scenarioNameSave').value || '').trim();
  if (!name) return;
  const r = state.scenario || calcScenario();
  const item = {
    id: crypto.randomUUID(),
    name,
    savedAt: new Date().toISOString(),
    ...compactScenario(r)
  };
  state.history.unshift(item);
  state.history = state.history.slice(0, 30);
  localStorage.setItem('master-simulador-history', JSON.stringify(state.history));
  $('saveDialog').close();
  $('scenarioNameSave').value = '';
  renderHistory();
}

function renderHistory() {
  const box = $('historyList');
  box.innerHTML = '';
  if (!state.history.length) {
    box.innerHTML = '<div class="history-item"><div><h4>Nenhum cenário salvo</h4><small>Use “Salvar cenário” para guardar uma configuração neste navegador.</small></div></div>';
    return;
  }

  state.history.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.innerHTML = `
      <div>
        <h4>${item.name}</h4>
        <small>${new Date(item.savedAt).toLocaleString('pt-BR')}</small>
      </div>
      <div class="history-meta">
        <span>${profileLabel(item.profile)} · ${item.period}</span>
        <span>${modeLabel(item.mode)}</span>
        <span>${money(item.net)}</span>
        <button class="secondary-btn load-history">Carregar</button>
        <button class="ghost-btn danger delete-history">Excluir</button>
      </div>
    `;
    row.querySelector('.load-history').addEventListener('click', () => loadHistory(item));
    row.querySelector('.delete-history').addEventListener('click', () => {
      state.history = state.history.filter((x) => x.id !== item.id);
      localStorage.setItem('master-simulador-history', JSON.stringify(state.history));
      renderHistory();
    });
    box.appendChild(row);
  });
}

function loadHistory(item) {
  $('perfil').value = item.profile;
  $('periodo').value = item.period;
  $('modalidade').value = item.mode;
  $('metodo').value = item.method;
  $('original').value = item.original;
  $('juros').value = item.interest;
  $('descontoOriginal').value = item.originalRate;
  $('descontoJuros').value = item.interestRate;
  $('entradaPct').value = item.entryPct;
  $('parcelas').value = item.n;
  $('scenarioName').value = item.name;
  recalc();
  switchTab('simulador');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${name}`);
  });
  if (name === 'comparador') renderComparison();
  if (name === 'politicas') renderPolicies();
  if (name === 'historico') renderHistory();
}

// Eventos de navegação

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

// Entradas que devem recalcular em tempo real.
[
  'perfil', 'periodo', 'modalidade', 'metodo', 'parcelas',
  'original', 'juros', 'descontoOriginal', 'descontoJuros', 'entradaPct', 'scenarioName'
].forEach((id) => {
  $(id).addEventListener('input', recalc);
  $(id).addEventListener('change', recalc);
});

// Comparador
$('btnAddCurrent').addEventListener('click', () => addComparison(state.scenario || calcScenario()));
$('btnClearCompare').addEventListener('click', () => {
  state.comparisons = [];
  state.highlight = 'none';
  document.querySelectorAll('.highlight-btn').forEach((button) => button.classList.toggle('active', button.dataset.highlight === 'none'));
  renderComparison();
});

document.querySelectorAll('.highlight-btn').forEach((button) => {
  button.addEventListener('click', () => {
    state.highlight = button.dataset.highlight;
    document.querySelectorAll('.highlight-btn').forEach((item) => item.classList.toggle('active', item === button));
    renderComparison();
  });
});

// Cabeçalho
$('btnReset').addEventListener('click', () => location.reload());
$('btnSave').addEventListener('click', () => $('saveDialog').showModal());
$('saveForm').addEventListener('submit', (event) => {
  event.preventDefault();
  saveScenario();
});
$('btnClearHistory').addEventListener('click', () => {
  if (!confirm('Excluir todos os cenários salvos?')) return;
  state.history = [];
  localStorage.removeItem('master-simulador-history');
  renderHistory();
});

// Inicialização
renderPolicies();
renderHistory();
renderComparison();
recalc();
