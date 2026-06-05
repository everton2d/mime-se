// ══════════════════════════════════════
// FIX 2: XSS — escapa HTML antes de inserir no DOM
// ══════════════════════════════════════
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ══════════════════════════════════════
// ROUTING
// ══════════════════════════════════════
function showDashPage(name) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active'));
  document.getElementById('dp-' + name)?.classList.add('active');
  document.querySelectorAll('.dash-nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.page === name)
  );
  const loaders = {
    painel: loadPainel, links: loadPageLinks, grupos: loadPageGrupos,
    leads: loadPageLeads, config: loadPageConfig, lojas: loadPageLojas,
    stories: loadPageStories, disparo: loadPageDisparo
  };
  loaders[name]?.();
}

// ══════════════════════════════════════
// HELPERS — TOGGLES E OLHO
// ══════════════════════════════════════
function toggleFormToggle(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.on = el.dataset.on === 'true' ? 'false' : 'true';
}

function toggleEye(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.style.opacity = input.type === 'text' ? '1' : '.5';
}

function getToggle(id) { return document.getElementById(id)?.dataset.on === 'true'; }
function setToggle(id, val) { const el = document.getElementById(id); if (el) el.dataset.on = val ? 'true' : 'false'; }
function getVal(id) { return document.getElementById(id)?.value.trim() || ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

// ══════════════════════════════════════
// LOAD DASHBOARD (entry point)
// ══════════════════════════════════════
async function loadDashboard() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showPage('login'); return; }

  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();

  if (profile) {
    document.getElementById('dash-user-name').textContent = profile.nome || session.user.email;
    document.getElementById('dash-plan-badge').textContent = profile.plano.toUpperCase();
  }

  const h = new Date().getHours();
  const gr = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = profile?.nome?.split(' ')[0] || 'usuário';
  const el = document.getElementById('dash-greeting');
  if (el) el.textContent = `${gr}, ${firstName} 👋`;

  const dateEl = document.getElementById('dash-date');
  if (dateEl) {
    const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    dateEl.textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }

  // FIX 1: guard contra listeners duplicados
  if (!window._dashListenersAttached) {
    window._dashListenersAttached = true;

    document.querySelectorAll('.dash-nav-item').forEach(item =>
      item.addEventListener('click', () => showDashPage(item.dataset.page))
    );

    document.getElementById('dash-toggle')?.addEventListener('click', () => {
      const html = document.documentElement;
      html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', html.dataset.theme);
    });

    // FIX 1: único MutationObserver para redesenhar o gráfico
    new MutationObserver(() => {
      if (window._chartData) drawChart(window._chartData);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  showDashPage('painel');
}

// ══════════════════════════════════════
// PAINEL
// ══════════════════════════════════════
async function loadPainel() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  const [lR, gR, dR, ldR] = await Promise.all([
    sb.from('links').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sb.from('grupos').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', true),
    sb.from('disparos').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'enviado'),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', true),
  ]);

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
  setText('stat-links', lR.count);
  setText('stat-grupos', gR.count);
  setText('stat-disparos', dR.count);
  setText('stat-leads', ldR.count);

  // Chart: últimos 7 dias
  const labels = [], counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));
    counts.push(0);
  }
  const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0,0,0,0);
  const { data: cl } = await sb.from('links').select('created_at').eq('user_id', uid).gte('created_at', since.toISOString());
  cl?.forEach(l => {
    const ago = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000);
    const idx = 6 - ago;
    if (idx >= 0 && idx < 7) counts[idx]++;
  });

  window._chartData = labels.map((label, i) => ({ label, value: counts[i] }));
  drawChart(window._chartData);

  const { data: recent } = await sb.from('links')
    .select('id, url_original, plataforma, titulo, preco, created_at')
    .eq('user_id', uid).order('created_at', { ascending: false }).limit(5);
  renderRecentLinks(recent || []);
}

