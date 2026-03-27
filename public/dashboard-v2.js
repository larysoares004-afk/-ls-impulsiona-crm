// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD v2 - JavaScript das novas funcionalidades
// ════════════════════════════════════════════════════════════════════════════════

// Renderizar Dashboard v2 com gráficos e KPIs
async function renderDashboardV2() {
  try {
    const res = await fetch('/api/dashboard/resumo', { headers: { 'Authorization': `Bearer ${currentUser.token || localStorage.getItem('token')}` } });
    const data = await res.json();
    if (!data || data.error) throw new Error(data.error || 'Erro ao carregar resumo');

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">📊 Dashboard</h1></div>
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
        <div class="scard-ico" style="background: #dcfce7; color: #16a34a;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="scard-val">R$ ${fmt(data.meta_mes.realizado)}</div>
        <div class="scard-lbl">Meta Mensal: ${data.meta_mes.pct}%</div>
        <div style="margin-top: 8px; width: 100%; height: 4px; background: #bbf7d0; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(data.meta_mes.pct, 100)}%; background: #16a34a;"></div>
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
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 14px;">Conversões (7 dias)</h3>
        <canvas id="chartConversoes" height="200"></canvas>
      </div>

      <div style="background: #fff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 16px;">
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 14px;">Top Atendentes</h3>
        <div id="rankingMini"></div>
      </div>
    </div>
    `;

    document.getElementById('view-dashboard-v2').innerHTML = html;

    // Carregar gráficos
    setTimeout(async () => {
      const convRes = await fetch('/api/dashboard/grafico-conversoes', { headers: { 'Authorization': `Bearer ${currentUser.token}` } });
      const conv = await convRes.json();

      if (window.Chart) {
        new Chart(document.getElementById('chartConversoes'), {
          type: 'line',
          data: {
            labels: conv.map(c => new Date(c.data).toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' })),
            datasets: [
              {
                label: 'Vendas',
                data: conv.map(c => c.vendas),
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                tension: 0.4
              },
              {
                label: 'Leads',
                data: conv.map(c => c.leads),
                borderColor: '#0284c7',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                tension: 0.4
              }
            ]
          },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: true, position: 'top' } } }
        });
      }

      // Ranking mini
      const rankRes = await fetch('/api/dashboard/ranking-atendentes?periodo=mes', { headers: { 'Authorization': `Bearer ${currentUser.token}` } });
      const ranking = await rankRes.json();

      document.getElementById('rankingMini').innerHTML = ranking.slice(0, 5).map((r, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f4f4f5;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${['#fbbf24', '#d1d5db', '#f97316', '#93c5fd', '#c4b5fd'][idx] || '#e5e7eb'}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">${idx+1}º</div>
            <div style="font-size: 12px; font-weight: 600;">${r.nome}</div>
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #16a34a;">${r.pontos} pts</div>
        </div>
      `).join('');
    }, 100);
  } catch(e) {
    console.error('Erro ao renderizar dashboard v2:', e);
    toast(e.message, 'error');
  }
}

