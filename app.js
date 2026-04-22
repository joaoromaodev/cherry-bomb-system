// ================================================================
//  🌸 Cherry Bomb — app.js
//  Lógica principal do sistema
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CONFIG } from './config.js'

// ── Configuração do Supabase ──────────────────────────────────────
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)
const S = CONFIG.SCHEMA || 'cherry_bomb'

// ── Utilitários ───────────────────────────────────────────────────
function brl(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function fmtData(d) {
  if (!d) return '—'
  const data = new Date(d);
  if (isNaN(data.getTime())) return '—'; 
  return data.toLocaleDateString('pt-BR');
}

function calcPreco(qtd) {
  if (qtd < 10) return null   
  if (qtd < 20) return 8      
  if (qtd < 50) return 6      
  return 5                    
}

function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.className = `toast show${tipo === 'error' ? ' toast-error' : ''}`
  setTimeout(() => (el.className = 'toast'), 3500)
}

// ── Badges de status ──────────────────────────────────────────────
function badgePedido(status) {
  const mapa = {
    'Aguardando confirmação': 'badge-warn',
    'Em produção':            'badge-purple',
    'Pronto para envio':      'badge-teal',
    'Enviado':                'badge-orange',
    'Entregue':               'badge-green',
    'Cancelado':              'badge-red',
  }
  return `<span class="badge ${mapa[status] || 'badge-gray'}">${status || '—'}</span>`
}

function badgePagto(status) {
  const mapa = {
    'Pendente':      'badge-gray',
    'Pago parcial':  'badge-blue',
    'Pago integral': 'badge-green',
    'Reembolsado':   'badge-red',
  }
  return `<span class="badge ${mapa[status] || 'badge-gray'}">${status || '—'}</span>`
}