// ══════════════════════════════════════
// CHART — canvas theme-aware
// ══════════════════════════════════════
function drawChart(data) {
  const canvas = document.getElementById('activity-chart');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth || 400;
  const H = 140;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.dataset.theme !== 'light';
  const gridColor = isDark ? 'rgba(242,96,58,.1)' : 'rgba(242,96,58,.12)';
  const labelColor = isDark ? 'rgba(245,237,232,.32)' : 'rgba(26,12,7,.38)';

  const pL = 28, pR = 8, pT = 10, pB = 26;
  const cW = W - pL - pR, cH = H - pT - pB;
  const max = Math.max(...data.map(d => d.value), 1);
  const gap = cW / data.length;
  const bW = gap * 0.5;

  for (let i = 0; i <= 3; i++) {
    const y = pT + (cH / 3) * i;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(W - pR, y);
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1; ctx.stroke();
    const val = Math.round(max - (max / 3) * i);
    ctx.fillStyle = labelColor; ctx.font = `500 9px 'Plus Jakarta Sans',sans-serif`;
    ctx.textAlign = 'right'; ctx.fillText(val || '', pL - 4, y + 3);
  }

  data.forEach((d, i) => {
    const x = pL + gap * i + gap / 2 - bW / 2;
    const bH = Math.max((d.value / max) * cH, d.value > 0 ? 4 : 2);
    const y = pT + cH - bH;
    const r = Math.min(4, bH / 2);
    if (d.value === 0) {
      ctx.fillStyle = gridColor;
      ctx.fillRect(x, pT + cH - 2, bW, 2);
    } else {
      const grad = ctx.createLinearGradient(x, y, x, pT + cH);
      grad.addColorStop(0, '#F2603A'); grad.addColorStop(1, '#F5913A');
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.lineTo(x + bW - r, y);
      ctx.quadraticCurveTo(x + bW, y, x + bW, y + r);
      ctx.lineTo(x + bW, pT + cH); ctx.lineTo(x, pT + cH);
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    }
    ctx.fillStyle = labelColor; ctx.font = `600 9px 'Plus Jakarta Sans',sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText(d.label, x + bW / 2, H - 6);
  });
}

// ══════════════════════════════════════
// RECENT LINKS
// ══════════════════════════════════════
function renderRecentLinks(links) {
  const tbody = document.getElementById('recent-links-tbody');
  if (!tbody) return;
  if (!links.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="empty-icon">🔗</span><div class="empty-title">Nenhum link ainda</div><div class="empty-desc">Cole um link acima para começar.</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = links.map(l => {
    const plat = escapeHtml(l.plataforma || 'outro');
    const titulo = escapeHtml(l.titulo || (l.url_original || '').substring(0, 38) + '…');
    const data = new Date(l.created_at).toLocaleDateString('pt-BR');
    return `<tr>
      <td><span class="plat-badge plat-${plat}">${plat}</span></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)">${titulo}</td>
      <td>${escapeHtml(l.preco) || '—'}</td>
      <td>${data}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════
// GERADOR RÁPIDO — FIX 4: botão sempre reset
// ══════════════════════════════════════
async function gerarLink() {
  const input = document.getElementById('quick-url')?.value.trim();
  const resultEl = document.getElementById('quick-result');
  const btn = document.getElementById('quick-btn');
  if (!input) { showToast('Cole um link de produto primeiro.', 'err'); return; }

  btn.disabled = true; btn.textContent = '⟳ Gerando...';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { showPage('login'); return; }

    const plataforma = detectarPlataforma(input);
    const { data, error } = await sb.from('links').insert({
      user_id: session.user.id, url_original: input, url_afiliado: input, plataforma,
    }).select().single();

    if (error) { showToast('Erro: ' + error.message, 'err'); return; }

    resultEl.innerHTML = `
      <div style="font-size:.73rem;color:var(--tx3);margin-bottom:.4rem">✅ Plataforma detectada: <strong style="color:var(--coral)">${escapeHtml(plataforma)}</strong></div>
      <span class="quick-result-link">${escapeHtml(data.url_afiliado)}</span>`;
    resultEl.classList.add('show');
    showToast('Link gerado!', 'ok');
    loadPainel();
  } finally {
    // FIX 4: garante que botão sempre volta ao estado normal
    btn.disabled = false; btn.textContent = '⚡ Gerar Link';
  }
}

function detectarPlataforma(url) {
  if (/shopee/i.test(url)) return 'shopee';
  if (/amazon|amzn/i.test(url)) return 'amazon';
  if (/magazineluiza|magalu/i.test(url)) return 'magalu';
  if (/mercadolivre|mercadolibre|\.ml\.com/i.test(url)) return 'mercadolivre';
  if (/natura/i.test(url)) return 'natura';
  if (/shein/i.test(url)) return 'shein';
  if (/avon/i.test(url)) return 'avon';
  return 'outro';
}

// ══════════════════════════════════════
// MEUS LINKS
// ══════════════════════════════════════
let _currentFilter = 'todos';

async function loadPageLinks(filter) {
  if (filter !== undefined) _currentFilter = filter;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  let q = sb.from('links').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
  if (_currentFilter !== 'todos') q = q.eq('plataforma', _currentFilter);

  const { data: links } = await q;
  renderLinksTable(links || []);
}

function renderLinksTable(links) {
  const tbody = document.getElementById('links-page-tbody');
  if (!tbody) return;
  if (!links.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">🔗</span><div class="empty-title">Nenhum link encontrado</div><div class="empty-desc">Gere seu primeiro link no painel.</div></div></td></tr>`;
    return;
  }
  // FIX 2+3: escapa HTML e usa data-url para evitar XSS no copyLink
  tbody.innerHTML = links.map(l => {
    const plat = escapeHtml(l.plataforma || 'outro');
    const titulo = escapeHtml(l.titulo || '—');
    const data = new Date(l.created_at).toLocaleDateString('pt-BR');
    const url = escapeHtml(l.url_afiliado || l.url_original || '');
    return `<tr>
      <td><span class="plat-badge plat-${plat}">${plat}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)">${titulo}</td>
      <td style="color:var(--tx)">${escapeHtml(l.preco) || '—'}</td>
      <td>${data}</td>
      <td><button class="btn-copy" data-url="${url}" onclick="copyLink(this.dataset.url, this)">Copiar</button></td>
    </tr>`;
  }).join('');
}

function copyLink(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copiado'; btn.style.color = '#15803d';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
  });
}