// Renderizar aba "Que chegou" (Leads com filtros)
async function renderQueChegou() {
  try {
    const res = await fetch('/api/leads', { headers: { 'Authorization': `Bearer ${currentUser.token}` } });
    const leads = await res.json();

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">📞 Que chegou</h1></div>
      <div style="display: flex; gap: 8px;">
        <select id="filtroStatus" onchange="renderQueChegou()" class="inp" style="max-width: 150px;">
          <option value="">Todos</option>
          <option value="LEAD">Lead</option>
          <option value="AGENDADO">Agendado</option>
          <option value="CONVERTEU">Convertido</option>
        </select>
      </div>
    </div>

    <div style="background: #fff; border-radius: 14px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Nome</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Telefone</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Valor</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Status</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Data</th>
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
        <tr style="border-top: 1px solid #f3f4f6; cursor: pointer;" onclick="alert('Detalhes do lead: ' + '${l.nome}')">
          <td style="padding: 12px; font-size: 13px;">${l.nome}</td>
          <td style="padding: 12px; font-size: 13px;">${fmtPhone(l.telefone)}</td>
          <td style="padding: 12px; font-size: 13px;">R$ ${fmt(l.valor)}</td>
          <td style="padding: 12px; font-size: 13px;">
            <span style="padding: 3px 8px; border-radius: 6px; background: ${l.status === 'CONVERTEU' ? '#dcfce7' : l.status === 'AGENDADO' ? '#fef3c7' : '#f3f4f6'}; color: ${l.status === 'CONVERTEU' ? '#16a34a' : l.status === 'AGENDADO' ? '#f59e0b' : '#6b7280'}; font-size: 11px; font-weight: 600;">${l.status}</span>
          </td>
          <td style="padding: 12px; font-size: 13px; color: #9ca3af;">${fmtDate(l.criado_em)}</td>
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
    const res = await fetch('/api/vendas', { headers: { 'Authorization': `Bearer ${currentUser.token}` } });
    const vendas = await res.json();

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">✅ Se converteu</h1></div>
      <button class="btn btn-primary" onclick="abrirModalPagamento()">💳 Registrar Pagamento</button>
    </div>

    <div style="background: #fff; border-radius: 14px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Cliente</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Valor</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Pagamento</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Data</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Ações</th>
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
          <td style="padding: 12px; font-size: 13px;">${v.cliente_nome}</td>
          <td style="padding: 12px; font-size: 13px; font-weight: 600; color: #16a34a;">R$ ${fmt(v.valor)}</td>
          <td style="padding: 12px; font-size: 13px;">${v.pagamento}</td>
          <td style="padding: 12px; font-size: 13px; color: #9ca3af;">${fmtDate(v.criado_em)}</td>
          <td style="padding: 12px; font-size: 12px;">
            <button class="btn btn-ghost" onclick="registrarPagamento(${v.id})">Pagar</button>
            <button class="btn btn-ghost" onclick="enviarVideo(${v.id})">Vídeo</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">Nenhuma venda</td></tr>';
    }, 10);
  } catch(e) {
    console.error('Erro:', e);
    toast(e.message, 'error');
  }
}

// Renderizar aba "Vídeos"
async function renderVideos() {
  const html = `
    <div class="ph">
      <div><h1 class="ptitle">🎥 Vídeos</h1></div>
      <button class="btn btn-primary" onclick="abrirModalVideo()">📅 Agendar Entrega</button>
    </div>

    <div id="calendarVideos" style="background: #fff; border-radius: 14px; padding: 16px;">
      <div style="text-align: center; color: #9ca3af;">Calendário de vídeos em desenvolvimento...</div>
    </div>
  `;

  document.getElementById('view-videos').innerHTML = html;
}

// Renderizar aba "Indicações"
async function renderIndicacoes() {
  try {
    const res = await fetch('/api/indicacoes', { headers: { 'Authorization': `Bearer ${currentUser.token}` } });
    const indicacoes = await res.json();

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">👥 Indicações</h1></div>
      <button class="btn btn-primary" onclick="abrirModalIndicacao()">➕ Nova Indicação</button>
    </div>

    <div style="background: #fff; border-radius: 14px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #f9fafb;">
          <tr>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Quem Indicou</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Novo Cliente</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Telefone</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Status</th>
            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Data</th>
          </tr>
        </thead>
        <tbody id="tabelaIndicacoes"></tbody>
      </table>
    </div>
    `;

    document.getElementById('view-indicacoes').innerHTML = html;

    setTimeout(() => {
      document.getElementById('tabelaIndicacoes').innerHTML = indicacoes.map(i => `
        <tr style="border-top: 1px solid #f3f4f6;">
          <td style="padding: 12px; font-size: 13px;">Cliente ID: ${i.venda_id_indicador}</td>
          <td style="padding: 12px; font-size: 13px;">${i.novo_cliente_nome}</td>
          <td style="padding: 12px; font-size: 13px;">${fmtPhone(i.novo_cliente_tel)}</td>
          <td style="padding: 12px; font-size: 13px;">
            <span style="padding: 3px 8px; border-radius: 6px; background: #f3f4f6; color: #6b7280; font-size: 11px; font-weight: 600;">${i.status}</span>
          </td>
          <td style="padding: 12px; font-size: 13px; color: #9ca3af;">${fmtDate(i.criado_em)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">Nenhuma indicação</td></tr>';
    }, 10);
  } catch(e) {
    console.error('Erro:', e);
    toast(e.message, 'error');
  }
}

