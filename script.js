document.addEventListener('DOMContentLoaded', () => {

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  function escapeHtml(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function numero(v) {
    v = String(v == null ? '' : v).trim();
    if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function dataCurta(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  // ===== TELAS QUE EXPANDEM (caixinha, compras e configurações) =====
  let viewAberta = null;

  function abrirView(id, origem) {
    const view = $(id);
    if (!view) return;
    const r = origem ? origem.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
    view.style.setProperty('--ox', x + 'px');
    view.style.setProperty('--oy', y + 'px');
    view.classList.remove('open');
    void view.offsetWidth;
    view.classList.add('open');
    view.scrollTop = 0;
    document.body.classList.add('view-open');
    viewAberta = id;
  }

  function fecharView() {
    if (!viewAberta) return;
    const view = $(viewAberta);
    if (view) view.classList.remove('open');
    document.body.classList.remove('view-open');
    viewAberta = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (rerenderListasPendente) renderizarListas(true);
  }

  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', () => abrirView(el.getAttribute('data-view'), el));
  });
  $('btnOpenSettings').addEventListener('click', (e) => abrirView('view-settings', e.currentTarget));
  document.querySelectorAll('.view-back').forEach((b) => b.addEventListener('click', fecharView));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !viewAberta) return;
    const modalAberto = Array.from(document.querySelectorAll('.modal-overlay')).some((m) => m.style.display === 'flex');
    if (!modalAberto) fecharView();
  });

  // ===== TEMA E CORES (mesma lógica do Jarvito) =====
  const THEME_KEY = 'mon_theme';
  const ACCENT_KEY = 'mon_accent';
  const CUSTOM_KEY = 'mon_accent_custom';
  const CUSTOM_VARS_KEY = 'mon_accent_vars';
  const THEME_COLORS = { dark: '#060606', light: '#f4f6f4' };
  const ACCENTS = ['verde', 'roxo', 'azul', 'laranja', 'rosa', 'dourado', 'vermelho'];
  const COR_PADRAO = '#16a34a';

  const inputCor = $('accentColorInput');
  const notaCor = $('accentCustomNote');
  const swatchCustom = document.querySelector('.accent-swatch[data-accent="custom"]');

  const LUM_MIN = 0.11;
  const LUM_MAX = 0.30;

  function hexParaRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbParaHex(rgb) {
    return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function rgbParaHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function hslParaRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map((v) => Math.max(0, Math.min(255, Math.round(v))));
  }

  function luminancia(rgb) {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ajustarLegibilidade(h, s, l) {
    let rgb = hslParaRgb(h, s, l);
    let lum = luminancia(rgb);
    while (lum > LUM_MAX && l > 0.15) {
      l -= 0.01;
      rgb = hslParaRgb(h, s, l);
      lum = luminancia(rgb);
    }
    while (lum < LUM_MIN && l < 0.85) {
      l += 0.01;
      rgb = hslParaRgb(h, s, l);
      lum = luminancia(rgb);
    }
    return { rgb, l };
  }

  function calcularCor(hexEscolhido) {
    const rgbEscolhido = hexParaRgb(hexEscolhido) || hexParaRgb(COR_PADRAO);
    let [h, s, l] = rgbParaHsl(rgbEscolhido[0], rgbEscolhido[1], rgbEscolhido[2]);
    const colorida = s >= 0.12;
    if (colorida) s = Math.max(s, 0.35);

    const principal = ajustarLegibilidade(h, s, l);
    const secundaria = ajustarLegibilidade(colorida ? h + 35 : h, s, principal.l);
    const diferenca = Math.max(
      Math.abs(rgbEscolhido[0] - principal.rgb[0]),
      Math.abs(rgbEscolhido[1] - principal.rgb[1]),
      Math.abs(rgbEscolhido[2] - principal.rgb[2])
    );

    return {
      a: rgbParaHex(principal.rgb),
      b: rgbParaHex(secundaria.rgb),
      ar: principal.rgb.join(', '),
      br: secundaria.rgb.join(', '),
      ajustada: diferenca > 12
    };
  }

  function aplicarTema(tema) {
    if (!THEME_COLORS[tema]) tema = 'dark';
    root.setAttribute('data-theme', tema);
    try { localStorage.setItem(THEME_KEY, tema); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[tema]);
    document.querySelectorAll('.theme-option').forEach((b) => {
      b.classList.toggle('active', b.dataset.theme === tema);
    });
  }

  function marcarAccentAtivo(valor) {
    document.querySelectorAll('.accent-swatch').forEach((b) => {
      b.classList.toggle('active', b.dataset.accent === valor);
    });
  }

  function limparCorPersonalizada() {
    ['--accent', '--accent2', '--accent-rgb', '--accent2-rgb'].forEach((p) => root.style.removeProperty(p));
  }

  function lerCorPersonalizada() {
    let salva = null;
    try { salva = localStorage.getItem(CUSTOM_KEY); } catch (e) {}
    if (salva && hexParaRgb(salva)) return salva;
    const atual = getComputedStyle(root).getPropertyValue('--accent').trim();
    return hexParaRgb(atual) ? atual : COR_PADRAO;
  }

  function aplicarCorPersonalizada(hexEscolhido) {
    const cor = calcularCor(hexEscolhido);
    root.setAttribute('data-accent', 'custom');
    root.style.setProperty('--accent', cor.a);
    root.style.setProperty('--accent2', cor.b);
    root.style.setProperty('--accent-rgb', cor.ar);
    root.style.setProperty('--accent2-rgb', cor.br);
    try {
      localStorage.setItem(ACCENT_KEY, 'custom');
      localStorage.setItem(CUSTOM_KEY, hexEscolhido);
      localStorage.setItem(CUSTOM_VARS_KEY, JSON.stringify({ a: cor.a, b: cor.b, ar: cor.ar, br: cor.br }));
    } catch (e) {}
    marcarAccentAtivo('custom');
    if (notaCor) {
      notaCor.textContent = cor.ajustada
        ? 'Ajustamos o brilho da cor para manter a leitura: ' + cor.a + '.'
        : '';
    }
  }

  function aplicarAccent(nome) {
    if (nome === 'custom') {
      aplicarCorPersonalizada(lerCorPersonalizada());
      return;
    }
    if (!ACCENTS.includes(nome)) nome = 'verde';
    limparCorPersonalizada();
    root.setAttribute('data-accent', nome);
    try { localStorage.setItem(ACCENT_KEY, nome); } catch (e) {}
    marcarAccentAtivo(nome);
    if (notaCor) notaCor.textContent = '';
  }

  document.querySelectorAll('.theme-option').forEach((b) => {
    b.addEventListener('click', () => aplicarTema(b.dataset.theme));
  });
  document.querySelectorAll('.accent-swatch:not([data-accent="custom"])').forEach((b) => {
    b.addEventListener('click', () => aplicarAccent(b.dataset.accent));
  });

  if (swatchCustom && inputCor) {
    swatchCustom.addEventListener('click', (e) => {
      aplicarAccent('custom');
      if (e.target !== inputCor) inputCor.click();
    });
    inputCor.addEventListener('input', () => aplicarCorPersonalizada(inputCor.value));
  }

  $('btnResetTheme').addEventListener('click', () => { aplicarTema('dark'); aplicarAccent('verde'); });

  let temaSalvo = 'dark';
  let accentSalvo = 'verde';
  try {
    temaSalvo = localStorage.getItem(THEME_KEY) || 'dark';
    accentSalvo = localStorage.getItem(ACCENT_KEY) || 'verde';
  } catch (e) {}
  if (inputCor) inputCor.value = lerCorPersonalizada();
  aplicarTema(temaSalvo);
  aplicarAccent(accentSalvo);

  // ===== DADOS =====
  const STORAGE_KEY = 'financas_dados';
  const CORES_LISTA = ['amarelo', 'rosa', 'azul', 'verde', 'laranja', 'lilas'];

  function caixinhaPadrao() {
    return { pesoCarro: 600, pesoCasa: 300, mov: [] };
  }

  function dadosPadrao() {
    return { inicial: 0, lancamentos: [], listas: [], caixinha: caixinhaPadrao() };
  }

  function normalizarLista(l) {
    l = l || {};
    return {
      id: l.id || uid(),
      title: typeof l.title === 'string' ? l.title : '',
      color: CORES_LISTA.includes(l.color) ? l.color : 'amarelo',
      items: Array.isArray(l.items)
        ? l.items.map((i) => ({ id: i.id || uid(), nome: String(i.nome || ''), preco: Number(i.preco) || 0, ok: !!i.ok }))
        : []
    };
  }

  // Versões antigas guardavam uma lista única em "compras"
  function migrarCompras(compras) {
    if (!Array.isArray(compras) || compras.length === 0) return [];
    return [normalizarLista({
      title: 'Compras',
      color: 'verde',
      items: compras.map((i) => ({ id: i.id, nome: i.nome, preco: i.preco, ok: i.ok }))
    })];
  }

  function normalizarCaixinha(d) {
    const base = caixinhaPadrao();
    if (d && d.caixinha && typeof d.caixinha === 'object') {
      const c = d.caixinha;
      const pc = Number(c.pesoCarro);
      const pk = Number(c.pesoCasa);
      return {
        pesoCarro: isFinite(pc) && pc >= 0 ? pc : base.pesoCarro,
        pesoCasa: isFinite(pk) && pk >= 0 ? pk : base.pesoCasa,
        mov: Array.isArray(c.mov)
          ? c.mov.map((m) => ({
              id: m.id || uid(),
              data: m.data || new Date().toISOString(),
              tipo: m.tipo || 'dep',
              nota: m.nota || '',
              carro: Number(m.carro) || 0,
              casa: Number(m.casa) || 0
            }))
          : []
      };
    }
    // Versões antigas tinham várias caixinhas: tudo que for "carro" vai para o Carro, o resto para a Casa
    if (d && Array.isArray(d.caixinhas)) {
      let apCarro = 0;
      let apCasa = 0;
      d.caixinhas.forEach((old) => {
        const ehCarro = /carro/i.test(old.nome || '');
        if (ehCarro) apCarro += Number(old.aporte) || 0; else apCasa += Number(old.aporte) || 0;
        (old.mov || []).forEach((m) => {
          const v = Number(m.valor) || 0;
          base.mov.push({
            id: m.id || uid(),
            data: m.data || new Date().toISOString(),
            tipo: v >= 0 ? 'dep' : 'ret',
            nota: m.nota || 'Migrado',
            carro: ehCarro ? v : 0,
            casa: ehCarro ? 0 : v
          });
        });
      });
      base.mov.sort((x, y) => String(x.data).localeCompare(String(y.data)));
      if (apCarro + apCasa > 0) { base.pesoCarro = apCarro; base.pesoCasa = apCasa; }
    }
    return base;
  }

  function normalizar(d) {
    d = d || {};
    return {
      inicial: Number(d.inicial) || 0,
      lancamentos: Array.isArray(d.lancamentos) ? d.lancamentos : [],
      listas: Array.isArray(d.listas) ? d.listas.map(normalizarLista) : migrarCompras(d.compras),
      caixinha: normalizarCaixinha(d)
    };
  }

  function carregar() {
    try {
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (bruto) return normalizar(JSON.parse(bruto));
    } catch (e) {}
    return dadosPadrao();
  }

  let dados = carregar();

  function salvarLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); } catch (e) {}
  }

  function salvar() {
    salvarLocal();
    renderizarTudo();
    enviarNuvem();
  }

  const totalGasto = () => dados.lancamentos.reduce((a, l) => a + l.valor, 0);

  // ===== SINCRONIZAÇÃO (Firebase, opcional) =====
  const SYNC_KEY = 'fin_sync_code';
  const firebaseConfig = {
    apiKey: "AIzaSyCIvo6lPGMl-mbA3xfHJnMwuhEuy9xOLk0",
    authDomain: "jarvito-b4529.firebaseapp.com",
    projectId: "jarvito-b4529",
    storageBucket: "jarvito-b4529.firebasestorage.app",
    messagingSenderId: "282091474872",
    appId: "1:282091474872:web:fd17012475547f543ec94d"
  };

  let db = null;
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
    }
  } catch (err) {
    console.error('Firebase indisponível:', err);
  }

  let syncCode = null;
  try { syncCode = localStorage.getItem(SYNC_KEY) || null; } catch (e) {}
  let unsubscribeSnapshot = null;
  let aplicandoRemoto = false;
  let avisouErroSync = false;

  const syncStatus = $('syncStatus');
  const modalSyncCode = $('modalSyncCode');
  const syncCodeInput = $('syncCodeInput');
  const btnDisconnectSync = $('btnDisconnectSync');

  function atualizarStatusSync() {
    if (!db) {
      syncStatus.textContent = 'Firebase não carregou (sem internet?). Os dados estão salvos só neste aparelho.';
    } else if (syncCode) {
      syncStatus.textContent = 'Sincronizando com o código: ' + syncCode;
    } else {
      syncStatus.textContent = 'Sem código: dados salvos só neste aparelho.';
    }
  }

  function getDocRef() {
    return db.collection('financas').doc(syncCode);
  }

  function erroSync(err, acao) {
    console.error('Erro de sincronização (' + acao + '):', err);
    if (avisouErroSync) return;
    avisouErroSync = true;
    alert(err && err.code === 'permission-denied'
      ? 'O Firebase recusou a ' + acao + ' (permission-denied). Atualize as regras do Firestore no Firebase Console para a coleção "financas".'
      : 'Não foi possível sincronizar. Verifique sua conexão com a internet.');
  }

  function enviarNuvem() {
    if (!db || !syncCode || aplicandoRemoto) return;
    getDocRef().set({
      inicial: dados.inicial,
      lancamentos: dados.lancamentos,
      listas: dados.listas,
      caixinha: dados.caixinha,
      updatedAt: Date.now()
    }).catch((err) => erroSync(err, 'gravação'));
  }

  function iniciarSincronizacao() {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    atualizarStatusSync();
    if (!db || !syncCode) return;

    unsubscribeSnapshot = getDocRef().onSnapshot((doc) => {
      if (doc.metadata && doc.metadata.hasPendingWrites) return;
      if (doc.exists) {
        aplicandoRemoto = true;
        dados = normalizar(doc.data());
        salvarLocal();
        renderizarTudo(false);
        $('inicialInput').value = dados.inicial || '';
        aplicandoRemoto = false;
      } else {
        enviarNuvem();
      }
    }, (err) => erroSync(err, 'leitura'));
  }

  function abrirModalSync() {
    syncCodeInput.value = syncCode || '';
    btnDisconnectSync.style.display = syncCode ? 'block' : 'none';
    modalSyncCode.style.display = 'flex';
  }

  function fecharModalSync() { modalSyncCode.style.display = 'none'; }

  $('btnOpenSync').addEventListener('click', abrirModalSync);
  $('btnCloseSyncModal').addEventListener('click', fecharModalSync);

  $('btnConfirmSyncCode').addEventListener('click', () => {
    const novo = syncCodeInput.value.trim();
    if (!novo) {
      alert('Digite um código de sincronização!');
      return;
    }
    if (!db) {
      alert('O Firebase não carregou. Verifique sua conexão com a internet e recarregue a página.');
      return;
    }
    syncCode = novo;
    avisouErroSync = false;
    try { localStorage.setItem(SYNC_KEY, syncCode); } catch (e) {}
    fecharModalSync();
    iniciarSincronizacao();
  });

  btnDisconnectSync.addEventListener('click', () => {
    syncCode = null;
    try { localStorage.removeItem(SYNC_KEY); } catch (e) {}
    fecharModalSync();
    iniciarSincronizacao();
  });

  // ===== MODAIS (helpers) =====
  function abrir(modal) { modal.style.display = 'flex'; }
  function fechar(modal) { modal.style.display = 'none'; }

  // ===== DÉBITO RÁPIDO (botão do topo, igual ao Hot Idea) =====
  const modalDebito = $('modalDebito');
  const debitoValor = $('debitoValor');
  const debitoDesc = $('debitoDesc');

  function atualizarSugestoes() {
    const vistos = [];
    dados.lancamentos.forEach((l) => {
      if (l.desc && l.desc !== 'Gasto' && !vistos.includes(l.desc) && vistos.length < 15) vistos.push(l.desc);
    });
    $('debitoSugestoes').innerHTML = vistos.map((d) => `<option value="${escapeHtml(d)}"></option>`).join('');
  }

  function abrirDebito() {
    debitoValor.value = '';
    debitoDesc.value = '';
    atualizarSugestoes();
    abrir(modalDebito);
    debitoValor.focus();
  }

  function fecharDebito() { fechar(modalDebito); }

  function salvarDebito() {
    const valor = numero(debitoValor.value);
    if (valor <= 0) {
      alert('Digite um valor maior que zero!');
      debitoValor.focus();
      return;
    }
    dados.lancamentos.unshift({
      id: uid(),
      desc: debitoDesc.value.trim() || 'Gasto',
      valor: valor,
      data: new Date().toISOString()
    });
    fecharDebito();
    salvar();
  }

  document.querySelectorAll('.js-debit-btn').forEach((b) => b.addEventListener('click', abrirDebito));
  $('btnCloseDebito').addEventListener('click', fecharDebito);
  $('btnCancelDebito').addEventListener('click', fecharDebito);
  $('btnSaveDebito').addEventListener('click', salvarDebito);
  [debitoValor, debitoDesc].forEach((el) => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') salvarDebito(); });
  });

  // ===== MÊS =====
  $('btnDefinirInicial').addEventListener('click', () => {
    dados.inicial = numero($('inicialInput').value);
    salvar();
  });

  $('btnNovoMes').addEventListener('click', () => {
    if (!confirm('Zerar os lançamentos e começar um novo mês?')) return;
    dados.lancamentos = [];
    dados.inicial = 0;
    $('inicialInput').value = '';
    salvar();
    $('inicialInput').focus();
  });

  $('btnToggleLanc').addEventListener('click', () => {
    const box = $('lancamentosBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  $('listaLanc').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-lanc]');
    if (!btn) return;
    dados.lancamentos = dados.lancamentos.filter((l) => l.id !== btn.dataset.delLanc);
    salvar();
  });

  function renderizarMes() {
    const gasto = totalGasto();
    const saldo = dados.inicial - gasto;
    const pct = dados.inicial > 0 ? (gasto / dados.inicial) * 100 : 0;

    document.querySelectorAll('.js-saldo').forEach((el) => {
      el.textContent = brl(saldo);
      el.classList.toggle('negativo', saldo < 0);
    });
    $('lancCount').textContent = dados.lancamentos.length;

    $('mesResumo').textContent = 'Inicial ' + brl(dados.inicial) + ' · Gasto ' + brl(gasto);
    $('mesPct').textContent = dados.inicial > 0 ? pct.toFixed(0) + '% usado' : '';

    const barra = $('mesBarra');
    barra.style.width = Math.min(pct, 100) + '%';
    barra.className = 'progress-bar' + (pct >= 100 ? ' danger' : pct >= 75 ? ' yellow' : '');

    const lista = $('listaLanc');
    if (dados.lancamentos.length === 0) {
      lista.innerHTML = '<span class="vazio">Nenhum lançamento ainda. Use o botão do topo para debitar.</span>';
      return;
    }
    lista.innerHTML = dados.lancamentos.map((l) => `
      <div class="item">
        <div class="item-info">
          <div class="item-titulo">${escapeHtml(l.desc)}</div>
          <div class="item-sub">${dataCurta(l.data)}</div>
        </div>
        <span class="item-valor neg">- ${brl(l.valor)}</span>
        <button class="btn-mini perigo" data-del-lanc="${l.id}" title="Excluir"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');
  }

  // ===== COMPRAS (listas em post-its, igual ao Jarvito) =====
  const stickyListsBoard = $('stickyListsBoard');
  const newListTitleInput = $('newListTitleInput');
  const newListItemsInput = $('newListItemsInput');
  let corNovaLista = 'verde';
  let listaAberta = null;
  let rerenderListasPendente = false;
  let listaSaveTimeout = null;

  const obterLista = (id) => dados.listas.find((l) => l.id === id);
  const somaPrecos = (itens) => itens.reduce((a, i) => a + (i.preco || 0), 0);
  const precoTexto = (p) => (p ? String(p).replace('.', ',') : '');

  function salvarSemRender() {
    salvarLocal();
    enviarNuvem();
  }

  function salvarListasDebounced() {
    salvarLocal();
    clearTimeout(listaSaveTimeout);
    listaSaveTimeout = setTimeout(enviarNuvem, 500);
  }

  function editandoNaLista() {
    const a = document.activeElement;
    return !!(a && stickyListsBoard.contains(a) &&
      (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'checkbox')));
  }

  function focarAdicionarItem(id) {
    const card = stickyListsBoard.querySelector('.sticky-note[data-id="' + id + '"]');
    const campo = card && card.querySelector('.item-add-nome');
    if (campo) campo.focus();
  }

  document.querySelectorAll('#newListColorPicker .sticky-color-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      corNovaLista = dot.getAttribute('data-color');
      document.querySelectorAll('#newListColorPicker .sticky-color-dot').forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  $('btnAddList').addEventListener('click', () => {
    const itens = newListItemsInput.value
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)
      .map((nome) => ({ id: uid(), nome: nome, preco: 0, ok: false }));
    const lista = {
      id: uid(),
      title: newListTitleInput.value.trim() || 'Lista de compras',
      color: corNovaLista,
      items: itens
    };
    dados.listas.unshift(lista);
    newListTitleInput.value = '';
    newListItemsInput.value = '';
    listaAberta = itens.length === 0 ? lista.id : null;
    salvar();
    if (listaAberta) focarAdicionarItem(lista.id);
  });

  function atualizarTotaisCard(card, lista) {
    const el = card.querySelector('.lista-totais');
    if (!el) return;
    const marcados = somaPrecos(lista.items.filter((i) => i.ok));
    const falta = somaPrecos(lista.items.filter((i) => !i.ok));
    el.textContent = 'Falta ' + brl(falta) + ' · Marcados ' + brl(marcados);
  }

  function renderizarListas(forcar) {
    if (!forcar && editandoNaLista()) { rerenderListasPendente = true; return; }
    rerenderListasPendente = false;
    stickyListsBoard.innerHTML = '';

    if (dados.listas.length === 0) {
      stickyListsBoard.innerHTML = '<div class="sticky-empty">Nenhuma lista criada ainda. Use o painel acima para adicionar.</div>';
      return;
    }

    dados.listas.forEach((lista) => {
      const card = document.createElement('div');
      card.className = 'sticky-note color-' + lista.color + (lista.id === listaAberta ? ' open' : '');
      card.setAttribute('data-id', lista.id);

      const tituloLimpo = escapeHtml(lista.title);
      const temTitulo = lista.title.trim() !== '';
      const feitos = lista.items.filter((i) => i.ok).length;
      const falta = somaPrecos(lista.items.filter((i) => !i.ok));

      const linhas = lista.items.slice(0, 6).map((i) => `
        <div class="sticky-item-line ${i.ok ? 'feito' : ''}">
          <span class="nome">${i.ok ? '☑' : '☐'} ${escapeHtml(i.nome)}</span>
          <span class="preco">${i.preco ? brl(i.preco) : ''}</span>
        </div>`).join('');
      const mais = lista.items.length > 6 ? '<div class="sticky-more">+ ' + (lista.items.length - 6) + ' itens</div>' : '';
      const conteudo = lista.items.length
        ? '<div class="sticky-items">' + linhas + mais + '</div>'
        : '<div class="sticky-preview">Lista vazia. Toque para adicionar itens.</div>';

      const itensEdicao = lista.items.map((i) => `
        <div class="lista-edit-item ${i.ok ? 'feito' : ''}" data-item="${i.id}">
          <label><input type="checkbox" class="item-check" ${i.ok ? 'checked' : ''}><span class="nome">${escapeHtml(i.nome)}</span></label>
          <input type="text" class="lista-input preco-input" inputmode="decimal" placeholder="R$" value="${precoTexto(i.preco)}">
          <button type="button" class="btn-mini perigo item-remove" title="Remover"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('');

      const dots = CORES_LISTA.map((cor) =>
        '<button type="button" class="sticky-color-dot dot-' + cor + (lista.color === cor ? ' active' : '') + '" data-color="' + cor + '"></button>'
      ).join('');

      card.innerHTML = `
        <div class="sticky-header-banner"></div>
        <div class="sticky-view sticky-content-wrap">
          <div class="sticky-title ${temTitulo ? '' : 'is-empty'}">${temTitulo ? tituloLimpo : 'Sem título'}</div>
          ${conteudo}
          <div class="sticky-footer-info"><span>${feitos}/${lista.items.length} itens</span><span>Falta ${brl(falta)}</span></div>
        </div>
        <div class="sticky-edit">
          <input type="text" class="sticky-title-input" value="${tituloLimpo}" placeholder="Nome da lista...">
          <div class="lista-edit-itens">${itensEdicao}</div>
          <div class="lista-add-row">
            <input type="text" class="lista-input item-add-nome" placeholder="Novo item...">
            <input type="text" class="lista-input preco-input item-add-preco" inputmode="decimal" placeholder="R$">
            <button type="button" class="btn-action btn-add item-add-btn" title="Adicionar"><i class="fa-solid fa-plus"></i></button>
          </div>
          <div class="lista-totais"></div>
          <div class="sticky-tools">
            <div class="sticky-colors">${dots}</div>
            <div class="sticky-actions">
              <button type="button" class="sticky-btn debit btn-debit-list">Debitar marcados</button>
              <button type="button" class="sticky-btn delete btn-delete-list">Excluir</button>
              <button type="button" class="sticky-btn close btn-close-list">Fechar</button>
            </div>
          </div>
        </div>`;

      atualizarTotaisCard(card, lista);

      // abrir
      card.querySelector('.sticky-view').addEventListener('click', () => {
        document.querySelectorAll('.sticky-note.open').forEach((n) => { if (n !== card) n.classList.remove('open'); });
        card.classList.add('open');
        listaAberta = lista.id;
        if (lista.items.length === 0) focarAdicionarItem(lista.id);
      });

      // fechar
      card.querySelector('.btn-close-list').addEventListener('click', (e) => {
        e.stopPropagation();
        listaAberta = null;
        card.classList.remove('open');
        salvar();
      });

      // excluir
      card.querySelector('.btn-delete-list').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('Deseja realmente excluir esta lista?')) return;
        dados.listas = dados.listas.filter((l) => l.id !== lista.id);
        listaAberta = null;
        salvar();
      });

      // cor
      card.querySelectorAll('.sticky-colors .sticky-color-dot').forEach((dot) => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const l = obterLista(lista.id);
          if (!l) return;
          l.color = dot.getAttribute('data-color');
          card.className = 'sticky-note open color-' + l.color;
          card.querySelectorAll('.sticky-colors .sticky-color-dot').forEach((d) => d.classList.remove('active'));
          dot.classList.add('active');
          salvarSemRender();
        });
      });

      // título
      card.querySelector('.sticky-title-input').addEventListener('input', (e) => {
        const l = obterLista(lista.id);
        if (!l) return;
        l.title = e.target.value;
        salvarListasDebounced();
      });

      // itens existentes: marcar, preço, remover
      card.querySelectorAll('.lista-edit-item').forEach((linha) => {
        const itemId = linha.getAttribute('data-item');

        linha.querySelector('.item-check').addEventListener('change', (e) => {
          const l = obterLista(lista.id);
          const item = l && l.items.find((i) => i.id === itemId);
          if (!item) return;
          item.ok = e.target.checked;
          linha.classList.toggle('feito', item.ok);
          atualizarTotaisCard(card, l);
          salvarSemRender();
        });

        linha.querySelector('.preco-input').addEventListener('input', (e) => {
          const l = obterLista(lista.id);
          const item = l && l.items.find((i) => i.id === itemId);
          if (!item) return;
          item.preco = numero(e.target.value);
          atualizarTotaisCard(card, l);
          salvarListasDebounced();
        });

        linha.querySelector('.item-remove').addEventListener('click', () => {
          const l = obterLista(lista.id);
          if (!l) return;
          l.items = l.items.filter((i) => i.id !== itemId);
          listaAberta = l.id;
          salvar();
        });
      });

      // adicionar item
      const addNome = card.querySelector('.item-add-nome');
      const addPreco = card.querySelector('.item-add-preco');
      function adicionarItem() {
        const nome = addNome.value.trim();
        if (!nome) { addNome.focus(); return; }
        const l = obterLista(lista.id);
        if (!l) return;
        l.items.push({ id: uid(), nome: nome, preco: numero(addPreco.value), ok: false });
        listaAberta = l.id;
        salvar();
        focarAdicionarItem(l.id);
      }
      card.querySelector('.item-add-btn').addEventListener('click', adicionarItem);
      [addNome, addPreco].forEach((el) => {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionarItem(); });
      });

      // debitar marcados
      card.querySelector('.btn-debit-list').addEventListener('click', () => {
        const l = obterLista(lista.id);
        if (!l) return;
        const marcados = l.items.filter((i) => i.ok);
        if (marcados.length === 0) {
          alert('Marque pelo menos um item comprado.');
          return;
        }
        const total = somaPrecos(marcados);
        if (total <= 0) {
          alert('Informe o preço dos itens marcados antes de debitar.');
          return;
        }
        dados.lancamentos.unshift({
          id: uid(),
          desc: (l.title.trim() || 'Compras') + ' (' + marcados.length + (marcados.length === 1 ? ' item)' : ' itens)'),
          valor: total,
          data: new Date().toISOString()
        });
        l.items = l.items.filter((i) => !i.ok);
        listaAberta = l.id;
        salvar();
      });

      stickyListsBoard.appendChild(card);
    });
  }

  stickyListsBoard.addEventListener('focusout', () => {
    if (!rerenderListasPendente) return;
    setTimeout(() => {
      if (rerenderListasPendente && !editandoNaLista()) renderizarListas(true);
    }, 150);
  });

  // ===== CAIXINHA ÚNICA (Carro + Casa) =====
  const COR_CARRO = '#3b82f6';
  const COR_CASA = '#f59e0b';
  const arred = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const sinal = (n) => (n >= 0 ? '+' : '−') + ' ' + brl(Math.abs(n));

  function caixinhaTotais() {
    const mov = dados.caixinha.mov;
    const carro = arred(mov.reduce((a, m) => a + (m.carro || 0), 0));
    const casa = arred(mov.reduce((a, m) => a + (m.casa || 0), 0));
    return { carro: carro, casa: casa, total: arred(carro + casa) };
  }

  // Divide um valor pela proporção dos depósitos (ex.: 600 e 300 = 2/3 e 1/3)
  function dividirPorPesos(valor) {
    const pc = Math.max(Number(dados.caixinha.pesoCarro) || 0, 0);
    const pk = Math.max(Number(dados.caixinha.pesoCasa) || 0, 0);
    const soma = pc + pk;
    const carro = soma > 0 ? arred(valor * pc / soma) : arred(valor / 2);
    return { carro: carro, casa: arred(valor - carro) };
  }

  // Divide um valor pela proporção do que cada um tem guardado agora
  function dividirPorSaldos(valor) {
    const t = caixinhaTotais();
    if (t.total <= 0) return dividirPorPesos(valor);
    const carro = arred(valor * t.carro / t.total);
    return { carro: carro, casa: arred(valor - carro) };
  }

  function partesDaRetirada(valor) {
    const de = $('cxRetirarDe').value;
    if (de === 'carro') return { carro: valor, casa: 0 };
    if (de === 'casa') return { carro: 0, casa: valor };
    return dividirPorSaldos(valor);
  }

  function registrarMov(tipo, nota, carro, casa) {
    dados.caixinha.mov.push({ id: uid(), data: new Date().toISOString(), tipo: tipo, nota: nota, carro: carro, casa: casa });
  }

  function depositar() {
    const v = numero($('cxValor').value);
    if (v <= 0) {
      alert('Digite um valor maior que zero!');
      $('cxValor').focus();
      return;
    }
    const p = dividirPorPesos(v);
    registrarMov('dep', 'Depósito', p.carro, p.casa);
    $('cxValor').value = '';
    salvar();
  }

  function retirar() {
    const v = numero($('cxValor').value);
    if (v <= 0) {
      alert('Digite um valor maior que zero!');
      $('cxValor').focus();
      return;
    }
    const p = partesDaRetirada(v);
    const t = caixinhaTotais();
    if (p.carro > t.carro + 0.005) {
      alert('O Carro só tem ' + brl(t.carro) + ' guardado.');
      return;
    }
    if (p.casa > t.casa + 0.005) {
      alert('A Casa só tem ' + brl(t.casa) + ' guardado.');
      return;
    }
    registrarMov('ret', 'Retirada', -p.carro, -p.casa);
    $('cxValor').value = '';
    salvar();
  }

  $('btnCxDepositar').addEventListener('click', depositar);
  $('btnCxRetirar').addEventListener('click', retirar);
  $('cxValor').addEventListener('keydown', (e) => { if (e.key === 'Enter') depositar(); });
  $('cxValor').addEventListener('input', renderizarPreviewCx);
  $('cxRetirarDe').addEventListener('change', renderizarPreviewCx);

  function proporcaoTexto() {
    const pc = Math.max(numero($('cxPesoCarro').value), 0);
    const pk = Math.max(numero($('cxPesoCasa').value), 0);
    const soma = pc + pk;
    if (soma <= 0) return 'Informe um valor para o Carro e/ou para a Casa.';
    return 'Proporção: Carro ' + (pc / soma * 100).toFixed(1).replace('.', ',') + '% · Casa ' + (pk / soma * 100).toFixed(1).replace('.', ',') + '%';
  }

  $('cxPesoCarro').addEventListener('input', () => { $('cxProporcao').textContent = proporcaoTexto(); });
  $('cxPesoCasa').addEventListener('input', () => { $('cxProporcao').textContent = proporcaoTexto(); });

  $('btnCxSalvarDivisao').addEventListener('click', () => {
    const pc = numero($('cxPesoCarro').value);
    const pk = numero($('cxPesoCasa').value);
    if (pc < 0 || pk < 0 || pc + pk <= 0) {
      alert('Informe valores válidos para o Carro e a Casa.');
      return;
    }
    dados.caixinha.pesoCarro = pc;
    dados.caixinha.pesoCasa = pk;
    salvar();
  });

  $('btnCxAjustar').addEventListener('click', () => {
    const bruto = $('cxTotalReal').value.trim();
    if (!bruto) {
      alert('Informe o total que você tem guardado.');
      return;
    }
    const alvo = numero(bruto);
    const t = caixinhaTotais();
    const diff = arred(alvo - t.total);
    if (Math.abs(diff) < 0.005) {
      alert('O total já está em ' + brl(t.total) + '.');
      return;
    }
    if (diff > 0) {
      const p = dividirPorPesos(diff);
      registrarMov('aj', 'Ajuste de total', p.carro, p.casa);
    } else {
      const p = dividirPorSaldos(-diff);
      registrarMov('aj', 'Ajuste de total', -p.carro, -p.casa);
    }
    $('cxTotalReal').value = '';
    salvar();
  });

  function renderizarPreviewCx() {
    const v = numero($('cxValor').value);
    const box = $('cxPreview');
    if (v <= 0) { box.innerHTML = ''; return; }
    const d = dividirPorPesos(v);
    const r = partesDaRetirada(v);
    box.innerHTML =
      '<div>Ao depositar: Carro <strong>' + brl(d.carro) + '</strong> · Casa <strong>' + brl(d.casa) + '</strong></div>' +
      '<div>Ao retirar: Carro <strong>' + brl(r.carro) + '</strong> · Casa <strong>' + brl(r.casa) + '</strong></div>';
  }

  function renderizarCaixinha() {
    const t = caixinhaTotais();
    const pctCarro = t.total > 0 ? (t.carro / t.total) * 100 : 0;
    const pctCasa = t.total > 0 ? (t.casa / t.total) * 100 : 0;

    $('cxTotal').textContent = brl(t.total);
    $('cxCarro').textContent = brl(t.carro);
    $('cxCasa').textContent = brl(t.casa);
    $('cxCarroPct').textContent = t.total > 0 ? pctCarro.toFixed(1).replace('.', ',') + '% do total' : '';
    $('cxCasaPct').textContent = t.total > 0 ? pctCasa.toFixed(1).replace('.', ',') + '% do total' : '';

    $('cxBar').innerHTML = t.total > 0
      ? '<i style="width:' + Math.max(pctCarro, 0) + '%; background:' + COR_CARRO + ';"></i>' +
        '<i style="width:' + Math.max(pctCasa, 0) + '%; background:' + COR_CASA + ';"></i>'
      : '';

    if (document.activeElement !== $('cxPesoCarro')) $('cxPesoCarro').value = String(dados.caixinha.pesoCarro).replace('.', ',');
    if (document.activeElement !== $('cxPesoCasa')) $('cxPesoCasa').value = String(dados.caixinha.pesoCasa).replace('.', ',');
    $('cxProporcao').textContent = proporcaoTexto();

    const hist = dados.caixinha.mov.slice(-10).reverse();
    $('cxHistorico').innerHTML = hist.length
      ? hist.map((m) => {
          const total = arred((m.carro || 0) + (m.casa || 0));
          return `
            <div class="item">
              <div class="item-info">
                <div class="item-titulo">${escapeHtml(m.nota || '')}</div>
                <div class="item-sub">${dataCurta(m.data)} · Carro ${sinal(m.carro || 0)} · Casa ${sinal(m.casa || 0)}</div>
              </div>
              <span class="item-valor ${total >= 0 ? 'ok' : 'neg'}">${sinal(total)}</span>
            </div>`;
        }).join('')
      : '<span class="vazio">Nenhuma movimentação ainda.</span>';

    renderizarPreviewCx();
  }

  // ===== RESUMO NOS BLOCOS DA TELA INICIAL =====
  function renderizarTiles() {
    $('tileCxInfo').textContent = brl(caixinhaTotais().total) + ' guardado';
    const pendentes = dados.listas.reduce((a, l) => a + l.items.filter((i) => !i.ok).length, 0);
    const n = dados.listas.length;
    $('tileCompInfo').textContent = n
      ? n + (n === 1 ? ' lista' : ' listas') + ' · ' + pendentes + (pendentes === 1 ? ' item' : ' itens')
      : 'Nenhuma lista ainda';
  }

  // ===== INÍCIO =====
  function renderizarTudo(forcar) {
    renderizarMes();
    renderizarListas(forcar !== false);
    renderizarCaixinha();
    renderizarTiles();
  }

  $('inicialInput').value = dados.inicial || '';
  renderizarTudo();
  iniciarSincronizacao();

  // Atalho do ícone do app (pressionar e segurar): abre direto o débito rápido
  if (new URLSearchParams(window.location.search).get('debito') === '1') abrirDebito();

  window.__monesitoOk = true;

});