function setFilter(filter, el) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadPageLinks(filter);
}

// ══════════════════════════════════════
// GRUPOS WHATSAPP
// ══════════════════════════════════════
async function loadPageGrupos() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data: grupos } = await sb.from('grupos').select('*')
    .eq('user_id', session.user.id).order('created_at', { ascending: false });
  renderGrupos(grupos || []);
}

function renderGrupos(grupos) {
  const el = document.getElementById('grupos-container');
  if (!el) return;
  if (!grupos.length) {
    el.innerHTML = `<div class="empty-state"><span class="empty-icon">💬</span><div class="empty-title">Nenhum grupo adicionado</div><div class="empty-desc">Conecte seus grupos de WhatsApp para disparar ofertas automaticamente.</div></div>`;
    return;
  }
  // FIX 2: escapa nomes dos grupos
  el.innerHTML = `<div class="grupos-grid">${grupos.map(g => `
    <div class="grupo-card">
      <div class="grupo-name">${escapeHtml(g.nome)}</div>
      <div class="grupo-nicho">${escapeHtml(g.nicho) || 'Sem nicho definido'}</div>
      <div class="grupo-meta">
        <span class="grupo-members">👥 ${parseInt(g.membros) || 0} membros</span>
        <span class="status-dot ${g.ativo ? '' : 'inactive'}">${g.ativo ? 'Ativo' : 'Inativo'}</span>
      </div>
    </div>`).join('')}</div>`;
}

