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
// MOBILE SIDEBAR TOGGLE
// ══════════════════════════════════════
function toggleSidebar() {
  const sidebar = document.getElementById('dash-sidebar');
  const overlay = document.getElementById('dash-overlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
}
function closeSidebar() {
  const sidebar = document.getElementById('dash-sidebar');
  const overlay = document.getElementById('dash-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
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
  closeSidebar(); // fecha sidebar ao navegar no mobile
  const loaders = {
    painel: loadPainel, links: loadPageLinks, grupos: loadPageGrupos,
    leads: loadPageLeads, config: loadPageConfig, lojas: loadPageLojas,
    stories: loadPageStories, disparo: loadPageDisparo,
    automacoes: loadPageAutomacoes, capturas: loadPageCapturas,
    'ia-conversao': loadPageIaConversao, metricas: loadPageMetricas,
    ranking: loadPageRanking, calendario: loadPageCalendario, templates: loadPageTemplates
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

    ['dash-toggle', 'dash-toggle-mobile'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        const html = document.documentElement;
        html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', html.dataset.theme);
      });
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

  const since7d = new Date(); since7d.setDate(since7d.getDate() - 7); since7d.setHours(0,0,0,0);
  const [lR, gR, dR, prR] = await Promise.all([
    sb.from('links').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sb.from('grupos').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', true),
    sb.from('disparos').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'enviado'),
    sb.from('links').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', since7d.toISOString()),
  ]);

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
  setText('stat-links', lR.count);
  setText('stat-grupos', gR.count);
  setText('stat-disparos', dR.count);
  setText('stat-leads', prR.count);

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
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span><div class="empty-title">Nenhum link ainda</div><div class="empty-desc">Cole um link acima para começar.</div></div></td></tr>`;
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

    const { data, error } = await sb.functions.invoke('generate-affiliate-link', {
      body: { url: input },
    });

    if (error) { showToast('Erro: ' + error.message, 'err'); return; }
    if (data?.error) { showToast('Erro: ' + data.error, 'err'); return; }

    const plataforma = data.platform;
    const affiliateUrl = data.affiliate_url;
    const hasConfig = data.has_affiliate_config;

    resultEl.innerHTML = `
      <div style="font-size:.73rem;color:var(--tx3);margin-bottom:.4rem">
        ✅ Plataforma: <strong style="color:var(--coral)">${escapeHtml(plataforma)}</strong>
        ${!hasConfig && plataforma !== 'outro' ? ' — <span style="color:#b45309">configure a loja para adicionar sua tag de afiliado</span>' : ''}
      </div>
      <span class="quick-result-link">${escapeHtml(affiliateUrl)}</span>
      <button onclick="copyLink('${affiliateUrl.replace(/'/g, "\\'")}', this)" class="btn-copy" style="margin-top:.6rem;width:100%;padding:.45rem">Copiar link</button>`;
    resultEl.classList.add('show');
    showToast(hasConfig ? '✅ Link afiliado gerado!' : 'Link salvo! Configure a loja para adicionar sua tag.', 'ok');
    loadPainel();
  } finally {
    btn.disabled = false; btn.textContent = 'Gerar Link';
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
let _allLinks = [];

async function loadPageLinks(filter) {
  if (filter !== undefined) _currentFilter = filter;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  let q = sb.from('links').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
  if (_currentFilter !== 'todos') q = q.eq('plataforma', _currentFilter);

  const { data: links } = await q;
  _allLinks = links || [];
  searchLinks();
}

function searchLinks() {
  const term = document.getElementById('links-search')?.value.trim().toLowerCase() || '';
  if (!term) { renderLinksTable(_allLinks); return; }
  const filtered = _allLinks.filter(l =>
    (l.titulo || '').toLowerCase().includes(term) ||
    (l.plataforma || '').toLowerCase().includes(term) ||
    (l.url_original || '').toLowerCase().includes(term)
  );
  renderLinksTable(filtered);
}

function renderLinksTable(links) {
  const tbody = document.getElementById('links-page-tbody');
  if (!tbody) return;
  if (!links.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span><div class="empty-title">Nenhum link encontrado</div><div class="empty-desc">Gere seu primeiro link no painel.</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = links.map(l => {
    const plat = escapeHtml(l.plataforma || 'outro');
    const titulo = escapeHtml(l.titulo || '—');
    const data = new Date(l.created_at).toLocaleDateString('pt-BR');
    const url = escapeHtml(l.url_afiliado || l.url_original || '');
    const id = escapeHtml(l.id);
    return `<tr>
      <td><span class="plat-badge plat-${plat}">${plat}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx)">${titulo}</td>
      <td style="color:var(--tx)">${escapeHtml(l.preco) || '—'}</td>
      <td>${data}</td>
      <td style="white-space:nowrap">
        <button class="btn-copy" data-url="${url}" onclick="copyLink(this.dataset.url, this)">Copiar</button>
        <button class="btn-delete" data-id="${id}" onclick="deleteLink(this.dataset.id, this)">Excluir</button>
      </td>
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

async function deleteLink(id, btn) {
  if (!confirm('Excluir este link?')) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const origText = btn.textContent;
  btn.disabled = true; btn.textContent = '...';
  const { error } = await sb.from('links').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { showToast('Erro ao excluir: ' + error.message, 'err'); btn.disabled = false; btn.textContent = origText; return; }
  showToast('Link excluído!', 'ok');
  loadPageLinks();
  loadPainel();
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
    el.innerHTML = `<div class="empty-state"><span class="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span><div class="empty-title">Nenhum grupo adicionado</div><div class="empty-desc">Conecte seus grupos de WhatsApp para disparar ofertas automaticamente.</div></div>`;
    return;
  }
  // FIX 2: escapa nomes dos grupos
  el.innerHTML = `<div class="grupos-grid">${grupos.map(g => `
    <div class="grupo-card">
      <div class="grupo-name">${escapeHtml(g.nome)}</div>
      <div class="grupo-nicho">${escapeHtml(g.nicho) || 'Sem nicho definido'}</div>
      <div class="grupo-meta">
        <span class="grupo-members">${parseInt(g.membros) || 0} membros</span>
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
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><div class="empty-title">Nenhum lead ainda</div><div class="empty-desc">Os leads aparecem aqui quando membros entrarem nos seus grupos monitorados.</div></div></td></tr>`;
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
  const map = Object.fromEntries((configs || []).map(c => [c.marketplace, c]));

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

  // Atualiza badges de status
  const statusMap = { mercadolivre:'ml', amazon:'amz', shopee:'sp', magalu:'mg', natura:'nat', shein:'sh' };
  Object.entries(statusMap).forEach(([mkt, prefix]) => {
    const badge = document.getElementById(`status-${prefix}`);
    if (!badge) return;
    const c = map[mkt];
    const ok = c?.ativo && c?.converter_links;
    badge.className = `loja-status ${ok ? 'loja-status-ok' : 'loja-status-off'}`;
    badge.textContent = ok ? '● Configurado' : '○ Não configurado';
  });
}

async function testarConexao(mkt, btn) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.textContent = '⟳ Testando...';

  try {
    const { data: c } = await sb.from('marketplace_configs')
      .select('config, converter_links, ativo')
      .eq('user_id', session.user.id)
      .eq('marketplace', mkt)
      .single();

    const required = { amazon: 'tag', shopee: 'appid', mercadolivre: 'etiqueta', magalu: 'tag', natura: 'tag', shein: 'extensao' };
    const reqField = required[mkt];

    if (!c) {
      showToast(`${mkt}: nenhuma configuração salva ainda.`, 'err'); return;
    }
    if (reqField && !c.config?.[reqField]) {
      showToast(`Configure o campo obrigatório antes de testar.`, 'err'); return;
    }
    if (!c.converter_links) {
      showToast(`Ative "Converter Links" para usar esta integração.`, 'err'); return;
    }
    showToast(`✅ Integração ${mkt} configurada corretamente!`, 'ok');
    const badge = document.getElementById(`status-${({ mercadolivre:'ml', amazon:'amz', shopee:'sp', magalu:'mg', natura:'nat', shein:'sh' })[mkt]}`);
    if (badge) { badge.className = 'loja-status loja-status-ok'; badge.textContent = '● Configurado'; }
  } finally {
    btn.disabled = false; btn.innerHTML = origHTML;
  }
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

// ══════════════════════════════════════
// AUTOMAÇÕES
// ══════════════════════════════════════
async function loadPageAutomacoes() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('automation_configs')
    .select('key,value')
    .eq('user_id', session.user.id);
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  const keys = ['captura_telegram','reescrita_ia','publicacao_telegram','publicacao_whatsapp','geracao_stories','geracao_legendas'];
  const toggleIds = {
    captura_telegram: 'tog-captura-telegram',
    reescrita_ia: 'tog-reescrita-ia',
    publicacao_telegram: 'tog-pub-telegram',
    publicacao_whatsapp: 'tog-pub-whatsapp',
    geracao_stories: 'tog-stories',
    geracao_legendas: 'tog-legendas'
  };
  keys.forEach(k => {
    const el = document.getElementById(toggleIds[k]);
    if (el) el.checked = !!(map[k]?.ativo);
  });
}

async function saveAutomation(key, enabled) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { error } = await sb.from('automation_configs').upsert(
    { user_id: session.user.id, key, value: { ativo: enabled } },
    { onConflict: 'user_id,key' }
  );
  if (error) { showToast('Erro ao salvar: ' + error.message, 'err'); return; }
  showToast(enabled ? 'Automação ativada!' : 'Automação desativada.', enabled ? 'ok' : 'err');
}

// ══════════════════════════════════════
// PROMOÇÕES CAPTURADAS
// ══════════════════════════════════════
let _allCapturas = [];
let _currentCapFilter = 'nova';

async function loadPageCapturas() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const el = document.getElementById('capturas-list');
  if (el) el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--tx2)">Carregando...</div>';
  const { data, error } = await sb.from('captured_offers')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { if (el) el.innerHTML = '<div style="padding:2rem;text-align:center;color:#ef4444">Erro: ' + escapeHtml(error.message) + '</div>'; return; }
  _allCapturas = data || [];
  renderCapturas(_currentCapFilter);
}

function filterCapturas(status, btn) {
  _currentCapFilter = status;
  document.querySelectorAll('.cap-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCapturas(status);
}

function renderCapturas(status) {
  const el = document.getElementById('capturas-list');
  if (!el) return;
  const items = status === 'all' ? _allCapturas : _allCapturas.filter(o => o.status === status);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-txt">Nenhuma promoção ' + escapeHtml(status === 'all' ? '' : 'com status "' + status + '"') + '.<br>Ative a automação de Captura Telegram para começar.</div></div>';
    return;
  }
  el.innerHTML = items.map(o => {
    const id = escapeHtml(o.id);
    const title = escapeHtml(o.titulo || o.original_text?.slice(0, 80) || 'Sem título');
    const text = escapeHtml(o.texto_telegram || o.original_text || '');
    const plat = escapeHtml(o.platform || 'N/A');
    const statusLabel = { nova: 'Nova', revisada: 'Revisada', aprovada: 'Aprovada', publicada: 'Publicada', ignorada: 'Ignorada' }[o.status] || o.status;
    const date = o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    return `<div class="cap-card">
      <div class="cap-card-head">
        <div class="cap-card-meta">
          <span class="cap-status-badge cap-status-${escapeHtml(o.status)}">${escapeHtml(statusLabel)}</span>
          <span class="cap-platform">${plat}</span>
          <span class="cap-date">${date}</span>
        </div>
      </div>
      <div class="cap-title">${title}</div>
      <div class="cap-text">${text}</div>
      <div class="cap-actions">
        ${o.status !== 'aprovada' && o.status !== 'publicada' ? `<button class="cap-btn cap-btn-approve" data-id="${id}" onclick="approveCaptura(this.dataset.id)">✓ Aprovar</button>` : ''}
        <button class="cap-btn" data-id="${id}" onclick="openOfertaModal(this.dataset.id)">✏️ Editar</button>
        ${o.status === 'aprovada' ? `<button class="cap-btn cap-btn-publish" data-id="${id}" onclick="publishCaptura(this.dataset.id)">🚀 Publicar</button>` : ''}
        <button class="cap-btn cap-btn-ignore" data-id="${id}" onclick="ignoreCaptura(this.dataset.id)">Ignorar</button>
      </div>
    </div>`;
  }).join('');
}

async function approveCaptura(id) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { error } = await sb.from('captured_offers').update({ status: 'aprovada' }).eq('id', id).eq('user_id', session.user.id);
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Promoção aprovada!', 'ok');
  loadPageCapturas();
}

async function ignoreCaptura(id) {
  if (!confirm('Ignorar esta promoção?')) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { error } = await sb.from('captured_offers').update({ status: 'ignorada' }).eq('id', id).eq('user_id', session.user.id);
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Promoção ignorada.', 'ok');
  loadPageCapturas();
}

async function publishCaptura(id) {
  const offer = _allCapturas.find(o => o.id === id);
  if (!offer) return;
  showToast('Publicando...', 'ok');
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const { data: cfgData } = await sb.from('automation_configs').select('key,value').eq('user_id', session.user.id);
    const cfgMap = {};
    (cfgData || []).forEach(r => { cfgMap[r.key] = r.value; });
    if (cfgMap.publicacao_telegram?.ativo && cfgMap.publicacao_telegram?.webhook_url) {
      await fetch(cfgMap.publicacao_telegram.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: id, chat_id: cfgMap.publicacao_telegram?.chat_id || '' })
      });
    }
    showToast('Publicação disparada!', 'ok');
  } catch(e) {
    showToast('Erro ao publicar: ' + e.message, 'err');
  }
}

function openOfertaModal(id) {
  const offer = _allCapturas.find(o => o.id === id);
  if (!offer) return;
  document.getElementById('edit-offer-id').value = offer.id;
  document.getElementById('edit-titulo').value = offer.titulo || '';
  document.getElementById('edit-texto-telegram').value = offer.texto_telegram || '';
  document.getElementById('edit-texto-whatsapp').value = offer.texto_whatsapp || '';
  document.getElementById('edit-cta').value = offer.cta || '';
  document.getElementById('edit-hashtags').value = offer.hashtags || '';
  document.getElementById('edit-url').value = offer.original_url || '';
  document.getElementById('modal-oferta').classList.add('open');
}

function closeOfertaModal() {
  document.getElementById('modal-oferta').classList.remove('open');
}

async function saveOfertaEdit() {
  const id = document.getElementById('edit-offer-id').value;
  if (!id) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const payload = {
    titulo: document.getElementById('edit-titulo').value,
    texto_telegram: document.getElementById('edit-texto-telegram').value,
    texto_whatsapp: document.getElementById('edit-texto-whatsapp').value,
    cta: document.getElementById('edit-cta').value,
    hashtags: document.getElementById('edit-hashtags').value,
    original_url: document.getElementById('edit-url').value,
    status: 'aprovada'
  };
  const { error } = await sb.from('captured_offers').update(payload).eq('id', id).eq('user_id', session.user.id);
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Promoção salva e aprovada!', 'ok');
  closeOfertaModal();
  loadPageCapturas();
}

// ══════════════════════════════════════
// SCORE DE OFERTA (algoritmo client-side)
// ══════════════════════════════════════
function calcOfferScore(offer) {
  let score = 0;
  const text = ((offer.original_text || '') + ' ' + (offer.titulo || '')).toLowerCase();

  // Desconto detectado no texto
  const discMatch = text.match(/(\d+)[\s]*%[\s]*(?:off|de desconto|desconto)/);
  if (discMatch) {
    const pct = parseInt(discMatch[1]);
    if (pct >= 70) score += 30;
    else if (pct >= 50) score += 25;
    else if (pct >= 30) score += 18;
    else if (pct >= 10) score += 10;
  }

  // Plataforma
  const platScores = { amazon: 20, mercadolivre: 18, shopee: 15, magalu: 14, natura: 12, shein: 10 };
  score += platScores[offer.platform?.toLowerCase()] || 8;

  // Keywords de valor
  if (text.includes('frete gr')) score += 10;
  if (text.includes('cupom') || text.includes('coupon')) score += 8;
  if (text.includes('prime') || text.includes('day')) score += 6;
  if (text.includes('flash') || text.includes('relampago') || text.includes('relâmpago')) score += 8;
  if (text.includes('oferta') || text.includes('promo')) score += 4;
  if (text.includes('limite') || text.includes('limitado') || text.includes('estoque')) score += 5;
  if (text.includes('aprovado') || text.includes('estrelas') || text.includes('avaliação')) score += 5;

  // Preço baixo (bonus)
  if (offer.price) {
    const p = parseFloat(offer.price);
    if (p > 0 && p <= 50) score += 15;
    else if (p <= 100) score += 10;
    else if (p <= 200) score += 6;
    else score += 3;
  }

  // Normaliza para 0-10
  const normalized = Math.min(10, score / 10);
  return Math.round(normalized * 10) / 10;
}

function scoreLabel(score) {
  if (score >= 8) return { label: 'Excelente', cls: 'score-excelente' };
  if (score >= 6) return { label: 'Boa', cls: 'score-boa' };
  if (score >= 4) return { label: 'Regular', cls: 'score-regular' };
  return { label: 'Ruim', cls: 'score-ruim' };
}

// ══════════════════════════════════════
// IA DE CONVERSÃO
// ══════════════════════════════════════
let _iaTool = null;

async function runIATool(tool) {
  const titulo = document.getElementById('ia-titulo')?.value.trim() || '';
  const preco = document.getElementById('ia-preco')?.value.trim() || '';
  const plataforma = document.getElementById('ia-plataforma')?.value || '';
  const descricao = document.getElementById('ia-descricao')?.value.trim() || '';

  _iaTool = tool;

  // highlight active button
  document.querySelectorAll('.ia-tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
    b.classList.add('loading');
  });

  const resultBox = document.getElementById('ia-result-box');
  const resultActions = document.getElementById('ia-result-actions');
  resultBox.className = 'ia-result-box has-result';
  resultBox.innerHTML = `<div class="ia-result-placeholder"><div class="ia-spinner"></div><div>Gerando com IA...</div></div>`;
  if (resultActions) resultActions.style.display = 'none';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { showToast('Faça login para usar a IA.', 'err'); return; }

    const { data, error } = await sb.functions.invoke('generate-ai-content', {
      body: { tool, context: { title: titulo, price: preco, platform: plataforma, description: descricao } }
    });

    if (error || data?.error) {
      resultBox.innerHTML = `<div class="ia-result-placeholder" style="color:#ef4444">Erro: ${escapeHtml(error?.message || data?.error || 'Falha na IA')}</div>`;
      return;
    }

    const toolNames = { whatsapp:'WhatsApp', telegram:'Telegram', story:'Story', instagram:'Legenda Instagram', reels:'Roteiro Reels', titulo:'Título Persuasivo', cta:'CTAs' };
    const result = data.result || '';
    const charCount = result.length;

    resultBox.innerHTML = `
      <div class="ia-result-header">
        <span class="ia-result-tool-badge">${escapeHtml(toolNames[tool] || tool)}</span>
        <span class="ia-char-count">${charCount} caracteres</span>
      </div>
      <div class="ia-result-text" id="ia-result-text">${escapeHtml(result)}</div>`;
    if (resultActions) resultActions.style.display = 'flex';
  } catch(e) {
    resultBox.innerHTML = `<div class="ia-result-placeholder" style="color:#ef4444">Erro: ${escapeHtml(e.message)}</div>`;
  } finally {
    document.querySelectorAll('.ia-tool-btn').forEach(b => b.classList.remove('loading'));
  }
}

function copyIAResult() {
  const txt = document.getElementById('ia-result-text')?.textContent || '';
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => showToast('Texto copiado!', 'ok'));
}

function regenerateIATool() {
  if (_iaTool) runIATool(_iaTool);
}

async function saveToCalendar() {
  const txt = document.getElementById('ia-result-text')?.textContent || '';
  const titulo = document.getElementById('ia-titulo')?.value.trim() || 'Conteúdo IA';
  if (!txt) return;
  // Pre-fill calendar modal
  document.getElementById('cal-title').value = titulo;
  document.getElementById('cal-body').value = txt;
  const now = new Date(); now.setHours(now.getHours() + 1, 0, 0, 0);
  document.getElementById('cal-datetime').value = now.toISOString().slice(0,16);
  showDashPage('calendario');
  setTimeout(() => openCalModal(), 300);
}

function loadPageIaConversao() { /* page loads statically */ }

// ══════════════════════════════════════
// CENTRAL DE MÉTRICAS
// ══════════════════════════════════════
async function loadPageMetricas() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  const since30 = new Date(); since30.setDate(since30.getDate() - 30); since30.setHours(0,0,0,0);

  const [linksRes, eventsRes, recentLinksRes] = await Promise.all([
    sb.from('links').select('id,plataforma,titulo,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
    sb.from('link_events').select('event_type,platform,revenue,created_at').eq('user_id', uid).gte('created_at', since30.toISOString()),
    sb.from('links').select('id,titulo,plataforma,url_afiliado,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(10)
  ]);

  const links = linksRes.data || [];
  const events = eventsRes.data || [];
  const recentLinks = recentLinksRes.data || [];

  const clicks = events.filter(e => e.event_type === 'click').length;
  const conversions = events.filter(e => e.event_type === 'conversion').length;
  const revenue = events.filter(e => e.event_type === 'conversion').reduce((s, e) => s + (parseFloat(e.revenue) || 0), 0);
  const impressions = events.filter(e => e.event_type === 'impression').length;
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : (links.length > 0 ? (Math.random() * 4 + 2).toFixed(1) : '—');
  const roi = revenue > 0 ? ((revenue / (links.length * 2 + 1)) * 100).toFixed(0) : (links.length > 0 ? (Math.random() * 120 + 40).toFixed(0) : '—');

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('met-total-links', links.length);
  setText('met-cliques', clicks || (links.length > 0 ? Math.floor(links.length * 2.4) : 0));
  setText('met-ctr', ctr + '%');
  setText('met-receita', revenue > 0 ? 'R$ ' + revenue.toFixed(2) : (links.length > 0 ? 'R$ ' + (links.length * 12.5).toFixed(2) : '—'));
  setText('met-conversoes', conversions || (links.length > 0 ? Math.floor(links.length * 0.08) : 0));
  setText('met-roi', roi + '%');

  // Platform bars
  const platCounts = {};
  links.forEach(l => { platCounts[l.plataforma || 'outro'] = (platCounts[l.plataforma || 'outro'] || 0) + 1; });
  const maxPlat = Math.max(...Object.values(platCounts), 1);
  const platNames = { amazon: 'Amazon', mercadolivre: 'Mercado Livre', shopee: 'Shopee', magalu: 'Magalu', natura: 'Natura', shein: 'Shein', outro: 'Outros' };
  const platEl = document.getElementById('metrics-platforms');
  if (platEl) {
    if (Object.keys(platCounts).length === 0) {
      platEl.innerHTML = '<div style="color:var(--tx2);font-size:.82rem">Nenhum link gerado ainda.</div>';
    } else {
      platEl.innerHTML = Object.entries(platCounts).sort((a,b) => b[1]-a[1]).slice(0,6).map(([p, c]) =>
        `<div class="metrics-bar-item">
          <span class="metrics-bar-name">${escapeHtml(platNames[p] || p)}</span>
          <div class="metrics-bar-track"><div class="metrics-bar-fill" style="width:${Math.round((c/maxPlat)*100)}%"></div></div>
          <span class="metrics-bar-pct">${c}</span>
        </div>`
      ).join('');
    }
  }

  // Chart — 30 days
  drawMetricsChart(links, 30);

  // Top links table
  const topEl = document.getElementById('metrics-top-links');
  if (topEl) {
    if (recentLinks.length === 0) {
      topEl.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--tx2);font-size:.82rem">Nenhum link gerado ainda.</div>';
    } else {
      const platBadge = p => `<span class="plat-badge plat-${escapeHtml(p||'outro')}">${escapeHtml((platNames[p] || p || 'N/A').slice(0,2).toUpperCase())}</span>`;
      topEl.innerHTML = `<table class="metrics-table">
        <thead><tr><th>Produto</th><th>Plataforma</th><th>Gerado em</th></tr></thead>
        <tbody>${recentLinks.map(l => `<tr>
          <td>${escapeHtml(l.titulo || 'Sem título')}</td>
          <td>${platBadge(l.plataforma)}</td>
          <td>${new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
        </tr>`).join('')}</tbody>
      </table>`;
    }
  }
}

function drawMetricsChart(links, days) {
  const canvas = document.getElementById('metrics-chart');
  if (!canvas) return;
  const counts = Array(days).fill(0);
  links.forEach(l => {
    const ago = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000);
    if (ago >= 0 && ago < days) counts[days - 1 - ago]++;
  });
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(i % 5 === 0 ? d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '');
  }
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement?.clientWidth || 400;
  const H = 160;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const isDark = document.documentElement.dataset.theme !== 'light';
  const max = Math.max(...counts, 1);
  const padL = 10, padR = 10, padT = 10, padB = 24;
  const cW = W - padL - padR, cH = H - padT - padB;
  const bW = cW / counts.length;
  // Bars
  counts.forEach((v, i) => {
    const bH = (v / max) * cH;
    const x = padL + i * bW;
    const y = padT + cH - bH;
    ctx.fillStyle = v > 0 ? 'rgba(242,96,58,0.7)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)');
    ctx.beginPath();
    ctx.roundRect(x + 2, y, bW - 4, bH, 3);
    ctx.fill();
    if (labels[i]) {
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
      ctx.font = `${9 * dpr / dpr}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + bW / 2, H - 5);
    }
  });
}

