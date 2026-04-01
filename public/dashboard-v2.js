// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD v2 - JavaScript das novas funcionalidades LS Impulsiona
// ════════════════════════════════════════════════════════════════════════════════

// Pontos por servico (sistema de ranking) — editavel pelo admin
const PONTOS_SERVICO = {
  'Pacote 4 Vídeos Persuasivos': 4,
  'Pacote 5 Vídeos Persuasivos': 5,
  'Pacote 6 Vídeos Persuasivos': 6,
  'Pacote 7 Vídeos Persuasivos': 7,
  'Tráfego Pago':   3,
  'Social Media':   3,
  'Automação':      5,
  'CRM':            1,
};

// Carregar pontos customizados salvos pelo admin
try {
  const _saved = JSON.parse(localStorage.getItem('ls_pontos_servico') || 'null');
  if (_saved && typeof _saved === 'object') Object.assign(PONTOS_SERVICO, _saved);
} catch(e) {}

function getPontosServico(servico) {
  if (!servico) return 1;
  for (const [key, pts] of Object.entries(PONTOS_SERVICO)) {
    if (servico.toLowerCase().includes(key.toLowerCase())) return pts;
  }
  return 1;
}

function toggleEditarPontos(btn) {
  const ptsInputs = document.querySelectorAll('.pts-input');
  const nomeInputs = document.querySelectorAll('.nome-input');
  const ptsLabels = document.querySelectorAll('.pts-label');
  const nomeLabels = document.querySelectorAll('.nome-label');
  const btnSalvar = document.getElementById('btnSalvarPontos');
  const editando = btn.dataset.editando === '1';
  if (!editando) {
    ptsInputs.forEach(i => i.style.display = 'inline-block');
    nomeInputs.forEach(i => i.style.display = 'inline-block');
    ptsLabels.forEach(l => l.style.display = 'none');
    nomeLabels.forEach(l => l.style.display = 'none');
    if (btnSalvar) btnSalvar.style.display = 'block';
    btn.textContent = '✕ Cancelar';
    btn.dataset.editando = '1';
  } else {
    ptsInputs.forEach(i => i.style.display = 'none');
    nomeInputs.forEach(i => i.style.display = 'none');
    ptsLabels.forEach(l => l.style.display = 'inline');
    nomeLabels.forEach(l => l.style.display = 'inline');
    if (btnSalvar) btnSalvar.style.display = 'none';
    btn.textContent = '✏️ Editar';
    btn.dataset.editando = '0';
  }
}

function salvarTodosPontos() {
  const newPontos = {};
  document.querySelectorAll('.pts-input').forEach(input => {
    const nomeOriginal = input.dataset.servico;
    const nomeInput = document.querySelector(`.nome-input[data-servico="${nomeOriginal.replace(/"/g, '\\"')}"]`);
    const novoNome = (nomeInput ? nomeInput.value.trim() : '') || nomeOriginal;
    const pts = parseInt(input.value) || 1;
    newPontos[novoNome] = pts;
    // atualiza data-servico para permitir edições subsequentes
    input.dataset.servico = novoNome;
    if (nomeInput) nomeInput.dataset.servico = novoNome;
  });
  Object.keys(PONTOS_SERVICO).forEach(k => delete PONTOS_SERVICO[k]);
  Object.assign(PONTOS_SERVICO, newPontos);
  try { localStorage.setItem('ls_pontos_servico', JSON.stringify(PONTOS_SERVICO)); } catch(e) {}
  if (typeof toast === 'function') toast('Pontos salvos!', 'success');
  renderRanking();
}