// ── Navegação ─────────────────────────────────────────────────────
function navigate(pagina) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pagina)
  })
  document.querySelectorAll('.bottom-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pagina)
  })
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${pagina}`)
  })
  if (pagina === 'dashboard') loadDashboard()
  if (pagina === 'pedidos')   loadPedidos()
  if (pagina === 'clientes')  loadClientes()
  if (pagina === 'compras')   loadCompras()
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.disabled) navigate(btn.dataset.page)
  })
})

// ── Dashboard ─────────────────────────────────────────────────────
async function loadDashboard() {
  const periodo = document.getElementById('filtro-periodo')?.value || 'tudo'

  const agora  = new Date()
  let dataCorte = null

  if (periodo === 'mes') {
    dataCorte = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
  } else if (periodo === 'trimestre') {
    dataCorte = new Date(agora.getFullYear(), agora.getMonth() - 2, 1).toISOString()
  }

  let qPedidos = sb.schema(S).from('pedidos').select('*')
  let qCompras = sb.schema(S).from('compras').select('*')

  if (dataCorte) {
    qPedidos = qPedidos.gte('created_at', dataCorte)
    qCompras = qCompras.gte('created_at', dataCorte)
  }

  const [resPedidos, resCompras] = await Promise.all([qPedidos, qCompras])

  if (resPedidos.error) { toast('Erro ao carregar pedidos: ' + resPedidos.error.message, 'error'); return }
  if (resCompras.error) { toast('Erro ao carregar compras: ' + resCompras.error.message, 'error'); return }

  const pedidos = resPedidos.data || []
  const compras = resCompras.data || []

  const total       = pedidos.length
  const faturamento = pedidos.reduce((s, p) => s + (p.total_final || 0), 0)
  const emProd      = pedidos.filter(p => p.status_pedido?.toLowerCase().includes('produção')).length
  const pendentes   = pedidos.filter(p => p.status_pagamento === 'Pendente').length
  const entregues   = pedidos.filter(p => p.status_pedido === 'Entregue').length

  // Receita REAL: soma dos valores já adiantados + pedidos pagos integralmente
  const receitaRecebida = pedidos.reduce((s, p) => {
    if (p.status_pagamento === 'Reembolsado')    return s
    if (p.status_pagamento === 'Pago integral')  return s + (p.total_final || 0)
    return s + (parseFloat(p.valor_adiantado) || 0)
  }, 0)

  // Expectativa: total − o que já foi pago
  const valorAReceber = pedidos.reduce((s, p) => {
    if (p.status_pagamento === 'Pago integral') return s
    if (p.status_pagamento === 'Reembolsado')   return s
    const adiantado = parseFloat(p.valor_adiantado) || 0
    return s + (p.total_final || 0) - adiantado
  }, 0)

  // Pedidos com sinal: têm valor_adiantado > 0 mas ainda não pagaram tudo
  const comSinal = pedidos.filter(p =>
    (parseFloat(p.valor_adiantado) || 0) > 0 &&
    p.status_pagamento !== 'Pago integral' &&
    p.status_pagamento !== 'Reembolsado'
  ).length

  const custos       = compras.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
  const lucro        = faturamento - custos
  const saldoEmCaixa = receitaRecebida - custos

  // Totais monetários por grupo
  const totalVal     = 0 // removido — duplica o Faturamento Bruto
  const prodVal      = pedidos.filter(p => p.status_pedido?.toLowerCase().includes('produção'))
                               .reduce((s, p) => s + (p.total_final || 0), 0)
  const entreguesVal = pedidos.filter(p => p.status_pedido === 'Entregue')
                               .reduce((s, p) => s + (p.total_final || 0), 0)
  const pendVal      = pedidos.filter(p => p.status_pagamento === 'Pendente')
                               .reduce((s, p) => s + (p.total_final || 0), 0)
  const sinalVal     = pedidos.filter(p =>
                         (parseFloat(p.valor_adiantado) || 0) > 0 &&
                         p.status_pagamento !== 'Pago integral' &&
                         p.status_pagamento !== 'Reembolsado'
                       ).reduce((s, p) => s + (parseFloat(p.valor_adiantado) || 0), 0)

  document.getElementById('stat-total').textContent         = total
  // stat-total-val removido
  document.getElementById('stat-fat').textContent           = brl(faturamento)
  document.getElementById('stat-prod').textContent          = emProd
  document.getElementById('stat-prod-val').textContent      = brl(prodVal)
  document.getElementById('stat-pend').textContent          = pendentes
  document.getElementById('stat-pend-val').textContent      = brl(pendVal)
  document.getElementById('stat-sinal').textContent         = comSinal
  document.getElementById('stat-sinal-val').textContent     = brl(sinalVal)
  document.getElementById('stat-entregues').textContent     = entregues
  document.getElementById('stat-entregues-val').textContent = brl(entreguesVal)
  document.getElementById('stat-receber').textContent       = brl(valorAReceber)
  document.getElementById('stat-custos').textContent        = brl(custos)
  document.getElementById('stat-lucro').textContent         = brl(lucro)
  document.getElementById('stat-caixa').textContent         = brl(saldoEmCaixa)

  // tabela de recentes removida no redesign — bloco limpo
}

// ── Pedidos — listagem ────────────────────────────────────────────
let pedidosCarregados = []; 

async function loadPedidos(filtroStatus = '') {
  let query = sb.schema(S).from('pedidos')
    .select('*, itens_pedido(*)')
    .order('created_at', { ascending: false })

  if (filtroStatus) query = query.eq('status_pedido', filtroStatus)
  
  const { data, error } = await query
  if (error) { toast('Erro ao carregar pedidos: ' + error.message, 'error'); return }
  
  pedidosCarregados = data; 

 // busca adiantamentos via RPC (contorna cache do PostgREST)
  const { data: adiantamentos } = await sb.schema(S).rpc('get_adiantamentos')

  if (adiantamentos) {
    const mapaAdiantados = {}
    adiantamentos.forEach(a => { mapaAdiantados[a.pedido_id] = a.valor_adiantado })
    data.forEach(p => { p.valor_adiantado = mapaAdiantados[p.id] || 0 })
  }

  pedidosCarregados = data

  renderPedidos(data)
}

function renderPedidos(lista) {
  document.getElementById('pedidos-tbody').innerHTML =
    lista.length
      ? lista.map(p => {
          const varStr = (p.itens_pedido || [])
            .map(i => `${i.quantidade} ${i.variacao}`).join(', ')
          return `
            <tr>
              <td><span class="code">${p.codigo || '—'}</span></td>
              <td class="td-secondary">${fmtData(p.data_pedido)}</td>
              <td class="td-cliente">${p.cliente_nome || '—'}</td>
              <td class="td-secondary">${p.produto || '—'}</td>
              <td class="vars">${varStr || '—'}</td>
              <td class="td-secondary"><strong>${p.qtd_total || 0}</strong> un</td>
              <td class="td-secondary">${p.preco_unitario ? brl(p.preco_unitario) + '/un' : '—'}</td>
              <td class="td-total">${brl(p.total_final)}</td>
              <td>${badgePedido(p.status_pedido)}</td>
              <td>${badgePagto(p.status_pagamento)}</td>
              <td>
                <div class="dropdown" id="dd-ped-${p.id}">
                  <button class="btn-icon dropdown-trigger" onclick="toggleDropdown('dd-ped-${p.id}')">⋮</button>
                  <div class="dropdown-content">
                    <button class="dropdown-item" onclick="abrirDetalhesPedido('${p.id}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Ver detalhes
                    </button>
                    <button class="dropdown-item" onclick="abrirModalEditarPedido('${p.id}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Editar
                    </button>
                    <button class="dropdown-item dropdown-item-danger" onclick="abrirModalExcluirPedido('${p.id}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      Excluir
                    </button>
                  </div>
                </div>
              </td>
            </tr>`
        }).join('')
      : '<tr><td colspan="11" class="empty">Nenhum pedido encontrado</td></tr>'
}

function filtrarPedidos() {
  const busca  = (document.getElementById('busca-pedido')?.value || '').toLowerCase().trim()
  const status = document.getElementById('filtro-status')?.value || ''

  const resultado = pedidosCarregados.filter(p => {
    const matchBusca = !busca ||
      (p.cliente_nome || '').toLowerCase().includes(busca) ||
      (p.codigo       || '').toLowerCase().includes(busca) ||
      (p.produto      || '').toLowerCase().includes(busca)

    const matchStatus = !status || p.status_pedido === status

    return matchBusca && matchStatus
  })

  renderPedidos(resultado)
}

// ── Pedido — atualizar status (edição rápida) ─────────────────────
function abrirDetalhesPedido(id) {
  const p = pedidosCarregados.find(x => x.id === id);
  if(!p) return;

  document.getElementById('det-id').value = p.id;
  document.getElementById('det-codigo').textContent = p.codigo || '—';
  document.getElementById('det-cliente').textContent = p.cliente_nome || '—';
  document.getElementById('det-produto').textContent = p.produto || '—';
  document.getElementById('det-obs').textContent = p.observacao || 'Nenhuma observação.'

  const adiantado = parseFloat(p.valor_adiantado) || 0
  const restante  = (p.total_final || 0) - adiantado
  const detFinEl  = document.getElementById('det-financeiro')
  if (detFinEl) {
    detFinEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
        <span style="color:var(--muted); font-weight:600;">Total do pedido</span>
        <strong>${brl(p.total_final)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
        <span style="color:var(--muted); font-weight:600;">Já pago</span>
        <strong style="color:#16a34a;">${brl(adiantado)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; border-top:1px solid var(--border); padding-top:6px; margin-top:4px;">
        <span style="color:var(--muted); font-weight:600;">Ainda a receber</span>
        <strong style="color:var(--cherry-dark);">${brl(restante)}</strong>
      </div>`
  }

  const varStr = (p.itens_pedido || [])
    .map(i => `<strong>${i.quantidade} un</strong> — ${i.variacao}`)
    .join('<br>');
  document.getElementById('det-variacoes').innerHTML = varStr || 'Sem variações registradas.';

  document.getElementById('det-status-pedido').value = p.status_pedido;
  document.getElementById('det-status-pagamento').value = p.status_pagamento;

  document.getElementById('modal-detalhes').classList.add('open');
}