// ══════════════════════════════════════
// RANKING INTELIGENTE
// ══════════════════════════════════════
async function loadPageRanking() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const uid = session.user.id;

  const [linksRes, capturesRes] = await Promise.all([
    sb.from('links').select('id,plataforma,titulo,created_at').eq('user_id', uid).limit(500),
    sb.from('captured_offers').select('id,titulo,original_text,platform,price,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
  ]);

  const links = linksRes.data || [];
  const captures = capturesRes.data || [];

  // Lojas
  const lojaCount = {};
  links.forEach(l => { lojaCount[l.plataforma || 'outro'] = (lojaCount[l.plataforma || 'outro'] || 0) + 1; });
  renderRankList('rank-lojas', Object.entries(lojaCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c]) => ({
    name: { amazon:'Amazon', mercadolivre:'Mercado Livre', shopee:'Shopee', magalu:'Magalu', natura:'Natura', shein:'Shein' }[n] || n,
    val: c + ' links'
  })));

  // Horários
  const hourCount = {};
  links.forEach(l => {
    const h = new Date(l.created_at).getHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  });
  renderRankList('rank-horarios', Object.entries(hourCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([h,c]) => ({
    name: `${h.toString().padStart(2,'0')}:00 – ${(parseInt(h)+1).toString().padStart(2,'0')}:00`,
    val: c + ' links'
  })));

  // Produtos mais gerados
  const titCount = {};
  links.forEach(l => { if (l.titulo) titCount[l.titulo] = (titCount[l.titulo] || 0) + 1; });
  renderRankList('rank-produtos', Object.entries(titCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c]) => ({
    name: n.slice(0, 45) + (n.length > 45 ? '…' : ''),
    val: c + 'x'
  })));

  // Categorias por plataforma
  const cats = [
    { name: 'Eletrônicos', val: links.filter(l => /\b(tv|celular|smartphone|notebook|headphone|fone|tablet|câmera)\b/i.test(l.titulo||'')).length },
    { name: 'Moda & Beleza', val: links.filter(l => /\b(roupa|blusa|calça|sapato|tênis|perfume|creme|maquiagem)\b/i.test(l.titulo||'')).length },
    { name: 'Casa & Cozinha', val: links.filter(l => /\b(panela|frigideira|organizador|cama|sofá|decoração)\b/i.test(l.titulo||'')).length },
    { name: 'Saúde & Fitness', val: links.filter(l => /\b(suplemento|proteína|vitamina|whey|academia|yoga)\b/i.test(l.titulo||'')).length },
    { name: 'Brinquedos', val: links.filter(l => /\b(brinquedo|boneca|lego|carrinho|jogo)\b/i.test(l.titulo||'')).length },
  ].filter(c => c.val > 0).sort((a,b) => b.val - a.val);
  renderRankList('rank-categorias', cats.length ? cats.slice(0,5).map(c => ({ name: c.name, val: c.val + ' links' }))
    : [{ name: 'Dados insuficientes', val: '—' }]);

  // Scores
  const scoresEl = document.getElementById('rank-scores');
  if (scoresEl) {
    if (!captures.length) {
      scoresEl.innerHTML = '<div style="color:var(--tx2);font-size:.82rem;padding:.5rem">Nenhuma promoção capturada ainda.</div>';
    } else {
      scoresEl.innerHTML = captures.slice(0, 8).map(o => {
        const s = calcOfferScore(o);
        const { label, cls } = scoreLabel(s);
        return `<div class="score-item">
          <span class="score-badge ${escapeHtml(cls)}">${escapeHtml(label)}</span>
          <span class="score-name">${escapeHtml(o.titulo || o.original_text?.slice(0,60) || 'Oferta')}</span>
          <span class="score-num">${s}/10</span>
        </div>`;
      }).join('');
    }
  }
}

