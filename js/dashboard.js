// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════

async function loadDashboard() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showPage('login'); return; }

  const uid = session.user.id;

  // Carrega perfil do usuário
  const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).single();
  if (profile) {
    document.getElementById('dash-user-name').textContent = profile.nome || session.user.email;
    document.getElementById('dash-plan-badge').textContent = profile.plano.toUpperCase();
    document.getElementById('dash-welcome').textContent = `Olá, ${profile.nome?.split(' ')[0] || 'usuário'} 👋`;
  }

  // Carrega estatísticas em paralelo
  const [linksRes, gruposRes, disparosRes, leadsRes] = await Promise.all([
    sb.from('links').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    sb.from('grupos').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', true),
    sb.from('disparos').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'enviado'),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ativo', true),
  ]);

  document.getElementById('stat-links').textContent = linksRes.count ?? 0;
  document.getElementById('stat-grupos').textContent = gruposRes.count ?? 0;
  document.getElementById('stat-disparos').textContent = disparosRes.count ?? 0;
  document.getElementById('stat-leads').textContent = leadsRes.count ?? 0;

  // Carrega links recentes
  const { data: linksRecentes } = await sb.from('links')
    .select('id, url_original, url_afiliado, plataforma, titulo, preco, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(8);

  renderLinksTable(linksRecentes || []);
}

function renderLinksTable(links) {
  const tbody = document.getElementById('links-tbody');
  if (!links.length) {
    tbody.innerHTML = `
      <tr><td colspan="4">
        <div class="empty-state">
          <div class="empty-icon">🔗</div>
          <div>Nenhum link gerado ainda.<br>Cole um link acima para começar!</div>
        </div>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = links.map(l => {
    const data = new Date(l.created_at).toLocaleDateString('pt-BR');
    const plat = l.plataforma || 'outro';
    const titulo = l.titulo || l.url_original?.substring(0, 40) + '...' || '—';
    return `
      <tr>
        <td><span class="plat-badge plat-${plat}">${plat}</span></td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${titulo}</td>
        <td>${l.preco || '—'}</td>
        <td>${data}</td>
      </tr>`;
  }).join('');
}

// ══════════════════════════════════════
// GERADOR RÁPIDO DE LINK
// ══════════════════════════════════════
async function gerarLink() {
  const input = document.getElementById('quick-url').value.trim();
  const resultEl = document.getElementById('quick-result');
  const btn = document.getElementById('quick-btn');

  if (!input) { showToast('Cole um link de produto primeiro.', 'err'); return; }

  btn.disabled = true;
  btn.textContent = '⟳ Gerando...';

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showPage('login'); return; }

  // Detecta plataforma
  const plataforma = detectarPlataforma(input);

  // Salva o link no banco
  const { data, error } = await sb.from('links').insert({
    user_id: session.user.id,
    url_original: input,
    url_afiliado: input, // Em produção: substituir pela API de conversão
    plataforma,
  }).select().single();

  btn.disabled = false;
  btn.textContent = '⚡ Gerar Link';

  if (error) {
    showToast('Erro ao salvar link: ' + error.message, 'err');
    return;
  }

  resultEl.innerHTML = `
    <div style="font-size:.78rem;color:var(--tx3);margin-bottom:.4rem">✅ Link registrado — plataforma detectada: <strong>${plataforma}</strong></div>
    <div class="quick-result-link">${data.url_afiliado}</div>
    <div style="font-size:.72rem;color:var(--tx3);margin-top:.5rem">Configure sua API de afiliado para gerar o link comissionado automaticamente.</div>`;
  resultEl.classList.add('show');

  showToast('Link gerado com sucesso!', 'ok');
  loadDashboard(); // Atualiza stats
}

function detectarPlataforma(url) {
  if (url.includes('shopee')) return 'shopee';
  if (url.includes('amazon') || url.includes('amzn')) return 'amazon';
  if (url.includes('magazineluiza') || url.includes('magalu')) return 'magalu';
  if (url.includes('mercadolivre') || url.includes('mercadolibre') || url.includes('ml.com')) return 'mercadolivre';
  if (url.includes('natura')) return 'natura';
  if (url.includes('shein')) return 'shein';
  if (url.includes('avon')) return 'avon';
  return 'outro';
}