// Renderizar Dashboard v2 com gráficos e KPIs
async function renderDashboardV2() {
  try {
    const res = await _api('/api/dashboard/resumo');
    const data = await res.json();
    if (!data || data.error) throw new Error(data.error || 'Erro ao carregar resumo');

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">Dashboard Resumo</h1></div>
    </div>

    <div class="g4" style="margin-bottom: 24px;">
      <div class="scard">
        <div class="scard-ico" style="background: #dbeafe; color: #0284c7;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="scard-val">R$ ${fmt(data.meta_dia.realizado)}</div>
        <div class="scard-lbl">Meta Diária: ${data.meta_dia.pct}%</div>
        <div style="margin-top: 8px; width: 100%; height: 4px; background: #e0e7ff; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(data.meta_dia.pct, 100)}%; background: #0284c7;"></div>
        </div>
      </div>

      <div class="scard">
        <div class="scard-ico" style="background: #fef3c7; color: #f59e0b;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="scard-val">R$ ${fmt(data.meta_semana.realizado)}</div>
        <div class="scard-lbl">Meta Semanal: ${data.meta_semana.pct}%</div>
        <div style="margin-top: 8px; width: 100%; height: 4px; background: #fcd34d; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(data.meta_semana.pct, 100)}%; background: #f59e0b;"></div>
        </div>
      </div>

      <div class="scard">
        <div class="scard-ico" style="background: #dbeafe; color: #2563eb;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="scard-val">R$ ${fmt(data.meta_mes.realizado)}</div>
        <div class="scard-lbl">Meta Mensal: ${data.meta_mes.pct}%</div>
        <div style="margin-top: 8px; width: 100%; height: 4px; background: #bbf7d0; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(data.meta_mes.pct, 100)}%; background: #2563eb;"></div>
        </div>
      </div>

      <div class="scard">
        <div class="scard-ico" style="background: #fce7f3; color: #ec4899;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <div class="scard-val">${data.taxa_conversao}%</div>
        <div class="scard-lbl">Taxa de Conversão</div>
      </div>
    </div>

    <div class="g2" style="margin-bottom: 24px;">
      <div style="background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 16px;">
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 14px;">Conversoes (7 dias)</h3>
        <canvas id="chartConversoes" height="200"></canvas>
      </div>

      <div style="background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 16px;">
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 14px;">Ranking</h3>
        <div id="rankingMini"></div>
      </div>
    </div>
    `;

    document.getElementById('view-dashboard-v2').innerHTML = html;

    setTimeout(async () => {
      try {
        const convRes = await _api('/api/dashboard/grafico-conversoes');
        const conv = await convRes.json();

        if (window.Chart) {
          new Chart(document.getElementById('chartConversoes'), {
            type: 'line',
            data: {
              labels: conv.map(c => new Date(c.data + 'T12:00').toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' })),
              datasets: [
                { label: 'Vendas', data: conv.map(c => c.vendas), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.4 },
                { label: 'Leads',  data: conv.map(c => c.leads),  borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4 }
              ]
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true, position: 'top' } } }
          });
        }
      } catch(e) {}

      try {
        const rankRes = await _api('/api/ranking');
        const ranking = await rankRes.json();
        document.getElementById('rankingMini').innerHTML = ranking.slice(0, 4).map((r, idx) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f5;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: ${['#fbbf24', '#9ca3af', '#f97316', '#93c5fd'][idx] || '#e5e7eb'}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px;">${['🥇','🥈','🥉','4º'][idx]||idx+1}</div>
              <div style="font-size: 12px; font-weight: 600;">${r.nome}</div>
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #2563eb;">${r.pontos} pts</div>
          </div>
        `).join('');
      } catch(e) {}
    }, 100);
  } catch(e) {
    console.error('Erro ao renderizar dashboard v2:', e);
    toast(e.message, 'error');
  }
}