// Renderizar aba "Ranking"
async function renderRanking() {
  try {
    const periodo = document.getElementById('filtroRanking')?.value || 'mes';
    const res = await fetch(`/api/dashboard/ranking-atendentes?periodo=${periodo}`, { headers: { 'Authorization': `Bearer ${currentUser.token}` } });
    const ranking = await res.json();

    const html = `
    <div class="ph">
      <div><h1 class="ptitle">🏆 Ranking</h1></div>
      <select id="filtroRanking" onchange="renderRanking()" class="inp" style="max-width: 150px;">
        <option value="dia">Hoje</option>
        <option value="semana">Semana</option>
        <option value="mes" selected>Mês</option>
        <option value="tudo">Tudo</option>
      </select>
    </div>

    <div class="g2" style="margin-bottom: 24px;">
      <div style="background: #fff; border-radius: 14px; border: 1px solid #e4e4e7; padding: 16px;">
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 14px;">Top Atendentes</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: #f9fafb;">
            <tr>
              <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Posição</th>
              <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Nome</th>
              <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Pontos</th>
              <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #6b7280;">Valor Total</th>
            </tr>
          </thead>
          <tbody id="tabelaRanking"></tbody>
        </table>
      </div>

      <div style="background: #fff; border-radius: 14px; border: 1px solid #e4e4e7; padding: 16px;">
        <h3 style="font-weight: 700; margin-bottom: 16px; font-size: 14px;">Gráfico Comparativo</h3>
        <canvas id="chartRanking" height="200"></canvas>
      </div>
    </div>
    `;

    document.getElementById('view-ranking').innerHTML = html;

    setTimeout(() => {
      document.getElementById('tabelaRanking').innerHTML = ranking.map((r, idx) => `
        <tr style="border-top: 1px solid #f3f4f6;">
          <td style="padding: 12px; font-size: 13px;">
            <span style="padding: 4px 10px; border-radius: 6px; background: ${['#fbbf24', '#d1d5db', '#f97316', '#93c5fd', '#c4b5fd'][idx] || '#e5e7eb'}; color: #fff; font-weight: 700; font-size: 11px;">${idx+1}º</span>
          </td>
          <td style="padding: 12px; font-size: 13px; font-weight: 600;">${r.nome}</td>
          <td style="padding: 12px; font-size: 13px; font-weight: 700; color: #16a34a;">${r.pontos} pts</td>
          <td style="padding: 12px; font-size: 13px; color: #0284c7;">R$ ${fmt(r.valor_total)}</td>
        </tr>
      `).join('');

      if (window.Chart && ranking.length > 0) {
        new Chart(document.getElementById('chartRanking'), {
          type: 'bar',
          data: {
            labels: ranking.slice(0, 10).map(r => r.nome.split(' ')[0]),
            datasets: [{
              label: 'Pontos',
              data: ranking.slice(0, 10).map(r => r.pontos),
              backgroundColor: '#16a34a'
            }]
          },
          options: { responsive: true, maintainAspectRatio: true, indexAxis: 'y', plugins: { legend: { display: false } } }
        });
      }
    }, 10);
  } catch(e) {
    console.error('Erro:', e);
    toast(e.message, 'error');
  }
}

// Funções auxiliares
function registrarPagamento(vendaId) {
  const data = prompt('Data do pagamento (YYYY-MM-DD):');
  if (data) {
    fetch('/api/pagamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.token}` },
      body: JSON.stringify({ venda_id: vendaId, data_pagamento: data, forma_pagamento: 'Confirmado' })
    }).then(r => r.json()).then(d => {
      if (d.ok) { toast('Pagamento registrado!', 'success'); renderSeConverteu(); }
      else toast(d.error || 'Erro', 'error');
    });
  }
}

function enviarVideo(vendaId) {
  const data = prompt('Data de entrega do vídeo (YYYY-MM-DD):');
  if (data) {
    fetch('/api/videos/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.token}` },
      body: JSON.stringify({ venda_id: vendaId, data_entrega: data, tipo: 'Padrão' })
    }).then(r => r.json()).then(d => {
      if (d.ok) { toast('Vídeo agendado!', 'success'); renderSeConverteu(); }
      else toast(d.error || 'Erro', 'error');
    });
  }
}

function abrirModalPagamento() {
  toast('Funcionalidade em desenvolvimento', 'info');
}

function abrirModalVideo() {
  toast('Funcionalidade em desenvolvimento', 'info');
}

function abrirModalIndicacao() {
  toast('Funcionalidade em desenvolvimento', 'info');
}