async function salvarAdiantadoDetalhes() {
  const id    = document.getElementById('det-id').value
  const valor = parseFloat(document.getElementById('det-adiantado-input').value) || 0

  const { error } = await sb.rpc('atualizar_adiantado', { p_id: id, p_valor: valor })
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  toast('Adiantamento atualizado!')
  fecharModal('modal-detalhes')
  loadPedidos()
  loadDashboard()
}

async function salvarNovoStatus(e) {
  e.preventDefault();
  
  const id = document.getElementById('det-id').value;
  const status_pedido = document.getElementById('det-status-pedido').value;
  const status_pagamento = document.getElementById('det-status-pagamento').value;

  const { error } = await sb.schema(S).from('pedidos').update({
    status_pedido: status_pedido,
    status_pagamento: status_pagamento
  }).eq('id', id);

  if (error) { toast('Erro ao atualizar: ' + error.message, 'error'); return; }

  toast('Status atualizado com sucesso!');
  fecharModal('modal-detalhes');
  loadPedidos(); 
  loadDashboard(); 
}

// ── Modal Novo Pedido ─────────────────────────────────────────────
async function abrirModalPedido() {
  const { data: clientes } = await sb.schema(S).from('clientes').select('id, nome').order('nome')

  const sel = document.getElementById('pedido-cliente')
  sel.innerHTML =
    '<option value="">Selecione o cliente...</option>' +
    (clientes || []).map(c =>
      `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`
    ).join('')

  document.getElementById('form-pedido').reset()
  document.getElementById('pedido-id').value = ''
  document.querySelector('#modal-pedido .modal-header h2').textContent = 'Novo pedido'
  document.getElementById('variacao-list').innerHTML = ''

  addVariacao()
  addVariacao()
  recalcPedido()

  document.getElementById('modal-pedido').classList.add('open')
}