// ══════════════════════════════════════
// LEADS
// ══════════════════════════════════════
async function loadPageLeads() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  const [tot, atv, sai] = await Promise.all([
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', true),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', false),
  ]);

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
  setText('leads-total', tot.count); setText('leads-ativos', atv.count); setText('leads-saidos', sai.count);

  const { data: leads } = await sb.from('leads')
    .select('*, grupos(nome)').eq('user_id', uid)
    .order('created_at', { ascending: false }).limit(20);

  const tbody = document.getElementById('leads-tbody');
  if (!tbody) return;
  if (!leads?.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="empty-icon">👥</span><div class="empty-title">Nenhum lead ainda</div><div class="empty-desc">Os leads aparecem aqui quando membros entrarem nos seus grupos monitorados.</div></div></td></tr>`;
    return;
  }
  // FIX 2: escapa dados de leads
  tbody.innerHTML = leads.map(l => `<tr>
    <td style="color:var(--tx)">${escapeHtml(l.telefone) || '—'}</td>
    <td>${escapeHtml(l.grupos?.nome) || '—'}</td>
    <td>${l.entrou_em ? new Date(l.entrou_em).toLocaleDateString('pt-BR') : '—'}</td>
    <td>${l.ativo ? '<span style="color:#15803d;font-weight:700">● Ativo</span>' : '<span style="color:var(--tx3)">○ Saiu</span>'}</td>
  </tr>`).join('');
}

// ══════════════════════════════════════
// CONFIGURAÇÕES
// ══════════════════════════════════════
async function loadPageConfig() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  const [{ data: profile }, { data: config }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).single(),
    sb.from('configuracoes').select('*').eq('user_id', uid).single(),
  ]);

  if (profile) {
    setVal('cfg-nome', profile.nome);
    setVal('cfg-email', profile.email);
    setVal('cfg-wpp', profile.whatsapp);
    const pn = document.getElementById('cfg-plan-name');
    if (pn) pn.textContent = profile.plano.charAt(0).toUpperCase() + profile.plano.slice(1);
  }
  if (config) {
    setVal('cfg-intervalo', config.intervalo_min);
    setVal('cfg-inicio', config.horario_inicio?.substring(0, 5));
    setVal('cfg-fim', config.horario_fim?.substring(0, 5));
  }
}

async function handleSaveProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const nome = document.getElementById('cfg-nome')?.value.trim();
    const wpp  = document.getElementById('cfg-wpp')?.value.trim();
    const { error } = await sb.from('profiles').update({ nome, whatsapp: wpp }).eq('id', session.user.id);
    if (error) { showToast('Erro: ' + error.message, 'err'); return; }
    showToast('Perfil atualizado!', 'ok');
    const nameEl = document.getElementById('dash-user-name');
    if (nameEl) nameEl.textContent = nome;
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar alterações';
  }
}

async function handleSaveConfig() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const btn = document.getElementById('btn-save-config');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const intervalo_min = parseInt(document.getElementById('cfg-intervalo')?.value) || 5;
    const horario_inicio = document.getElementById('cfg-inicio')?.value;
    const horario_fim    = document.getElementById('cfg-fim')?.value;
    const { error } = await sb.from('configuracoes')
      .update({ intervalo_min, horario_inicio, horario_fim }).eq('user_id', session.user.id);
    if (error) { showToast('Erro: ' + error.message, 'err'); return; }
    showToast('Configurações salvas!', 'ok');
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar preferências';
  }
}

// ══════════════════════════════════════
// PAGE: CONFIGURAÇÃO DE LOJAS
// ══════════════════════════════════════
async function loadPageLojas() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const { data: configs } = await sb.from('marketplace_configs').select('*').eq('user_id', session.user.id);
  if (!configs?.length) return;

  const map = Object.fromEntries(configs.map(c => [c.marketplace, c]));

  const fill = (mkt, fields) => {
    const c = map[mkt];
    if (!c) return;
    fields.forEach(([id, key]) => setVal(id, c.config?.[key]));
    const prefix = { mercadolivre:'ml', amazon:'amz', shopee:'sp', magalu:'mg', natura:'nat', shein:'sh' }[mkt];
    if (prefix) setToggle(`${prefix}-converter`, c.converter_links);
  };

  fill('mercadolivre', [['ml-etiqueta','etiqueta'],['ml-extensao','extensao']]);
  fill('amazon', [['amz-tag','tag'],['amz-key','key'],['amz-secret','secret'],['amz-cred-id','cred_id'],['amz-cred-secret','cred_secret'],['amz-extensao','extensao']]);
  if (map['shopee']) {
    setVal('sp-appid', map['shopee'].config?.appid);
    setVal('sp-secret', map['shopee'].config?.secret);
    setToggle('sp-converter', map['shopee'].converter_links);
    setToggle('sp-pix', map['shopee'].config?.pix_ativo);
  }
  fill('magalu', [['mg-tag','tag'],['mg-promoter','promoter_id'],['mg-partner','partner_id']]);
  fill('natura', [['nat-tag','tag']]);
  fill('shein', [['sh-extensao','extensao']]);
}

// FIX 3: recebe btn como parâmetro em vez de usar event?.target
async function saveMarketplace(mkt, btn) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const configs = {
    mercadolivre: { config: { etiqueta: getVal('ml-etiqueta'), extensao: getVal('ml-extensao') }, converter_links: getToggle('ml-converter') },
    amazon:       { config: { tag: getVal('amz-tag'), key: getVal('amz-key'), secret: getVal('amz-secret'), cred_id: getVal('amz-cred-id'), cred_secret: getVal('amz-cred-secret'), extensao: getVal('amz-extensao') }, converter_links: getToggle('amz-converter') },
    shopee:       { config: { appid: getVal('sp-appid'), secret: getVal('sp-secret'), pix_ativo: getToggle('sp-pix') }, converter_links: getToggle('sp-converter') },
    magalu:       { config: { tag: getVal('mg-tag'), promoter_id: getVal('mg-promoter'), partner_id: getVal('mg-partner') }, converter_links: getToggle('mg-converter') },
    natura:       { config: { tag: getVal('nat-tag') }, converter_links: getToggle('nat-converter') },
    shein:        { config: { extensao: getVal('sh-extensao') }, converter_links: getToggle('sh-converter') },
  };

  const payload = configs[mkt];
  if (!payload) return;

  if (mkt === 'shopee' && (!getVal('sp-appid') || !getVal('sp-secret'))) {
    showToast('APP ID e Secret Key são obrigatórios.', 'err'); return;
  }
  if (mkt === 'amazon' && !getVal('amz-tag')) {
    showToast('USER TAG é obrigatório.', 'err'); return;
  }

  const origText = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Salvando...'; }

  try {
    const { error } = await sb.from('marketplace_configs').upsert({
      user_id: session.user.id, marketplace: mkt, ...payload, ativo: true,
    }, { onConflict: 'user_id,marketplace' });
    if (error) { showToast('Erro: ' + error.message, 'err'); return; }
    showToast(`${mkt.charAt(0).toUpperCase() + mkt.slice(1)} configurado! ✅`, 'ok');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origText || '💾 Salvar'; }
  }
}

// ══════════════════════════════════════
// PAGE: TEMPLATE DE STORIES
// ══════════════════════════════════════
async function loadPageStories() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const { data } = await sb.from('template_stories').select('*').eq('user_id', session.user.id).single();
  if (!data) return;

  document.querySelectorAll('.layout-card').forEach(c => c.classList.toggle('active', c.dataset.layout === data.layout));
  document.querySelectorAll('.modelo-thumb').forEach(t => t.classList.toggle('active', parseInt(t.dataset.modelo) === data.modelo));

  const cores = data.cores || {};
  const setColor = (id, valId, val) => {
    const el = document.getElementById(id); const vl = document.getElementById(valId);
    if (el && val) el.value = val;
    if (vl && val) vl.textContent = val;
  };
  setColor('cor-nome', 'cor-nome-val', cores.nome_produto);
  setColor('cor-preco-de', 'cor-preco-de-val', cores.preco_de);
  setColor('cor-preco-por', 'cor-preco-por-val', cores.preco_por);
  setColor('cor-fundo-preco', 'cor-fundo-preco-val', cores.fundo_preco_por);
  setColor('cor-parc', 'cor-parc-val', cores.parcelamento);
  updateStoryPreview();
}

function selectLayout(el) {
  document.querySelectorAll('.layout-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function selectModelo(el) {
  document.querySelectorAll('.modelo-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const bgs = ['','linear-gradient(160deg,#ff6b35,#ee4d2d)','linear-gradient(160deg,#232f3e,#ff9900)','linear-gradient(160deg,#0086ff,#003fa5)','linear-gradient(160deg,#ffe600,#ffa500)','linear-gradient(160deg,#008b4f,#006b3c)','linear-gradient(160deg,#1a1a1a,#4a0080)','linear-gradient(160deg,#F2603A,#F5913A)','linear-gradient(160deg,#2d2d2d,#555)'];
  const bg = document.getElementById('sp-bg');
  if (bg) bg.style.background = bgs[parseInt(el.dataset.modelo)] || bgs[1];
}

function updateColorVal(input, valId) {
  const el = document.getElementById(valId);
  if (el) el.textContent = input.value;
}

function updateStoryPreview() {
  const get = id => document.getElementById(id)?.value || '';
  const setStyle = (id, prop, val) => { const el = document.getElementById(id); if (el) el.style[prop] = val; };
  setStyle('sp-pname', 'color', get('cor-nome'));
  setStyle('sp-pde', 'color', get('cor-preco-de'));
  setStyle('sp-ppor', 'color', get('cor-preco-por'));
  setStyle('sp-ppor-wrap', 'background', get('cor-fundo-preco'));
  setStyle('sp-parc', 'color', get('cor-parc'));
}

async function saveTemplateStories() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const layout = document.querySelector('.layout-card.active')?.dataset.layout || 'padrao';
  const modelo = parseInt(document.querySelector('.modelo-thumb.active')?.dataset.modelo || '1');
  const cores = {
    nome_produto:    document.getElementById('cor-nome')?.value,
    preco_de:        document.getElementById('cor-preco-de')?.value,
    preco_por:       document.getElementById('cor-preco-por')?.value,
    fundo_preco_por: document.getElementById('cor-fundo-preco')?.value,
    parcelamento:    document.getElementById('cor-parc')?.value,
  };
  const { error } = await sb.from('template_stories').upsert(
    { user_id: session.user.id, layout, modelo, cores }, { onConflict: 'user_id' }
  );
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Template de Stories salvo! ✅', 'ok');
}

function handleStoryUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 3.1 * 1024 * 1024) { showToast('Arquivo muito grande. Máximo 3.1 MB.', 'err'); return; }
  const url = URL.createObjectURL(file);
  const bg = document.getElementById('sp-bg');
  if (bg) { bg.style.background = 'none'; bg.style.backgroundImage = `url(${url})`; bg.style.backgroundSize = 'cover'; bg.style.backgroundPosition = 'center'; }
  showToast('Imagem carregada! Salve para confirmar.', 'ok');
}

// ══════════════════════════════════════
// PAGE: TEXTO DE DISPARO
// ══════════════════════════════════════
const _EXEMPLO = { '{{gatilho_de_venda}}':'🔥 BAIXOUUU 🔥', '{{titulo}}':'Kit Amaciante Comfort 1,5L', '{{preco_de}}':'R$ 86,25', '{{preco_por}}':'R$ 32,00', '{{parcelamento}}':'21x de R$ 1,50 sem juros', '{{recorrencia}}':'R$ 29,00', '{{frete}}':'Frete grátis', '{{cupom}}':'PROMOS30', '{{informacao_extra}}':'Informação extra aparecerá aqui', '{{link_comissionado}}':'https://exemplo.com.br', '{{loja}}':'Shopee', '{{link_site_promos_pagina_inicial}}':'https://mimesepromos.com', '{{link_comissionado_2}}':'https://exemplo2.com.br' };

async function loadPageDisparo() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('texto_disparo').select('*').eq('user_id', session.user.id).single();
  const textarea = document.getElementById('disparo-template');
  if (textarea) {
    textarea.value = data?.template_geral || `🚨 {{gatilho_de_venda}} 🚨\n\n🛒 {{titulo}}\n\n❌ De: ~{{preco_de}}~\n🔥 Por: *{{preco_por}}*🔥\n\n💳 Parcelado em: {{parcelamento}}\n🔁 Recorrência: {{recorrencia}}\n🎁 {{frete}}\n🏷️ Use o cupom: {{cupom}}\nℹ️ {{informacao_extra}}\n\n👉 Compre aqui: {{link_comissionado}}\n\nPromoção sujeita a alteração a qualquer momento ⚠️`;
    updateDisparoPreview();
  }
  if (data?.modo_avancado !== undefined) setToggle('disparo-adv', data.modo_avancado);
}

function updateDisparoPreview() {
  const raw = document.getElementById('disparo-template')?.value || '';
  let rendered = raw;
  Object.entries(_EXEMPLO).forEach(([k, v]) => { rendered = rendered.replaceAll(k, v); });
  rendered = rendered
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<s>$1</s>');
  const preview = document.getElementById('disparo-preview');
  if (preview) preview.innerHTML = rendered.replace(/\n/g, '<br>');
}

function insertVar(varStr) {
  const ta = document.getElementById('disparo-template');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + varStr + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + varStr.length;
  ta.focus();
  updateDisparoPreview();
  showToast('Variável inserida!', 'ok');
}

function showModelosProntos() {
  const modelos = [
    `🚨 {{gatilho_de_venda}} 🚨\n\n🛒 {{titulo}}\n\n❌ De: ~{{preco_de}}~\n🔥 Por: *{{preco_por}}*🔥\n\n💳 {{parcelamento}}\n🎁 {{frete}}\n🏷️ Cupom: {{cupom}}\n\n👉 {{link_comissionado}}\n\n⚠️ Promoção sujeita a alteração`,
    `🔥 *{{titulo}}*\n\nDe ~{{preco_de}}~ por apenas *{{preco_por}}* 🤩\n\n{{parcelamento}}\n{{frete}}\n\n🔗 {{link_comissionado}}`,
    `⚡ ACHADO DO DIA ⚡\n\n📦 {{titulo}}\n💰 {{preco_por}}\n\n{{cupom}}\n{{frete}}\n\n➡️ {{link_comissionado}}`,
  ];
  const ta = document.getElementById('disparo-template');
  if (!ta) return;
  const idx = (window._modeloIdx || 0) % modelos.length;
  ta.value = modelos[idx];
  window._modeloIdx = idx + 1;
  updateDisparoPreview();
  showToast(`Modelo ${idx + 1} carregado!`, 'ok');
}

async function saveTextoDisparo() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const template_geral = document.getElementById('disparo-template')?.value || '';
  const modo_avancado = getToggle('disparo-adv');
  const { error } = await sb.from('texto_disparo').upsert(
    { user_id: session.user.id, template_geral, modo_avancado }, { onConflict: 'user_id' }
  );
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Modelo de disparo salvo! ✅', 'ok');
}