// Helper para fetch com token
function _api(url, opts) {
  const token = (typeof currentUser !== 'undefined' && currentUser && currentUser.token)
    ? currentUser.token
    : (typeof localStorage !== 'undefined' ? localStorage.getItem('alliance_token') : '');
  return fetch(url, { ...opts, headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json', ...(opts && opts.headers) } });
}

// Renderizar aba "Que chegou" (Leads com filtros)
async function renderQueChegou() {
  try {
    const res = await _api('/api/leads');
    const leads = await res.json();

    const totalLeads = leads.length;
    const html = `
    <div class="ph">
      <div>
        <h1 class="ptitle">Que Chegou</h1>
        <div class="psub">Total de leads: <strong style="color:var(--blue)">${totalLeads}</strong></div>
      </div>
      <div style="display: flex; gap: 8px;">
        <select id="filtroStatus" onchange="renderQueChegou()" class="inp" style="max-width: 160px;">
          <option value="">Todos</option>
          <option value="CHEGOU">Chegou</option>
          <option value="CONVERTEU">Converteu</option>
          <option value="NÃO CONVERTEU">Nao Converteu</option>
          <option value="FOLLOW-UP 1">Follow-up 1</option>
          <option value="FOLLOW-UP 2">Follow-up 2</option>
          <option value="FOLLOW-UP 3">Follow-up 3</option>
          <option value="INDICAÇÃO">Indicacao</option>
        </select>
      </div>
    </div>

    <div style="background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.05);">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Nome</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Telefone</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Valor</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Status</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Data</th>
          </tr>
        </thead>
        <tbody id="tabelaLeads"></tbody>
      </table>
    </div>
    `;

    document.getElementById('view-que-chegou').innerHTML = html;

    setTimeout(() => {
      const filtro = document.getElementById('filtroStatus')?.value || '';
      const filtered = filtro ? leads.filter(l => l.status === filtro) : leads;

      document.getElementById('tabelaLeads').innerHTML = filtered.map(l => `
        <tr style="border-top: 1px solid #f3f4f6; cursor: pointer;" onclick="viewLead && viewLead('${l.id}')">
          <td style="padding: 12px; font-size: 13px; font-weight: 600;">${l.nome||''}</td>
          <td style="padding: 12px; font-size: 13px;">${typeof fmtPhone==='function'?fmtPhone(l.telefone||''):l.telefone||''}</td>
          <td style="padding: 12px; font-size: 13px; color: #059669; font-weight: 700;">R$ ${typeof fmt==='function'?fmt(l.valor||0):(l.valor||0)}</td>
          <td style="padding: 12px; font-size: 13px;">
            <span style="padding: 3px 8px; border-radius: 6px; background: ${(typeof STATUS_BG!=='undefined'&&STATUS_BG[l.status])||'#f3f4f6'}; color: ${(typeof STATUS_COLORS!=='undefined'&&STATUS_COLORS[l.status])||'#6b7280'}; font-size: 11px; font-weight: 600;">${l.status||''}</span>
          </td>
          <td style="padding: 12px; font-size: 13px; color: #9ca3af;">${typeof fmtDate==='function'?fmtDate(l.criado_em):l.criado_em||''}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">Nenhum lead</td></tr>';
    }, 10);
  } catch(e) {
    console.error('Erro:', e);
    toast(e.message, 'error');
  }
}

// Renderizar aba "Se converteu" (Vendas)
async function renderSeConverteu() {
  try {
    const res = await _api('/api/vendas');
    const vendas = await res.json();

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">Se converteu</h1></div>
    </div>

    <div style="background: #fff; border-radius: 14px; overflow-x: auto; box-shadow: 0 1px 4px rgba(0,0,0,.05);">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Cliente</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Valor</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Servico</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Pagamento</th>
            <th style="padding: 12px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280;">Data</th>
          </tr>
        </thead>
        <tbody id="tabelaVendas"></tbody>
      </table>
    </div>
    `;

    document.getElementById('view-se-converteu').innerHTML = html;

    setTimeout(() => {
      document.getElementById('tabelaVendas').innerHTML = vendas.map(v => `
        <tr style="border-top: 1px solid #f3f4f6;">
          <td style="padding: 12px; font-size: 13px; font-weight: 600;">${v.cliente_nome||''}</td>
          <td style="padding: 12px; font-size: 13px; font-weight: 700; color: #2563eb;">R$ ${typeof fmt==='function'?fmt(v.valor):v.valor}</td>
          <td style="padding: 12px; font-size: 13px; color: #52525b;">${v.servico||'—'}</td>
          <td style="padding: 12px; font-size: 13px;">${v.pagamento||''}</td>
          <td style="padding: 12px; font-size: 13px; color: #9ca3af;">${typeof fmtDate==='function'?fmtDate(v.criado_em):v.criado_em||''}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">Nenhuma venda</td></tr>';
    }, 10);
  } catch(e) {
    console.error('Erro:', e);
    toast(e.message, 'error');
  }
}

// Renderizar aba "Videos"
async function renderVideos() {
  let videos = [];
  try {
    const res = await _api('/api/videos');
    videos = await res.json();
  } catch(e) { videos = []; }

  const html = `
  <div class="ph">
    <div><h1 class="ptitle">Videos</h1><div class="psub">Gestao de videos crus e prontos</div></div>
    <button class="btn btn-primary" onclick="abrirModalVideo()">+ Novo Video</button>
  </div>

  <!-- Secao Videos Crus -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-hdr">
      <div class="card-title">Videos Crus</div>
      <span style="font-size:11px;color:var(--z500)">Aguardando edicao</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Data</th>
            <th>Status</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${videos.filter(v => v.status==='Cru' || v.status==='CRU' || !v.status || v.status==='AGUARDANDO').map(v => `
            <tr>
              <td style="font-weight:600">${v.cliente_nome||''}</td>
              <td>${typeof fmtDate==='function'?fmtDate(v.criado_em||v.data_entrega):v.criado_em||''}</td>
              <td><span style="padding:2px 8px;border-radius:6px;background:#fef3c7;color:#d97706;font-size:10px;font-weight:700">Cru</span></td>
              <td>
                <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="marcarVideoPronto(${v.id})">Marcar Pronto</button>
                <button class="btn btn-danger" style="font-size:11px;padding:4px 8px" onclick="deletarVideo(${v.id})">Excluir</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--z400)">Nenhum video cru</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Secao Videos Prontos -->
  <div class="card">
    <div class="card-hdr">
      <div class="card-title">Videos Prontos</div>
      <span style="font-size:11px;color:var(--z500)">Editados e prontos para entrega</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Data Entrega</th>
            <th>Status</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${videos.filter(v => v.status==='Pronto' || v.status==='PRONTO' || v.status==='ENVIADO').map(v => `
            <tr>
              <td style="font-weight:600">${v.cliente_nome||''}</td>
              <td>${v.data_entrega||typeof fmtDate==='function'?fmtDate(v.criado_em):v.criado_em||''}</td>
              <td><span style="padding:2px 8px;border-radius:6px;background:#d1fae5;color:#065f46;font-size:10px;font-weight:700">${v.status==='ENVIADO'?'Enviado':'Pronto'}</span></td>
              <td>
                <button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="enviarVideoCliente(${v.id}, this.dataset.nome)" data-nome="${(v.cliente_nome||'').replace(/"/g,'&quot;')}">Enviar para Cliente</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--z400)">Nenhum video pronto</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  `;

  document.getElementById('view-videos').innerHTML = html;
}

function abrirModalVideo() {
  document.getElementById('modalNovoVideo')?.remove();
  const m = document.createElement('div');
  m.id = 'modalNovoVideo';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:460px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-size:17px;font-weight:800;color:#1e293b">Adicionar Vídeo</div>
        <button onclick="document.getElementById('modalNovoVideo').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b">✕</button>
      </div>
      <div style="display:grid;gap:14px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">CLIENTE *</label>
          <input type="text" id="videoCliente" placeholder="Nome do cliente" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">TIPO</label>
          <select id="videoTipo" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;background:#fff">
            <option value="Cru">Cru (bruto — material do cliente)</option>
            <option value="Pronto">Pronto (editado — para entrega)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">ARQUIVO DE VÍDEO *</label>
          <input type="file" id="videoArquivo" accept="video/*,.mp4,.mov,.avi,.mkv,.zip,.rar" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;background:#f8fafc">
          <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">MP4, MOV, AVI, MKV, ZIP — máx 500MB</p>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">DATA DE ENTREGA</label>
          <input type="date" id="videoData" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="document.getElementById('modalNovoVideo').remove()" style="flex:1;padding:11px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#64748b">Cancelar</button>
        <button id="btnSalvarVideo" onclick="salvarNovoVideo()" style="flex:2;padding:11px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-size:13px;font-weight:700">Enviar Vídeo</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target === m) m.remove(); });
}

async function salvarNovoVideo() {
  const cliente = (document.getElementById('videoCliente')?.value || '').trim();
  const tipo    = document.getElementById('videoTipo')?.value || 'Cru';
  const arquivo = document.getElementById('videoArquivo')?.files?.[0];
  const data    = document.getElementById('videoData')?.value || '';
  if (!cliente) { toast('Nome do cliente obrigatório', 'error'); return; }
  if (!arquivo) { toast('Selecione um arquivo de vídeo', 'error'); return; }
  const btn = document.getElementById('btnSalvarVideo');
  if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }
  try {
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('cliente_nome', cliente);
    form.append('tipo', tipo);
    form.append('data_entrega', data);
    const token = localStorage.getItem('alliance_token') || '';
    const res = await fetch('/api/videos/upload', { method:'POST', headers:{'Authorization':'Bearer '+token}, body: form });
    const d = await res.json();
    if (d.ok || d.id) {
      toast('Vídeo enviado com sucesso!', 'success');
      document.getElementById('modalNovoVideo')?.remove();
      renderVideos();
    } else {
      toast(d.error || 'Erro ao enviar', 'error');
      if (btn) { btn.textContent = 'Enviar Vídeo'; btn.disabled = false; }
    }
  } catch(e) {
    toast('Erro ao enviar arquivo', 'error');
    if (btn) { btn.textContent = 'Enviar Vídeo'; btn.disabled = false; }
  }
}

async function marcarVideoPronto(id) {
  try {
    const res = await _api(`/api/videos/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Pronto' }) });
    const d = await res.json();
    if (d.ok) { toast('Video marcado como pronto!', 'success'); renderVideos(); }
    else toast(d.error || 'Erro', 'error');
  } catch(e) { toast(e.message, 'error'); }
}

async function deletarVideo(id) {
  if (!confirm('Excluir este video?')) return;
  try {
    const res = await _api(`/api/videos/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (d.ok) { toast('Video excluido', 'success'); renderVideos(); }
    else toast(d.error || 'Erro', 'error');
  } catch(e) { toast(e.message, 'error'); }
}

function enviarVideoCliente(id, clienteNome) {
  const msg = `Ola ${clienteNome}! Seu video esta pronto. Em breve enviaremos o link de acesso.`;
  const wpp = encodeURIComponent(msg);
  toast('Video marcado como enviado!', 'success');
  _api(`/api/videos/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'ENVIADO' }) })
    .then(() => renderVideos()).catch(() => {});
}

// ═══════════════════════════════════════════════════════
// INDICACOES
// ═══════════════════════════════════════════════════════

async function renderIndicacoes() {
  let indicacoes = [];
  try {
    const res = await _api('/api/indicacoes');
    indicacoes = await res.json();
  } catch(e) { indicacoes = []; }

  const STATUS_IND = {
    'em_negociacao': { label: 'Em negociacao', bg: '#fef3c7', col: '#d97706' },
    'fechou':        { label: 'Fechou',         bg: '#d1fae5', col: '#065f46' },
    'nao_fechou':    { label: 'Nao fechou',     bg: '#fee2e2', col: '#991b1b' },
    'LEAD':          { label: 'Lead',            bg: '#dbeafe', col: '#1e40af' },
  };

  const html = `
  <div class="ph">
    <div><h1 class="ptitle">Indicacoes</h1><div class="psub">Programa de indicacoes da LS Impulsiona</div></div>
    <button class="btn btn-primary" onclick="abrirModalIndicacao()">+ Nova Indicacao</button>
  </div>

  <div class="card">
    <div style="overflow-x:auto">
      <table class="tbl">
        <thead>
          <tr>
            <th>Quem Indicou</th>
            <th>Indicou Para</th>
            <th>Status</th>
            <th>Desconto (%)</th>
            <th>Data</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${indicacoes.map(i => {
            const st = STATUS_IND[i.status] || STATUS_IND['em_negociacao'];
            return `<tr>
              <td style="font-weight:600">${i.quem_indicou || i.venda_id_indicador || '—'}</td>
              <td>${i.indicado_para || i.novo_cliente_nome || '—'}</td>
              <td><span style="padding:3px 8px;border-radius:6px;background:${st.bg};color:${st.col};font-size:11px;font-weight:700">${st.label}</span></td>
              <td style="text-align:center">${i.desconto_percentual||0}%</td>
              <td style="color:#9ca3af">${typeof fmtDate==='function'?fmtDate(i.criado_em):i.criado_em||''}</td>
              <td>
                <select onchange="atualizarStatusIndicacao(${i.id}, this.value)" class="inp" style="font-size:11px;padding:3px 6px;max-width:130px">
                  <option ${i.status==='em_negociacao'?'selected':''} value="em_negociacao">Em negociacao</option>
                  <option ${i.status==='fechou'?'selected':''} value="fechou">Fechou</option>
                  <option ${i.status==='nao_fechou'?'selected':''} value="nao_fechou">Nao fechou</option>
                </select>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--z400)">Nenhuma indicacao cadastrada</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  `;

  document.getElementById('view-indicacoes').innerHTML = html;
}

function abrirModalIndicacao() {
  document.getElementById('modalNovaIndicacao')?.remove();
  const m = document.createElement('div');
  m.id = 'modalNovaIndicacao';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:460px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-size:17px;font-weight:800;color:#1e293b">Nova Indicação</div>
        <button onclick="document.getElementById('modalNovaIndicacao').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b">✕</button>
      </div>
      <div style="display:grid;gap:14px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">QUEM INDICOU *</label>
          <input type="text" id="indQuemIndicou" placeholder="Nome do cliente que indicou" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">INDICOU PARA (futuro cliente) *</label>
          <input type="text" id="indIndicadoPara" placeholder="Nome do novo cliente indicado" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">WHATSAPP DO NOVO CLIENTE</label>
          <input type="text" id="indTelefone" placeholder="(00) 00000-0000" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">DESCONTO CONCEDIDO (%)</label>
          <input type="number" id="indDesconto" placeholder="0" min="0" max="100" value="0" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:4px">STATUS</label>
          <select id="indStatus" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;background:#fff">
            <option value="em_negociacao">Em negociação</option>
            <option value="fechou">Fechou</option>
            <option value="nao_fechou">Não fechou</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="document.getElementById('modalNovaIndicacao').remove()" style="flex:1;padding:11px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#64748b">Cancelar</button>
        <button onclick="salvarNovaIndicacao()" style="flex:2;padding:11px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-size:13px;font-weight:700">Salvar Indicação</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if(e.target === m) m.remove(); });
}

async function salvarNovaIndicacao() {
  const quem  = (document.getElementById('indQuemIndicou')?.value || '').trim();
  const para  = (document.getElementById('indIndicadoPara')?.value || '').trim();
  const status = document.getElementById('indStatus')?.value || 'em_negociacao';
  const desc  = parseFloat(document.getElementById('indDesconto')?.value || '0') || 0;
  if (!quem || !para) { toast('Preencha quem indicou e para quem', 'error'); return; }
  try {
    const res = await _api('/api/indicacoes', {
      method: 'POST',
      body: JSON.stringify({ quem_indicou: quem, indicado_para: para, status, desconto_percentual: desc })
    });
    const d = await res.json();
    if (d.ok) { toast('Indicacao salva!', 'success'); fecharModalIndicacao(); renderIndicacoes(); }
    else toast(d.error || 'Erro', 'error');
  } catch(e) { toast(e.message, 'error'); }
}

async function atualizarStatusIndicacao(id, status) {
  try {
    const res = await _api(`/api/indicacoes/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    const d = await res.json();
    if (d.ok) toast('Status atualizado!', 'success');
    else toast(d.error || 'Erro', 'error');
  } catch(e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════
// RANKING
// ═══════════════════════════════════════════════════════

async function renderRanking() {
  let ranking = [];
  try {
    const res = await _api('/api/ranking');
    ranking = await res.json();
  } catch(e) { ranking = []; }

  const isAdmin = typeof currentUser !== 'undefined' && currentUser && ['admin','gestor'].includes(currentUser.role);
  const medalhas = ['🥇', '🥈', '🥉'];
  const medalBg = ['#fbbf24', '#9ca3af', '#f97316', '#93c5fd'];

  const html = `
  <div class="ph">
    <div><h1 class="ptitle">Ranking</h1><div class="psub">Pontuacao dos atendentes LS Impulsiona</div></div>
    ${isAdmin ? '<span style="font-size:11px;color:var(--z500)">Clique nos pontos para editar</span>' : ''}
  </div>

  <div class="g2">
    <div class="card" style="flex:1">
      <div class="card-hdr">
        <div class="card-title">Top Atendentes</div>
        <div class="card-sub">Daniel · Gabriel · Pedro · Kim</div>
      </div>
      <div style="overflow-x:auto">
        <table class="tbl">
          <thead>
            <tr>
              <th>Posicao</th>
              <th>Atendente</th>
              <th>Vendas</th>
              <th>Pontos</th>
              ${isAdmin ? '<th>Editar</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${ranking.map((r, idx) => `
              <tr style="border-top: 1px solid #f3f4f6;">
                <td style="padding: 12px; font-size: 18px; text-align:center;">${medalhas[idx] || idx+1+'º'}</td>
                <td style="padding: 12px; font-size: 13px; font-weight: 700;">${r.nome}</td>
                <td style="padding: 12px; font-size: 13px; color: #0284c7; font-weight: 600;">${r.vendas || 0}</td>
                <td style="padding: 12px; font-size: 14px; font-weight: 800; color: #2563eb;">
                  ${isAdmin
                    ? `<span onclick="editarPontosRanking(${r.id}, '${r.nome}', ${r.pontos}, ${r.vendas})" style="cursor:pointer;border-bottom:1px dashed #2563eb" title="Clique para editar">${r.pontos}</span>`
                    : r.pontos
                  } pts
                </td>
                ${isAdmin ? `<td style="padding:12px"><button class="btn btn-ghost" style="font-size:11px;padding:4px 8px" onclick="editarPontosRanking(${r.id},'${r.nome}',${r.pontos},${r.vendas})">Editar</button></td>` : ''}
              </tr>
            `).join('') || '<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--z400)">Sem dados de ranking</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="flex:1">
      <div class="card-hdr"><div class="card-title">Grafico Comparativo</div></div>
      <div class="card-body" style="height:260px;position:relative">
        <canvas id="chartRanking"></canvas>
      </div>
      <div class="card-body" style="border-top:1px solid var(--z100)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--z600)">Sistema de Pontos por Serviço</div>
          ${isAdmin ? '<span style="font-size:10px;color:#2563eb;cursor:pointer" onclick="toggleEditarPontos(this)">✏️ Editar</span>' : ''}
        </div>
        <div id="tabelaPontosServico">
          ${Object.entries(PONTOS_SERVICO).map(([s,p]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:11px;color:var(--z600);border-bottom:1px solid #f3f4f6;gap:6px">
              <span class="nome-label" style="flex:1">${s}</span>
              <input type="text" value="${s.replace(/"/g,'&quot;')}" data-servico="${s.replace(/"/g,'&quot;')}" class="nome-input" style="display:none;flex:1;min-width:0;padding:3px 6px;border:1.5px solid #6366f1;border-radius:6px;font-size:11px">
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <input type="number" min="0" max="99" value="${p}" data-servico="${s.replace(/"/g,'&quot;')}" class="pts-input" style="display:none;width:50px;padding:3px 6px;border:1.5px solid #2563eb;border-radius:6px;font-size:11px;font-weight:700;text-align:center">
                <span class="pts-label" style="font-weight:700;color:#2563eb">${p} pts</span>
              </div>
            </div>
          `).join('')}
        </div>
        ${isAdmin ? '<button id="btnSalvarPontos" onclick="salvarTodosPontos()" style="display:none;margin-top:10px;width:100%;padding:8px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700">Salvar Pontos</button>' : ''}
      </div>
    </div>
  </div>
  `;

  document.getElementById('view-ranking').innerHTML = html;

  setTimeout(() => {
    if (window.Chart && ranking.length > 0 && document.getElementById('chartRanking')) {
      new Chart(document.getElementById('chartRanking'), {
        type: 'bar',
        data: {
          labels: ranking.map(r => r.nome),
          datasets: [{
            label: 'Pontos',
            data: ranking.map(r => r.pontos),
            backgroundColor: ['#fbbf24', '#9ca3af', '#f97316', '#93c5fd'],
            borderRadius: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  }, 50);
}

function editarPontosRanking(id, nome, pontosAtual, vendasAtual) {
  document.getElementById('_modalRanking')?.remove();
  const m = document.createElement('div');
  m.id = '_modalRanking';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:380px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="font-size:16px;font-weight:800;color:#1e293b;margin-bottom:6px">Editar Atendente</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:20px">Atualize nome, pontos e vendas</div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px">NOME</label>
          <input id="_rankNome" type="text" value="${nome}" style="width:100%;padding:10px 14px;border:1.5px solid #6366f1;border-radius:8px;font-size:15px;font-weight:700;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px">PONTOS</label>
          <input id="_rankPontos" type="number" min="0" step="0.5" value="${pontosAtual}" style="width:100%;padding:10px 14px;border:1.5px solid #2563eb;border-radius:8px;font-size:22px;font-weight:800;text-align:center;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px">VENDAS</label>
          <input id="_rankVendas" type="number" min="0" value="${vendasAtual}" style="width:100%;padding:10px 14px;border:1.5px solid #10b981;border-radius:8px;font-size:22px;font-weight:800;text-align:center;box-sizing:border-box">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:22px">
        <button onclick="document.getElementById('_modalRanking').remove()" style="flex:1;padding:11px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#64748b">Cancelar</button>
        <button id="_btnSalvarRanking" style="flex:2;padding:11px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-size:13px;font-weight:700">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });

  document.getElementById('_btnSalvarRanking').addEventListener('click', async () => {
    const pts = parseFloat(document.getElementById('_rankPontos').value);
    const vds = parseInt(document.getElementById('_rankVendas').value, 10);
    if (isNaN(pts)) { if (typeof toast === 'function') toast('Pontos inválidos', 'error'); return; }
    try {
      const novoNome = document.getElementById('_rankNome')?.value.trim() || nome;
      const res = await _api(`/api/ranking/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ nome: novoNome, pontos: pts, vendas: isNaN(vds) ? vendasAtual : vds })
      });
      const d = await res.json();
      if (d.ok) {
        m.remove();
        if (typeof toast === 'function') toast(`${nome} atualizado!`, 'success');
        renderRanking();
      } else {
        if (typeof toast === 'function') toast(d.error || 'Erro ao salvar', 'error');
      }
    } catch(e) {
      if (typeof toast === 'function') toast(e.message, 'error');
    }
  });

  setTimeout(() => document.getElementById('_rankPontos')?.select(), 100);
}

// Funcoes auxiliares (mantidas para compatibilidade)
function registrarPagamento(vendaId) {
  const data = prompt('Data do pagamento (YYYY-MM-DD):');
  if (data) {
    _api('/api/pagamentos', {
      method: 'POST',
      body: JSON.stringify({ venda_id: vendaId, data_pagamento: data, forma_pagamento: 'Confirmado' })
    }).then(r => r.json()).then(d => {
      if (d.ok) { toast('Pagamento registrado!', 'success'); renderSeConverteu(); }
      else toast(d.error || 'Erro', 'error');
    });
  }
}

function enviarVideo(vendaId) {
  const data = prompt('Data de entrega do video (YYYY-MM-DD):');
  if (data) {
    _api('/api/videos/enviar', {
      method: 'POST',
      body: JSON.stringify({ venda_id: vendaId, data_entrega: data, tipo: 'Padrao' })
    }).then(r => r.json()).then(d => {
      if (d.ok) { toast('Video agendado!', 'success'); renderSeConverteu(); }
      else toast(d.error || 'Erro', 'error');
    });
  }
}