async function abrirModalEditarPedido(id) {
  const p = pedidosCarregados.find(x => x.id === id)
  if (!p) { toast('Pedido não encontrado', 'error'); return }

  const { data: clientes } = await sb.schema(S).from('clientes').select('id, nome').order('nome')
  const sel = document.getElementById('pedido-cliente')
  sel.innerHTML =
    '<option value="">Selecione o cliente...</option>' +
    (clientes || []).map(c =>
      `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`
    ).join('')

  document.getElementById('pedido-id').value         = p.id
  sel.value                                           = p.cliente_id || ''
  document.getElementById('pedido-produto').value     = p.produto || ''
  document.getElementById('pedido-desconto').value    = p.desconto_acrescimo || ''
  document.getElementById('pedido-frete').value       = p.frete || ''
  document.getElementById('pedido-status').value      = p.status_pedido || 'Aguardando confirmação'
  document.getElementById('pedido-status-pgto').value = p.status_pagamento || 'Pendente'
  document.getElementById('pedido-obs').value         = p.observacao || ''
  document.getElementById('pedido-adiantado').value   = p.valor_adiantado || ''

  const list = document.getElementById('variacao-list')
  list.innerHTML = ''
  const itens = p.itens_pedido || []
  if (itens.length > 0) {
    itens.forEach(item => {
      const div = document.createElement('div')
      div.className = 'var-row'
      div.innerHTML = `
        <input type="text" placeholder="Variação" class="var-nome"
          value="${item.variacao || ''}" oninput="recalcPedido()">
        <input type="number" placeholder="Qtd" min="0" step="1" class="var-qtd"
          value="${item.quantidade || 0}" oninput="recalcPedido()">
        <button type="button" class="btn-rm-var"
          onclick="this.parentElement.remove(); recalcPedido()">×</button>
      `
      list.appendChild(div)
    })
  } else {
    addVariacao()
  }

  recalcPedido()
  document.querySelector('#modal-pedido .modal-header h2').textContent = `Editar Pedido ${p.codigo || ''}`
  document.getElementById('modal-pedido').classList.add('open')
}

function addVariacao() {
  const list = document.getElementById('variacao-list')
  const n    = list.children.length + 1
  const div  = document.createElement('div')
  div.className = 'var-row'
  div.innerHTML = `
    <input type="text"   placeholder="Variação ${n} (ex: Vermelha)"
      class="var-nome" oninput="recalcPedido()">
    <input type="number" placeholder="Qtd" min="0" step="1"
      class="var-qtd" oninput="recalcPedido()">
    <button type="button" class="btn-rm-var"
      onclick="this.parentElement.remove(); recalcPedido()">×</button>
  `
  list.appendChild(div)
}

function recalcPedido() {
  const qtds     = Array.from(document.querySelectorAll('.var-qtd')).map(i => parseInt(i.value) || 0)
  const qtdTotal = qtds.reduce((a, b) => a + b, 0)
  const preco    = calcPreco(qtdTotal)
  const desconto = parseFloat(document.getElementById('pedido-desconto')?.value) || 0
  const frete    = parseFloat(document.getElementById('pedido-frete')?.value)    || 0
  const subtotal = preco ? qtdTotal * preco : 0
  const total    = subtotal + desconto + frete

  document.getElementById('calc-qtd').textContent =
    qtdTotal > 0 ? `${qtdTotal} un` : '—'

  document.getElementById('calc-preco').textContent =
    qtdTotal === 0 ? '—'
    : !preco       ? '⚠ mínimo: 10 un'
    :                `${brl(preco)}/un`

  document.getElementById('calc-subtotal').textContent = subtotal > 0 ? brl(subtotal) : '—'
  document.getElementById('calc-total').textContent    = subtotal > 0 ? brl(total)    : '—'
}

