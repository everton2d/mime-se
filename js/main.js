// ══════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════
const { createClient } = supabase;
const sb = createClient(
  'https://qexztxftbwzxxfvluoys.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFleHp0eGZ0Ynd6eHhmdmx1b3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDI1ODgsImV4cCI6MjA5NjAxODU4OH0.KcPOa4wz7wx_YriybCijYvVU_qnez5cj09JDHIAkyP0'
);

// ══════════════════════════════════════
// THEME
// ══════════════════════════════════════
const html = document.documentElement;
document.getElementById('toggle').addEventListener('click', () => {
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
});

// ══════════════════════════════════════
// PAGES
// ══════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo(0, 0);
  ['reg-err','reg-ok','login-err','login-ok'].forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.className = 'alert ' + (id.includes('err') ? 'alert-err' : 'alert-ok'); el.textContent = ''; }
  });
}

// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════
function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3200);
}

// ══════════════════════════════════════
// REGISTER
// ══════════════════════════════════════
async function handleRegister() {
  const nome  = document.getElementById('reg-nome').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const wpp   = document.getElementById('reg-wpp').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-err');
  const okEl  = document.getElementById('reg-ok');
  const btn   = document.getElementById('reg-btn');

  errEl.className = 'alert alert-err'; okEl.className = 'alert alert-ok';

  if (!nome || !email || !wpp || !pass) {
    errEl.textContent = '⚠️ Preencha todos os campos obrigatórios.';
    errEl.className = 'alert alert-err show'; return;
  }
  if (pass.length < 6) {
    errEl.textContent = '⚠️ A senha deve ter pelo menos 6 caracteres.';
    errEl.className = 'alert alert-err show'; return;
  }

  btn.disabled = true; btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">⟳</span> Criando conta...';

  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { nome, whatsapp: wpp } }
  });

  btn.disabled = false; btn.innerHTML = '<span>⚡</span> Começar';

  if (error) {
    let msg = error.message;
    if (msg.includes('already registered')) msg = 'Este e-mail já está cadastrado.';
    errEl.textContent = '❌ ' + msg;
    errEl.className = 'alert alert-err show';
  } else {
    okEl.textContent = '✅ Cadastro realizado! Confirme seu e-mail para ativar a conta.';
    okEl.className = 'alert alert-ok show';
    showToast('Conta criada com sucesso! Verifique seu e-mail.', 'ok');
    setTimeout(() => showPage('login'), 2800);
  }
}

// ══════════════════════════════════════
// LOGIN
// ══════════════════════════════════════
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  const okEl  = document.getElementById('login-ok');
  const btn   = document.getElementById('login-btn');

  errEl.className = 'alert alert-err'; okEl.className = 'alert alert-ok';

  if (!email || !pass) {
    errEl.textContent = '⚠️ Preencha e-mail e senha.';
    errEl.className = 'alert alert-err show'; return;
  }

  btn.disabled = true; btn.innerHTML = '<span style="animation:spin .8s linear infinite;display:inline-block">⟳</span> Entrando...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

  btn.disabled = false; btn.innerHTML = 'Entrar →';

  if (error) {
    let msg = error.message;
    if (msg.includes('Invalid login')) msg = 'E-mail ou senha incorretos.';
    if (msg.includes('Email not confirmed')) msg = 'Confirme seu e-mail antes de entrar.';
    errEl.textContent = '❌ ' + msg;
    errEl.className = 'alert alert-err show';
  } else {
    okEl.textContent = '✅ Login realizado com sucesso! Redirecionando...';
    okEl.className = 'alert alert-ok show';
    showToast('Bem-vindo de volta! 🎉', 'ok');
    setTimeout(() => {
      showPage('dashboard');
      loadDashboard();
    }, 800);
  }
}

// ══════════════════════════════════════
// FORGOT PASSWORD
// ══════════════════════════════════════
async function handleForgot() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) {
    showToast('Digite seu e-mail primeiro.', 'err'); return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://mime-se.vercel.app'
  });
  if (error) { showToast('Erro: ' + error.message, 'err'); }
  else { showToast('📧 E-mail de recuperação enviado!', 'ok'); }
}

// ══════════════════════════════════════
// MODES
// ══════════════════════════════════════
function switchMode(idx) {
  document.querySelectorAll('.mode-tab').forEach((t,i) => t.classList.toggle('active', i === idx));
  document.querySelectorAll('.mpanel').forEach((p,i) => p.classList.toggle('active', i === idx));
}

// ══════════════════════════════════════
// FAQ
// ══════════════════════════════════════
function toggleFaq(el) {
  const was = el.classList.contains('open');
  document.querySelectorAll('.fq').forEach(f => f.classList.remove('open'));
  if (!was) el.classList.add('open');
}

// ══════════════════════════════════════
// PRICING TOGGLE
// ══════════════════════════════════════
let isAnual = false;
const prices = { mensal:[69,99,179,300], anual:[55,79,143,240] };
function toggleAnual() {
  isAnual = !isAnual;
  document.getElementById('ptog').classList.toggle('anual', isAnual);
  const p = isAnual ? prices.anual : prices.mensal;
  ['p1','p2','p3','p4'].forEach((id,i) => {
    document.getElementById(id).textContent = p[i];
  });
}

// ══════════════════════════════════════
// SCROLL ANIMATIONS
// ══════════════════════════════════════
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('vis'); obs.unobserve(e.target); } });
}, { threshold: 0.08 });
document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

// ══════════════════════════════════════
// ENTER KEY on forms
// ══════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const page = document.querySelector('.page.active')?.id;
    if (page === 'page-register') handleRegister();
    if (page === 'page-login') handleLogin();
  }
});

// spin keyframe
const style = document.createElement('style');
style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
document.head.appendChild(style);

// ══════════════════════════════════════
// SESSION CHECK
// ══════════════════════════════════════
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    // Usuário logado: vai direto pro dashboard
    showPage('dashboard');
    loadDashboard();
  }

  // Toggle de tema do dashboard
  document.getElementById('dash-toggle')?.addEventListener('click', () => {
    html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  });
})();

async function handleLogout() {
  await sb.auth.signOut();
  showToast('Até logo! 👋', 'ok');
  location.reload();
}