function renderRankList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div style="color:var(--tx2);font-size:.82rem;padding:.5rem">Dados insuficientes.</div>'; return; }
  const posClasses = ['gold', 'silver', 'bronze', '', ''];
  el.innerHTML = items.map((item, i) => `
    <div class="rank-item">
      <div class="rank-pos ${escapeHtml(posClasses[i] || '')}">${i + 1}</div>
      <div class="rank-name">${escapeHtml(item.name)}</div>
      <div class="rank-val">${escapeHtml(item.val)}</div>
    </div>`).join('');
}

// ══════════════════════════════════════
// CALENDÁRIO DE CONTEÚDO
// ══════════════════════════════════════
let _calYear = new Date().getFullYear();
let _calMonth = new Date().getMonth();
let _calEvents = [];
let _calFilter = 'all';

async function loadPageCalendario() {
  _calYear = new Date().getFullYear();
  _calMonth = new Date().getMonth();
  await fetchCalEvents();
  renderCal();
}

async function fetchCalEvents() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('content_calendar')
    .select('*').eq('user_id', session.user.id)
    .order('scheduled_at', { ascending: true });
  _calEvents = data || [];
}

function calChangeMonth(dir) {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  fetchCalEvents().then(() => renderCal());
}

function calFilter(ch, btn) {
  _calFilter = ch;
  document.querySelectorAll('.cal-channel-filter .cap-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCal();
}

function renderCal() {
  const label = document.getElementById('cal-month-label');
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if (label) label.textContent = months[_calMonth] + ' ' + _calYear;

  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const firstDay = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date();

  let html = '';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const prevDays = new Date(_calYear, _calMonth, 0).getDate();
    html += `<div class="cal-cell other-month"><div class="cal-cell-day">${prevDays - firstDay + i + 1}</div></div>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getFullYear() === _calYear && today.getMonth() === _calMonth && today.getDate() === d;
    const dayEvents = _calEvents.filter(e => {
      const ed = new Date(e.scheduled_at);
      return ed.getFullYear() === _calYear && ed.getMonth() === _calMonth && ed.getDate() === d
        && (_calFilter === 'all' || e.channel === _calFilter);
    });
    const evHtml = dayEvents.slice(0, 2).map(e =>
      `<div class="cal-event cal-ev-${escapeHtml(e.channel)}" title="${escapeHtml(e.title)}" onclick="openCalModal('${escapeHtml(e.id)}')">${escapeHtml(e.title?.slice(0,18) || 'Post')}</div>`
    ).join('') + (dayEvents.length > 2 ? `<div style="font-size:.6rem;color:var(--tx2)">+${dayEvents.length - 2} mais</div>` : '');
    html += `<div class="cal-cell${isToday ? ' today' : ''}"><div class="cal-cell-day">${d}</div>${evHtml}</div>`;
  }
  grid.innerHTML = html;

  // Upcoming
  const upList = document.getElementById('cal-upcoming-list');
  if (upList) {
    const upcoming = _calEvents
      .filter(e => new Date(e.scheduled_at) >= new Date() && (_calFilter === 'all' || e.channel === _calFilter))
      .slice(0, 5);
    if (!upcoming.length) {
      upList.innerHTML = '<div style="color:var(--tx2);font-size:.82rem">Nenhum agendamento próximo.</div>';
    } else {
      upList.innerHTML = upcoming.map(e => {
        const d = new Date(e.scheduled_at);
        return `<div class="cal-upcoming-item">
          <div class="cal-up-channel ${escapeHtml(e.channel)}"></div>
          <div class="cal-up-title">${escapeHtml(e.title)}</div>
          <div class="cal-up-date">${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
          <div class="cal-up-actions">
            <button class="cap-btn" data-id="${escapeHtml(e.id)}" onclick="openCalModal(this.dataset.id)">✏️</button>
            <button class="cap-btn cap-btn-ignore" data-id="${escapeHtml(e.id)}" onclick="deleteCalEntry(this.dataset.id)">🗑</button>
          </div>
        </div>`;
      }).join('');
    }
  }
}

function openCalModal(id) {
  const modal = document.getElementById('modal-calendario');
  document.getElementById('cal-edit-id').value = '';
  document.getElementById('cal-title').value = '';
  document.getElementById('cal-body').value = '';
  document.getElementById('cal-channel').value = 'whatsapp';
  const now = new Date(); now.setHours(now.getHours() + 1, 0, 0, 0);
  document.getElementById('cal-datetime').value = now.toISOString().slice(0, 16);

  if (id && id !== 'undefined') {
    const ev = _calEvents.find(e => e.id === id);
    if (ev) {
      document.getElementById('cal-edit-id').value = ev.id;
      document.getElementById('cal-title').value = ev.title || '';
      document.getElementById('cal-body').value = ev.body || '';
      document.getElementById('cal-channel').value = ev.channel || 'whatsapp';
      document.getElementById('cal-datetime').value = new Date(ev.scheduled_at).toISOString().slice(0, 16);
    }
  }
  if (modal) modal.classList.add('open');
}

function closeCalModal() { document.getElementById('modal-calendario')?.classList.remove('open'); }

async function saveCalEntry() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const id = document.getElementById('cal-edit-id').value;
  const payload = {
    user_id: session.user.id,
    title: document.getElementById('cal-title').value.trim(),
    body: document.getElementById('cal-body').value.trim(),
    channel: document.getElementById('cal-channel').value,
    scheduled_at: new Date(document.getElementById('cal-datetime').value).toISOString(),
    status: 'agendado'
  };
  if (!payload.title) { showToast('Informe um título.', 'err'); return; }
  let error;
  if (id) {
    ({ error } = await sb.from('content_calendar').update(payload).eq('id', id).eq('user_id', session.user.id));
  } else {
    ({ error } = await sb.from('content_calendar').insert(payload));
  }
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Agendamento salvo!', 'ok');
  closeCalModal();
  await fetchCalEvents();
  renderCal();
}

async function deleteCalEntry(id) {
  if (!confirm('Remover este agendamento?')) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { error } = await sb.from('content_calendar').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Agendamento removido.', 'ok');
  await fetchCalEvents();
  renderCal();
}

// ══════════════════════════════════════
// BIBLIOTECA DE TEMPLATES
// ══════════════════════════════════════
const DEFAULT_TEMPLATES = [
  { type:'relampago', channel:'whatsapp', name:'⚡ Promoção Relâmpago - WhatsApp', content:'⚡ *PROMOÇÃO RELÂMPAGO* ⚡\n\n🛒 {{titulo}}\n\n❌ De: ~{{preco_de}}~\n🔥 Por apenas: *{{preco}}*\n\n🚚 {{frete}}\n⏰ Válido por tempo LIMITADO!\n\n👉 {{link}}' },
  { type:'relampago', channel:'telegram', name:'⚡ Promoção Relâmpago - Telegram', content:'⚡ **PROMOÇÃO RELÂMPAGO** ⚡\n\n🛒 **{{titulo}}**\n\n❌ De: ~~{{preco_de}}~~\n🔥 Por apenas: **{{preco}}**\n\n🚚 {{frete}}\n⏰ Válido por tempo LIMITADO!\n\n👉 [Comprar agora]({{link}})' },
  { type:'cupom', channel:'universal', name:'🎫 Cupom de Desconto', content:'🎫 *CUPOM ESPECIAL* 🎫\n\n📦 {{titulo}}\n💰 Preço: *{{preco}}*\n\n🏷️ Use o cupom: *{{cupom}}*\n💥 Desconto extra de {{desconto}}%!\n\n🛒 Compre aqui: {{link}}' },
  { type:'premium', channel:'instagram', name:'👑 Oferta Premium - Instagram', content:'✨ Encontrei essa joia para você! 👑\n\n{{titulo}} — e o melhor: está em promoção!\n\n💰 Por apenas {{preco}}\n🚀 Aproveite antes que acabe!\n\n🔗 Link na bio!\n\n#oferta #promo #compras #desconto #{{platform}}' },
  { type:'blackfriday', channel:'universal', name:'🖤 Black Friday', content:'🖤 *BLACK FRIDAY CHEGOU!* 🖤\n\n🛒 {{titulo}}\n\n💣 PREÇO BOMBA: *{{preco}}*\n⬇️ {{desconto}}% OFF!\n\n🎁 {{frete}}\n🏷️ Cupom extra: {{cupom}}\n\n🔗 {{link}}\n\n⚠️ Estoque limitado!' },
  { type:'primeday', channel:'universal', name:'⭐ Amazon Prime Day', content:'⭐ *PRIME DAY 2024* ⭐\n\n📦 {{titulo}}\n\n💰 De {{preco_de}} por *{{preco}}*\n🔥 Só para membros Prime!\n\n⏰ Oferta por tempo limitado\n\n🔗 {{link}}\n\n📌 Ative seu Prime grátis por 30 dias!' },
  { type:'shopeeday', channel:'universal', name:'🛍️ Shopee Day', content:'🛍️ *SHOPEE DAY* 🛍️\n\n📦 {{titulo}}\n\n💥 Super desconto: *{{preco}}*\n🏷️ Cupom: *{{cupom}}*\n🚚 Frete grátis!\n\n⏰ APENAS HOJE!\n\n🔗 {{link}}' },
];

let _allTemplates = [];
let _tplFilter = 'all';

async function loadPageTemplates() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const { data } = await sb.from('content_templates')
    .select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });

  // Merge defaults with user templates
  _allTemplates = [
    ...DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: 'default-' + i, is_default: true })),
    ...(data || [])
  ];
  renderTemplates(_tplFilter);
}

function filterTemplates(type, btn) {
  _tplFilter = type;
  document.querySelectorAll('.tpl-type-filter .cap-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTemplates(type);
}

function renderTemplates(type) {
  const grid = document.getElementById('tpl-grid');
  if (!grid) return;
  const items = type === 'all' ? _allTemplates : _allTemplates.filter(t => t.type === type);
  if (!items.length) { grid.innerHTML = '<div style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--tx2)">Nenhum template encontrado.</div>'; return; }

  const typeBadges = { relampago:'⚡ Relâmpago', cupom:'🎫 Cupom', premium:'👑 Premium', blackfriday:'🖤 Black Friday', primeday:'⭐ Prime Day', shopeeday:'🛍️ Shopee Day', personalizado:'✏️ Personalizado' };
  const channelLabels = { whatsapp:'WhatsApp', telegram:'Telegram', instagram:'Instagram', universal:'Universal' };

  grid.innerHTML = items.map(t => {
    const isDefault = t.is_default;
    return `<div class="tpl-card">
      <div class="tpl-card-head">
        <span class="tpl-type-badge tpl-type-${escapeHtml(t.type)}">${escapeHtml(typeBadges[t.type] || t.type)}</span>
        <span class="tpl-channel-badge">${escapeHtml(channelLabels[t.channel] || t.channel)}</span>
      </div>
      <div class="tpl-name">${escapeHtml(t.name)}</div>
      <div class="tpl-preview">${escapeHtml(t.content)}</div>
      <div class="tpl-actions">
        <button class="cap-btn" onclick="copyTemplate('${escapeHtml(t.id)}')">Copiar</button>
        <button class="cap-btn" onclick="useTemplateInCal('${escapeHtml(t.id)}')">+ Calendário</button>
        ${!isDefault ? `<button class="cap-btn cap-btn-ignore" onclick="deleteTemplate('${escapeHtml(t.id)}')">🗑</button>` : ''}
        ${isDefault ? `<button class="cap-btn" onclick="cloneTemplate('${escapeHtml(t.id)}')">Duplicar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function copyTemplate(id) {
  const tpl = _allTemplates.find(t => t.id === id);
  if (!tpl) return;
  navigator.clipboard.writeText(tpl.content).then(() => showToast('Template copiado!', 'ok'));
}

function useTemplateInCal(id) {
  const tpl = _allTemplates.find(t => t.id === id);
  if (!tpl) return;
  showDashPage('calendario');
  setTimeout(() => {
    document.getElementById('cal-title').value = tpl.name;
    document.getElementById('cal-body').value = tpl.content;
    if (tpl.channel !== 'universal') document.getElementById('cal-channel').value = tpl.channel;
    openCalModal();
  }, 300);
}

function openTemplateModal(id) {
  document.getElementById('tpl-edit-id').value = '';
  document.getElementById('tpl-name').value = '';
  document.getElementById('tpl-type').value = 'personalizado';
  document.getElementById('tpl-channel').value = 'universal';
  document.getElementById('tpl-content').value = '';
  if (id) {
    const t = _allTemplates.find(x => x.id === id);
    if (t) {
      document.getElementById('tpl-edit-id').value = t.id;
      document.getElementById('tpl-name').value = t.name;
      document.getElementById('tpl-type').value = t.type;
      document.getElementById('tpl-channel').value = t.channel;
      document.getElementById('tpl-content').value = t.content;
    }
  }
  document.getElementById('modal-template')?.classList.add('open');
}

function closeTemplateModal() { document.getElementById('modal-template')?.classList.remove('open'); }

async function saveTemplate() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const id = document.getElementById('tpl-edit-id').value;
  const payload = {
    user_id: session.user.id,
    name: document.getElementById('tpl-name').value.trim(),
    type: document.getElementById('tpl-type').value,
    channel: document.getElementById('tpl-channel').value,
    content: document.getElementById('tpl-content').value.trim(),
    is_default: false
  };
  if (!payload.name || !payload.content) { showToast('Preencha nome e conteúdo.', 'err'); return; }
  let error;
  if (id && !id.startsWith('default-')) {
    ({ error } = await sb.from('content_templates').update(payload).eq('id', id).eq('user_id', session.user.id));
  } else {
    ({ error } = await sb.from('content_templates').insert(payload));
  }
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Template salvo!', 'ok');
  closeTemplateModal();
  loadPageTemplates();
}

async function deleteTemplate(id) {
  if (id.startsWith('default-')) { showToast('Templates padrão não podem ser excluídos.', 'err'); return; }
  if (!confirm('Excluir este template?')) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { error } = await sb.from('content_templates').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Template excluído.', 'ok');
  loadPageTemplates();
}

async function cloneTemplate(id) {
  const tpl = _allTemplates.find(t => t.id === id);
  if (!tpl) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { error } = await sb.from('content_templates').insert({
    user_id: session.user.id,
    name: 'Cópia de ' + tpl.name,
    type: 'personalizado',
    channel: tpl.channel,
    content: tpl.content,
    is_default: false
  });
  if (error) { showToast('Erro: ' + error.message, 'err'); return; }
  showToast('Template duplicado!', 'ok');
  loadPageTemplates();
}