async function salvarPedido(e) {
  e.preventDefault()

  const editId      = document.getElementById('pedido-id').value
  const sel         = document.getElementById('pedido-cliente')
  const clienteId   = sel.value
  const clienteNome = sel.selectedOptions[0]?.dataset.nome || ''

  const variacoes = Array.from(document.querySelectorAll('.var-row'))
    .map(row => ({
      variacao:   row.querySelector('.var-nome').value.trim(),
      quantidade: parseInt(row.querySelector('.var-qtd').value) || 0,
    }))
    .filter(v => v.variacao && v.quantidade > 0)

  const qtdTotal = variacoes.reduce((s, v) => s + v.quantidade, 0)
  const preco    = calcPreco(qtdTotal)

  if (!clienteId)       { toast('Selecione um cliente', 'error'); return }
  if (!variacoes.length) { toast('Adicione pelo menos uma variação com quantidade', 'error'); return }
  if (qtdTotal < 10)    { toast('Pedido mínimo: 10 unidades', 'error'); return }

  const desconto = parseFloat(document.getElementById('pedido-desconto').value) || 0
  const frete    = parseFloat(document.getElementById('pedido-frete').value)    || 0
  const subtotal = preco * qtdTotal
  const total    = subtotal + desconto + frete

  const pedidoPayload = {
    cliente_id:          clienteId,
    cliente_nome:        clienteNome,
    produto:             document.getElementById('pedido-produto').value.trim(),
    qtd_total:           qtdTotal,
    preco_unitario:      preco,
    subtotal:            subtotal,
    desconto_acrescimo:  desconto,
    frete:               frete,
    total_final:         total,
    valor_adiantado:     parseFloat(document.getElementById('pedido-adiantado').value) || 0,
    status_pedido:       document.getElementById('pedido-status').value,
    status_pagamento:    document.getElementById('pedido-status-pgto').value,
    observacao:          document.getElementById('pedido-obs').value.trim(),
  }

  // remove do payload principal para evitar erro de cache do PostgREST
  const valorAdiantado = pedidoPayload.valor_adiantado || 0
  delete pedidoPayload.valor_adiantado

  if (editId) {
    // ── UPDATE ──────────────────────────────────────────────────
    const { error } = await sb.schema(S).from('pedidos').update(pedidoPayload).eq('id', editId)
    if (error) { toast('Erro ao atualizar: ' + error.message, 'error'); return }

    // salva adiantado via rpc, ignorando o cache
    await sb.schema(S).rpc('atualizar_adiantado', { p_id: editId, p_valor: valorAdiantado })

    await sb.schema(S).from('itens_pedido').delete().eq('pedido_id', editId)
    if (variacoes.length) {
      const itens = variacoes.map(v => ({ ...v, pedido_id: editId }))
      await sb.schema(S).from('itens_pedido').insert(itens)
    }
    toast('Pedido atualizado com sucesso!')

  } else {
    // ── INSERT ──────────────────────────────────────────────────
    pedidoPayload.data_pedido = new Date().toISOString().split('T')[0]

    const { data: pedido, error } = await sb.schema(S).from('pedidos').insert(pedidoPayload).select().single()
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

    // salva adiantado via rpc, ignorando o cache
    await sb.schema(S).rpc('atualizar_adiantado', { p_id: pedido.id, p_valor: valorAdiantado })

    if (variacoes.length) {
      const itens = variacoes.map(v => ({ ...v, pedido_id: pedido.id }))
      await sb.schema(S).from('itens_pedido').insert(itens)
    }
    toast(`Pedido ${pedido.codigo} criado!`)
  }

  fecharModal('modal-pedido')
  loadPedidos()
  loadDashboard()
}

// ── Pedido — exclusão ─────────────────────────────────────────────
function abrirModalExcluirPedido(id) {
  const p = pedidosCarregados.find(x => x.id === id)
  if (!p) return

  document.getElementById('exc-ped-id').value          = id
  document.getElementById('exc-ped-codigo').textContent = p.codigo || '—'
  document.getElementById('exc-ped-cliente').textContent= p.cliente_nome || '—'
  document.getElementById('modal-excluir-pedido').classList.add('open')
}

async function confirmarExclusaoPedido() {
  const id = document.getElementById('exc-ped-id').value
  if (!id) return

  const { error } = await sb.schema(S).from('pedidos').delete().eq('id', id)
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return }

  toast('Pedido excluído!')
  fecharModal('modal-excluir-pedido')
  loadPedidos()
  loadDashboard()
}

// ── Clientes ──────────────────────────────────────────────────────
let clientesCarregados = []

async function loadClientes() {
  const { data, error } = await sb.schema(S).from('clientes').select('*').order('nome')
  if (error) { toast('Erro ao carregar clientes: ' + error.message, 'error'); return }

  clientesCarregados = data

  document.getElementById('clientes-tbody').innerHTML =
    data.length
      ? data.map(c => `
          <tr>
            <td><span class="code">${c.codigo || '—'}</span></td>
            <td><strong>${c.nome}</strong></td>
            <td>${c.contato || '—'}</td>
            <td>${c.cep    || '—'}</td>
            <td>${c.cidade || '—'}</td>
            <td>${fmtData(c.created_at)}</td>
            <td>
              <div class="dropdown" id="dd-cli-${c.id}">
                <button class="btn-icon dropdown-trigger" onclick="toggleDropdown('dd-cli-${c.id}')">⋮</button>
                <div class="dropdown-content">
                  <button class="dropdown-item" onclick="abrirModalEditarCliente('${c.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                  <button class="dropdown-item dropdown-item-danger" onclick="abrirModalExcluirCliente('${c.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    Excluir
                  </button>
                </div>
              </div>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="7" class="empty">Nenhum cliente cadastrado ainda</td></tr>'
}

function abrirModalCliente() {
  document.getElementById('form-cliente').reset()
  document.getElementById('cli-id').value = ''
  document.getElementById('modal-cliente-titulo').textContent = 'Novo cliente'
  document.getElementById('modal-cliente').classList.add('open')
}

function abrirModalEditarCliente(id) {
  const c = clientesCarregados.find(x => x.id === id)
  if (!c) { toast('Cliente não encontrado', 'error'); return }

  document.getElementById('cli-id').value      = c.id
  document.getElementById('cli-nome').value    = c.nome    || ''
  document.getElementById('cli-contato').value = c.contato || ''
  document.getElementById('cli-cep').value     = c.cep     || ''
  document.getElementById('cli-cidade').value  = c.cidade  || ''
  document.getElementById('cli-obs').value     = c.observacao || ''

  document.getElementById('modal-cliente-titulo').textContent = `Editar: ${c.nome}`
  document.getElementById('modal-cliente').classList.add('open')
}

function abrirModalExcluirCliente(id) {
  const c = clientesCarregados.find(x => x.id === id)
  if (!c) return

  document.getElementById('exc-cli-id').value          = id
  document.getElementById('exc-cli-nome').textContent  = c.nome || '—'
  document.getElementById('modal-excluir-cliente').classList.add('open')
}

async function confirmarExclusaoCliente() {
  const id = document.getElementById('exc-cli-id').value
  if (!id) return

  // Verifica se o cliente tem pedidos vinculados
  const { data: pedidosVinculados, error: errCheck } = await sb.schema(S)
    .from('pedidos').select('id').eq('cliente_id', id).limit(1)

  if (errCheck) { toast('Erro ao verificar pedidos: ' + errCheck.message, 'error'); return }

  if (pedidosVinculados && pedidosVinculados.length > 0) {
    toast('Este cliente possui pedidos vinculados e não pode ser excluído.', 'error')
    fecharModal('modal-excluir-cliente')
    return
  }

  const { error } = await sb.schema(S).from('clientes').delete().eq('id', id)
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return }

  toast('Cliente excluído com sucesso!')
  fecharModal('modal-excluir-cliente')
  loadClientes()
}

async function salvarCliente(e) {
  e.preventDefault()

  const editId = document.getElementById('cli-id').value

  const payload = {
    nome:       document.getElementById('cli-nome').value.trim(),
    contato:    document.getElementById('cli-contato').value.trim(),
    cep:        document.getElementById('cli-cep').value.trim(),
    cidade:     document.getElementById('cli-cidade').value.trim(),
    observacao: document.getElementById('cli-obs').value.trim(),
  }

  if (!payload.nome) { toast('Nome é obrigatório', 'error'); return }

  if (editId) {
    // ── UPDATE ──────────────────────────────────────────────────
    const { error } = await sb.schema(S).from('clientes').update(payload).eq('id', editId)
    if (error) { toast('Erro ao atualizar: ' + error.message, 'error'); return }
    toast('Cliente atualizado com sucesso!')
  } else {
    // ── INSERT ──────────────────────────────────────────────────
    const { error } = await sb.schema(S).from('clientes').insert(payload)
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }
    toast('Cliente cadastrado!')
  }

  fecharModal('modal-cliente')
  loadClientes()
}

// ── Compras / Custos ──────────────────────────────────────────────
let comprasCarregadas = [];

async function loadCompras() {
  const { data, error } = await sb.schema(S).from('compras').select('*').order('data_compra', { ascending: false })
  if (error) { toast('Erro ao carregar compras: ' + error.message, 'error'); return }

  comprasCarregadas = data;

  document.getElementById('compras-tbody').innerHTML =
    data.length
      ? data.map(c => `
          <tr>
            <td>${fmtData(c.data_compra)}</td>
            <td><strong>${c.descricao}</strong></td>
            <td><span class="badge badge-gray">${c.categoria || 'Outros'}</span></td>
            <td><strong style="color: var(--pink-dark);">${brl(c.valor)}</strong></td>
            <td>${c.observacao || '—'}</td>
            <td>
              <div class="dropdown" id="dd-comp-${c.id}">
                <button class="btn-icon dropdown-trigger" onclick="toggleDropdown('dd-comp-${c.id}')">⋮</button>
                <div class="dropdown-content">
                  <button class="dropdown-item" onclick="abrirModalEditarCompra('${c.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                  <button class="dropdown-item dropdown-item-danger" onclick="abrirModalExcluirCompra('${c.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    Excluir
                  </button>
                </div>
              </div>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nenhuma compra registrada ainda</td></tr>'
}

function abrirModalCompra() {
  document.getElementById('form-compra').reset()
  document.getElementById('comp-id').value = ''
  document.getElementById('comp-data').value = new Date().toISOString().split('T')[0]
  document.getElementById('modal-compra-titulo').textContent = 'Registrar Custo'
  document.getElementById('modal-compra').classList.add('open')
}

function abrirModalEditarCompra(id) {
  const c = comprasCarregadas.find(x => x.id === id)
  if (!c) { toast('Erro ao buscar compra', 'error'); return }

  document.getElementById('comp-id').value    = c.id
  document.getElementById('comp-desc').value  = c.descricao || ''
  document.getElementById('comp-cat').value   = c.categoria || 'Outros'
  document.getElementById('comp-valor').value = c.valor || 0

  const dataFormatada = c.data_compra ? c.data_compra.split('T')[0] : ''
  document.getElementById('comp-data').value = dataFormatada

  document.getElementById('comp-obs').value = c.observacao || ''

  document.getElementById('modal-compra-titulo').textContent = `Editar Custo: ${c.descricao}`
  document.getElementById('modal-compra').classList.add('open')
}

function abrirModalExcluirCompra(id) {
  const c = comprasCarregadas.find(x => x.id === id);
  if(!c) return;

  document.getElementById('exc-id').value = id;
  document.getElementById('exc-nome').textContent = c.descricao;
  document.getElementById('modal-excluir').classList.add('open');
}

async function confirmarExclusao() {
  const id = document.getElementById('exc-id').value;
  if (!id) return;

  const { error } = await sb.schema(S).from('compras').delete().eq('id', id);
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return; }

  toast('Custo excluído!');
  fecharModal('modal-excluir');
  loadCompras();
  loadDashboard(); 
}

async function salvarCompra(e) {
  e.preventDefault()

  const id = document.getElementById('comp-id').value;
  const payload = {
    descricao:   document.getElementById('comp-desc').value.trim(),
    categoria:   document.getElementById('comp-cat').value,
    valor:       parseFloat(document.getElementById('comp-valor').value) || 0,
    data_compra: document.getElementById('comp-data').value,
    observacao:  document.getElementById('comp-obs').value.trim(),
  }

  if (!payload.descricao || payload.valor <= 0) { toast('Preencha descrição e valor válido', 'error'); return }

  let error;
  if (id) {
    const res = await sb.schema(S).from('compras').update(payload).eq('id', id);
    error = res.error;
  } else {
    const res = await sb.schema(S).from('compras').insert(payload);
    error = res.error;
  }

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  toast(id ? 'Custo atualizado!' : 'Novo custo registrado!')
  fecharModal('modal-compra')
  loadCompras()
  loadDashboard() 
}

// ── Ocultar valores ───────────────────────────────────────────────
const IDS_VALORES = [
  'stat-caixa', 'stat-fat', 'stat-custos', 'stat-lucro',
  'stat-receber', 'stat-total-val', 'stat-prod-val',
  'stat-pend-val', 'stat-sinal-val', 'stat-entregues-val'
]

let valoresOcultos = false

function toggleValores() {
  valoresOcultos = !valoresOcultos

  IDS_VALORES.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.classList.toggle('valor-oculto', valoresOcultos)
  })

  const btn  = document.getElementById('btn-eye')
  const icon = document.getElementById('eye-icon')

  btn.classList.toggle('active', valoresOcultos)

  icon.innerHTML = valoresOcultos
    ? `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`
}

// ── Sidebar ───────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('sidebar-collapsed')
}

// ── Dropdown ──────────────────────────────────────────────────────
function toggleDropdown(id) {
  const container = document.getElementById(id)
  const trigger   = container.querySelector('.dropdown-trigger')
  const content   = container.querySelector('.dropdown-content')
  const isOpen    = content.classList.contains('open')

  // fecha todos antes de abrir o clicado
  document.querySelectorAll('.dropdown-content.open')
    .forEach(el => el.classList.remove('open'))

  if (!isOpen) {
    const rect = trigger.getBoundingClientRect()
    content.style.top   = `${rect.bottom + 4}px`
    content.style.right = `${window.innerWidth - rect.right}px`
    content.classList.add('open')
  }
}

// fecha ao clicar fora de qualquer dropdown
document.addEventListener('click', function (e) {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-content.open')
      .forEach(el => el.classList.remove('open'))
  }
})

// ── Modais ────────────────────────────────────────────────────────
function fecharModal(id) {
  const el = document.getElementById(id)
  el.classList.remove('open')
}

function fecharSeBackdrop(e, id) {
  if (e.target.id === id) fecharModal(id)
}

// ── Expõe funções para o HTML ─────────────────────────────────────
window.navigate              = navigate
window.abrirModalPedido      = abrirModalPedido
window.abrirModalCliente     = abrirModalCliente
window.abrirModalCompra      = abrirModalCompra
window.fecharModal           = fecharModal
window.fecharSeBackdrop      = fecharSeBackdrop
window.addVariacao           = addVariacao
window.recalcPedido          = recalcPedido
window.salvarPedido          = salvarPedido
window.salvarCliente         = salvarCliente
window.salvarCompra          = salvarCompra
window.loadPedidos           = loadPedidos
window.loadCompras           = loadCompras
window.abrirDetalhesPedido   = abrirDetalhesPedido 
window.salvarNovoStatus      = salvarNovoStatus    
window.abrirModalEditarCompra  = abrirModalEditarCompra  
window.abrirModalExcluirCompra  = abrirModalExcluirCompra
window.confirmarExclusao        = confirmarExclusao
window.abrirModalEditarPedido   = abrirModalEditarPedido
window.abrirModalExcluirPedido  = abrirModalExcluirPedido
window.confirmarExclusaoPedido  = confirmarExclusaoPedido
window.abrirModalEditarCliente  = abrirModalEditarCliente
window.abrirModalExcluirCliente = abrirModalExcluirCliente
window.confirmarExclusaoCliente = confirmarExclusaoCliente
window.toggleSidebar            = toggleSidebar
window.toggleDropdown           = toggleDropdown
window.filtrarPedidos             = filtrarPedidos
window.salvarAdiantadoDetalhes    = salvarAdiantadoDetalhes
window.toggleValores              = toggleValores

// ── Inicialização ─────────────────────────────────────────────────
document.getElementById('today-date').textContent =
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// Esconde splash após dashboard carregar
async function init() {
  await navigate('dashboard')
  setTimeout(() => {
    document.getElementById('splash').classList.add('hide')
  }, 600)
}

init()