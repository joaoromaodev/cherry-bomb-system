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
  if (produtoAtualPrecos.length > 0) {
    const aplicaveis = produtoAtualPrecos.filter(p => qtd >= p.qtd_minima)
    if (!aplicaveis.length) return null
    return parseFloat(
      aplicaveis.reduce((best, p) => p.qtd_minima > best.qtd_minima ? p : best).preco_unitario
    )
  }
  // fallback global (sem produto selecionado)
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
  if (pagina === 'compras')   loadCompras()
  if (pagina === 'config')    loadConfig()
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.disabled) navigate(btn.dataset.page)
  })
})

// ── Dashboard ─────────────────────────────────────────────────────
async function loadDashboard() {
  const periodo = document.getElementById('filtro-periodo')?.value || 'tudo'

  const agora = new Date()
  let dataCorte = null

  if (periodo === 'mes') {
    dataCorte = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
  } else if (periodo === 'trimestre') {
    dataCorte = new Date(agora.getFullYear(), agora.getMonth() - 2, 1).toISOString()
  }

  let qPedidos     = sb.schema(S).from('pedidos').select('*')
  let qCompras     = sb.schema(S).from('compras').select('*')
  let qLancamentos = sb.schema(S).from('lancamentos').select('*')

  if (dataCorte) {
    qPedidos     = qPedidos.gte('created_at', dataCorte)
    qCompras     = qCompras.gte('created_at', dataCorte)
    qLancamentos = qLancamentos.gte('created_at', dataCorte)
  }

  const [resPedidos, resCompras, resLancamentos] = await Promise.all([qPedidos, qCompras, qLancamentos])

  if (resPedidos.error) { toast('Erro ao carregar pedidos: ' + resPedidos.error.message, 'error'); return }
  if (resCompras.error) { toast('Erro ao carregar compras: ' + resCompras.error.message, 'error'); return }

  const todosPedidos = resPedidos.data  || []
  const compras      = resCompras.data  || []
  const lancamentos  = resLancamentos.data || []

  const entradasManuais = lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + (parseFloat(l.valor) || 0), 0)
  const saidasManuais   = lancamentos.filter(l => l.tipo === 'saida').reduce((s, l)   => s + (parseFloat(l.valor) || 0), 0)

  const pedidos    = todosPedidos.filter(p => p.status_pedido !== 'Aguardando confirmação')
  const aguardando = todosPedidos.filter(p => p.status_pedido === 'Aguardando confirmação')
  const aguardandoQtd = aguardando.length
  const aguardandoVal = aguardando.reduce((s, p) => s + (parseFloat(p.total_final) || 0), 0)

  const total       = pedidos.length
  const faturamento = pedidos.reduce((s, p) => s + (p.total_final || 0), 0)
  const emProd      = pedidos.filter(p => p.status_pedido?.toLowerCase().includes('produção')).length
  const entregues   = pedidos.filter(p => p.status_pedido === 'Entregue').length

  // ── Alteração 1: rigor no "sem pagamento" ──────────────────────
  const pendentes = pedidos.filter(p =>
    p.status_pagamento === 'Aguardando Pagamento' &&
    (p.valor_adiantado === 0 || p.valor_adiantado === null || p.valor_adiantado === undefined)
  ).length

  const receitaRecebida = pedidos.reduce((s, p) => {
    if (p.status_pagamento === 'Reembolsado')   return s
    if (p.status_pagamento === 'Pago Integral') return s + (p.total_final || 0)
    return s + (parseFloat(p.valor_adiantado) || 0)
  }, 0)

  const valorAReceber = pedidos.reduce((s, p) => {
    if (p.status_pagamento === 'Pago Integral') return s
    if (p.status_pagamento === 'Reembolsado')   return s
    const adiantado = parseFloat(p.valor_adiantado) || 0
    return s + (p.total_final || 0) - adiantado
  }, 0)

  const comSinal = pedidos.filter(p =>
    (parseFloat(p.valor_adiantado) || 0) > 0 &&
    p.status_pagamento !== 'Pago Integral' &&
    p.status_pagamento !== 'Reembolsado'
  ).length

  const custos       = compras.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
  const lucro        = faturamento - custos
  const saldoEmCaixa = receitaRecebida - custos + entradasManuais - saidasManuais

  const prodVal      = pedidos.filter(p => p.status_pedido?.toLowerCase().includes('produção'))
                               .reduce((s, p) => s + (p.total_final || 0), 0)
  const entreguesVal = pedidos.filter(p => p.status_pedido === 'Entregue')
                               .reduce((s, p) => s + (p.total_final || 0), 0)
  const pendVal      = pedidos.filter(p =>
                         p.status_pagamento === 'Aguardando Pagamento' &&
                         (p.valor_adiantado === 0 || p.valor_adiantado === null || p.valor_adiantado === undefined)
                       ).reduce((s, p) => s + (p.total_final || 0), 0)
  const sinalVal     = pedidos.filter(p =>
                         (parseFloat(p.valor_adiantado) || 0) > 0 &&
                         p.status_pagamento !== 'Pago Integral' &&
                         p.status_pagamento !== 'Reembolsado'
                       ).reduce((s, p) => s + (parseFloat(p.valor_adiantado) || 0), 0)

  document.getElementById('stat-total').textContent         = total
  // ── Alteração 2: mostra qtd + valor retido nos orçamentos ──────
  document.getElementById('stat-aguardando').textContent = aguardandoQtd > 0 ? aguardandoQtd : '0'
  const statAguardandoSub = document.getElementById('stat-aguardando')?.closest('.stat-card')?.querySelector('.stat-sub')
  if (statAguardandoSub) statAguardandoSub.textContent = aguardandoQtd > 0 ? brl(aguardandoVal) : ''
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

  verificarGargalos(todosPedidos)
}

// ── Gargalos Operacionais ─────────────────────────────────────────
function verificarGargalos(todosPedidos) {
  const secao = document.getElementById('dashboard-gargalos')
  if (!secao) return

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  function diasDesde(dataStr) {
    if (!dataStr) return 0
    const d = new Date(dataStr)
    d.setHours(0, 0, 0, 0)
    return Math.floor((hoje - d) / (1000 * 60 * 60 * 24))
  }

  // ── Alerta 1: Orçamentos parados > 3 dias ──────────────────────
  const orcamentosParados = todosPedidos.filter(p =>
    p.status_pedido === 'Aguardando confirmação' &&
    diasDesde(p.created_at) > 3
  )
  const orcamentosVal = orcamentosParados.reduce((s, p) => s + (parseFloat(p.total_final) || 0), 0)

  // ── Alerta 2: Sem pagamento + sem adiantado > 2 dias ───────────
  const pagamentosPendentes = todosPedidos.filter(p =>
    p.status_pagamento === 'Aguardando Pagamento' &&
    (p.valor_adiantado === 0 || p.valor_adiantado === null || p.valor_adiantado === undefined) &&
    p.status_pedido !== 'Aguardando confirmação' &&
    p.status_pedido !== 'Cancelado' &&
    diasDesde(p.created_at) > 2
  )

  // ── Alerta 3: Prazo de produção estourado ──────────────────────
  const atrasosProducao = todosPedidos.filter(p => {
    if (!p.data_previsao) return false
    if (!['Em produção', 'Pronto para envio'].includes(p.status_pedido)) return false
    const previsao = new Date(p.data_previsao + 'T12:00:00')
    previsao.setHours(0, 0, 0, 0)
    return previsao < hoje
  })

  const alertas = []

  if (orcamentosParados.length > 0) {
    const plural = orcamentosParados.length > 1
    alertas.push({
      tipo:   'vermelho',
      icone:  '🔴',
      titulo: `${orcamentosParados.length} orçamento${plural ? 's' : ''} parado${plural ? 's' : ''} — ${brl(orcamentosVal)} retidos`,
      desc:   `${plural ? 'Pedidos estão' : 'Pedido está'} em "Aguardando confirmação" há mais de 3 dias. Hora de chamar as clientes!`,
      qtd:    orcamentosParados.length,
    })
  }

  if (pagamentosPendentes.length > 0) {
    const plural = pagamentosPendentes.length > 1
    alertas.push({
      tipo:   'amarelo',
      icone:  '🟡',
      titulo: `${pagamentosPendentes.length} pagamento${plural ? 's' : ''} pendente${plural ? 's' : ''}`,
      desc:   `${plural ? 'Pedidos confirmados estão' : 'Pedido confirmado está'} sem nenhum pagamento há mais de 2 dias.`,
      qtd:    pagamentosPendentes.length,
    })
  }

  if (atrasosProducao.length > 0) {
    const plural = atrasosProducao.length > 1
    alertas.push({
      tipo:   'fogo',
      icone:  '🔥',
      titulo: `${atrasosProducao.length} prazo${plural ? 's' : ''} estourado${plural ? 's' : ''}`,
      desc:   `${plural ? 'Pedidos em produção ultrapassaram' : 'Pedido em produção ultrapassou'} a previsão de envio.`,
      qtd:    atrasosProducao.length,
    })
  }

  if (alertas.length === 0) {
    secao.style.display = 'flex'
    secao.innerHTML = `
      <div class="gargalos-empty">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Operação em dia. Nenhum gargalo detectado.
      </div>`
    return
  }

  secao.style.display = 'flex'
  secao.innerHTML = alertas.map(a => `
    <div class="gargalo-card gargalo-card-${a.tipo}">
      <span class="gargalo-icone">${a.icone}</span>
      <div class="gargalo-texto">
        <p class="gargalo-titulo">${a.titulo}</p>
        <p class="gargalo-desc">${a.desc}</p>
      </div>
      <span class="gargalo-badge">${a.qtd}</span>
    </div>
  `).join('')
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

  pedidosCarregados = data

  // busca campos extras via RPC (contorna cache do PostgREST)
  const { data: extras } = await sb.rpc('get_campos_extras')

  if (extras) {
    const mapaExtras = {}
    extras.forEach(e => { mapaExtras[e.pedido_id] = e })
    data.forEach(p => {
      const ex = mapaExtras[p.id] || {}

      // valor_adiantado e produto_id vivem nas extras — RPC tem prioridade
      p.valor_adiantado = ex.valor_adiantado ?? p.valor_adiantado ?? 0
      p.produto_id      = ex.produto_id      ?? p.produto_id      ?? null

      // ⚠️ data_previsao e codigo_rastreio agora são salvos DIRETO na tabela pedidos
      // O select('*') já trouxe o valor correto. Só usa o extras como fallback
      // se o campo ainda não existir na tabela principal (migração antiga).
      p.data_previsao   = p.data_previsao   ?? ex.data_previsao   ?? null
      p.codigo_rastreio = p.codigo_rastreio ?? ex.codigo_rastreio ?? null
    })
  }

  pedidosCarregados = data

  // Popula o filtro de produto com valores únicos
  const produtos = [...new Set(data.map(p => p.produto).filter(Boolean))].sort()
  const selProd  = document.getElementById('filtro-produto')
  if (selProd) {
    const valorAtual = selProd.value
    selProd.innerHTML = '<option value="">Todos os produtos</option>' +
      produtos.map(p => `<option value="${p}"${p === valorAtual ? ' selected' : ''}>${p}</option>`).join('')
  }

  renderPedidos(data)
}

function calcStatusPagamento(p) {
  if (p.status_pagamento) return p.status_pagamento
  const vPago  = parseFloat(p.valor_adiantado) || 0
  const vTotal = parseFloat(p.total_final)     || 0
  if (vTotal > 0 && vPago >= vTotal) return 'Pago Integral'
  if (vPago > 0 && vPago < vTotal)  return 'Pago Parcialmente'
  return 'Aguardando Pagamento'
}

function renderPedidos(lista) {
  // ── Mini-cards ──────────────────────────────────────────────────
  const somaTotal = lista.reduce((s, p) => s + (parseFloat(p.total_final)     || 0), 0)
  const somaPago  = lista.reduce((s, p) => s + (parseFloat(p.valor_adiantado) || 0), 0)
  const somaRec   = somaTotal - somaPago
  const mcTotal   = document.getElementById('mc-total-pedidos')
  const mcPago    = document.getElementById('mc-total-pago')
  const mcRec     = document.getElementById('mc-a-receber')
  if (mcTotal) mcTotal.textContent = brl(somaTotal)
  if (mcPago)  mcPago.textContent  = brl(somaPago)
  if (mcRec)   mcRec.textContent   = brl(somaRec)

  document.getElementById('pedidos-tbody').innerHTML =
    lista.length
      ? lista.map(p => {
          const itens = p.itens_pedido || []

          // Coluna Produtos: agrupa por produto_nome mostrando qtd total por produto
          const produtosPorNome = {}
          itens.forEach(i => {
            const nome = i.produto_nome || p.produto || '—'
            produtosPorNome[nome] = (produtosPorNome[nome] || 0) + (parseInt(i.quantidade) || 0)
          })
          const produtoStr = Object.keys(produtosPorNome).length
            ? Object.entries(produtosPorNome)
                .map(([nome, qtd]) => `<span style="display:block;">${qtd}× ${nome}</span>`)
                .join('')
            : (p.produto || '—')

          // Coluna Variações
          const varStr = itens.length
            ? itens.map(i => `<span style="display:block;">${i.variacao || '—'}</span>`).join('')
            : '—'

          const vPago = parseFloat(p.valor_adiantado) || 0

          return `
            <tr>
              <td><span class="code">${p.codigo || '—'}</span></td>
              <td class="td-secondary">${fmtData(p.data_pedido)}</td>
              <td class="td-cliente">${p.cliente_nome || '—'}</td>
              <td class="td-secondary" style="font-size:12px;">${produtoStr}</td>
              <td class="vars" style="font-size:12px;">${varStr}</td>
              <td class="td-secondary"><strong>${p.qtd_total || 0}</strong> un</td>
              <td class="td-total">${brl(p.total_final)}</td>
              <td class="td-secondary" style="color:#16a34a; font-weight:700;">${vPago > 0 ? brl(vPago) : '—'}</td>
              <td>${badgePedido(p.status_pedido)}</td>
              <td>${badgePagto(calcStatusPagamento(p))}</td>
              <td>
                <div class="dropdown" id="dd-ped-${p.id}">
                  <button class="btn-icon dropdown-trigger" onclick="toggleDropdown('dd-ped-${p.id}')">⋮</button>
                  <div class="dropdown-content">
                    <button class="dropdown-item" onclick="abrirDetalhesPedido('${p.id}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Ver detalhes
                    </button>
                    <button class="dropdown-item" onclick="event.stopPropagation(); abrirModalEditarPedido('${p.id}')">
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
  const busca    = (document.getElementById('busca-pedido')?.value  || '').toLowerCase().trim()
  const produto  =  document.getElementById('filtro-produto')?.value  || ''
  const status   =  document.getElementById('filtro-status')?.value   || ''
  const pagamento=  document.getElementById('filtro-pagamento')?.value || ''

  const resultado = pedidosCarregados.filter(p => {
    const matchBusca = !busca ||
      (p.cliente_nome || '').toLowerCase().includes(busca) ||
      (p.codigo       || '').toLowerCase().includes(busca) ||
      (p.produto      || '').toLowerCase().includes(busca)

    const matchProduto   = !produto   || p.produto          === produto
    const matchStatus    = !status    || p.status_pedido    === status
    const matchPagamento = !pagamento || p.status_pagamento === pagamento

    return matchBusca && matchProduto && matchStatus && matchPagamento
  })

  renderPedidos(resultado)
}

// ── Pedido — atualizar status (edição rápida) ─────────────────────
function abrirDetalhesPedido(id) {
  const p = pedidosCarregados.find(x => x.id === id)
  if (!p) return

  console.log('Dados do Pedido:', p)
  console.log('Itens do Pedido:', p.itens_pedido)

  document.getElementById('det-id').value             = p.id
  document.getElementById('det-codigo').textContent   = p.codigo || '—'
  document.getElementById('det-cliente').textContent  = p.cliente_nome || '—'
  document.getElementById('det-produto').textContent  = p.produto || '—'
  document.getElementById('det-obs').textContent      = p.observacao || 'Nenhuma observação.'

  // ── Bloco financeiro detalhado ──────────────────────────────
  const subtotal  = parseFloat(p.subtotal)            || 0
  const frete     = parseFloat(p.frete)               || 0
  const desconto  = parseFloat(p.desconto_acrescimo)  || 0
  const total     = parseFloat(p.total_final)         || 0
  const adiantado = parseFloat(p.valor_adiantado)     || 0
  const restante  = total - adiantado

  const descontoLabel = desconto < 0 ? 'Desconto' : desconto > 0 ? 'Acréscimo' : null
  const descontoStr   = desconto < 0
    ? `− ${brl(Math.abs(desconto))}`
    : `+ ${brl(desconto)}`

  document.getElementById('det-financeiro').innerHTML = `
    <div class="det-fin-row">
      <span>Subtotal dos itens</span>
      <span>${brl(subtotal)}</span>
    </div>
    ${frete > 0 ? `
    <div class="det-fin-row">
      <span>Frete</span>
      <span>+ ${brl(frete)}</span>
    </div>` : ''}
    ${descontoLabel ? `
    <div class="det-fin-row">
      <span>${descontoLabel}</span>
      <span>${descontoStr}</span>
    </div>` : ''}
    <div class="det-fin-row total">
      <span>Total do pedido</span>
      <span>${brl(total)}</span>
    </div>
    <hr class="det-fin-divider">
    <div class="det-fin-row pago">
      <span>Valor pago</span>
      <span>${brl(adiantado)}</span>
    </div>
    <div class="det-fin-row receber">
      <span>Ainda a receber</span>
      <span>${brl(restante)}</span>
    </div>
  `

  /// ── O que produzir (itens_pedido com produto + variação + qtd) ──
  const itens = p.itens_pedido || []
  const itensPorProduto = {}
  itens.forEach(i => {
    const chave = i.produto_nome || p.produto || 'Produto'
    if (!itensPorProduto[chave]) itensPorProduto[chave] = []
    itensPorProduto[chave].push(i)
  })

  const varHtml = Object.entries(itensPorProduto).map(([nomeProd, linhas]) => {
    const linhasHtml = linhas
      .map(i => `<div style="margin-left:8px; margin-top:2px;">↳ <strong>${i.quantidade ?? '?'} un</strong> — ${i.variacao || '—'}</div>`)
      .join('')
    return `<div style="margin-bottom:6px;"><span style="font-weight:800; color:var(--cherry-dark);">🍒 ${nomeProd}</span>${linhasHtml}</div>`
  }).join('')

  document.getElementById('det-variacoes').innerHTML = varHtml || 'Sem variações registradas.'

  // ── Logística (previsão + rastreio) — aparece ANTES das observações ──
  const previsaoEl = document.getElementById('det-info-logistica')
  if (previsaoEl) {
    const previsaoFmt = p.data_previsao
      ? new Date(p.data_previsao + 'T12:00:00')
          .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null

    const linhaPrevisao = previsaoFmt
      ? `<div class="det-logistica-row"><span>Previsão de envio</span><strong>${previsaoFmt}</strong></div>`
      : ''

    const linhaRastreio = p.codigo_rastreio
      ? `<div class="det-logistica-row"><span>Código de rastreio</span><strong class="code" style="font-size:12px;">${p.codigo_rastreio}</strong></div>`
      : ''

    if (linhaPrevisao || linhaRastreio) {
      previsaoEl.style.display = 'block'
      previsaoEl.innerHTML = linhaPrevisao + linhaRastreio
    } else {
      previsaoEl.style.display = 'none'
      previsaoEl.innerHTML = ''
    }
  }

  // ── Inputs da seção de status ───────────────────────────────
  document.getElementById('det-adiantado-input').value  = adiantado || ''
  document.getElementById('det-status-pedido').value    = p.status_pedido    || 'Aguardando confirmação'
  document.getElementById('det-status-pagamento').textContent = calcStatusPagamento(p)
  document.getElementById('det-data-previsao').value    = p.data_previsao    ? p.data_previsao.split('T')[0] : ''
  document.getElementById('det-codigo-rastreio').value  = p.codigo_rastreio  || ''

  // Visibilidade condicional dos campos de status
  onDetStatusChange(p.status_pedido || 'Aguardando confirmação')

  // Reseta preview de mensagem
  document.getElementById('det-msg-preview').style.display = 'none'
  document.getElementById('det-msg-texto').textContent     = ''

  document.getElementById('modal-detalhes').classList.add('open')
}

// ── Visibilidade condicional no modal de detalhes ─────────────────
function onDetStatusChange(statusValue) {
  const comPrazo   = ['Em produção', 'Pronto para envio', 'Pago parcial', 'Pago integral', 'Entregue']
  const comRastreio = ['Enviado', 'Entregue']

  const cPrev = document.getElementById('det-container-previsao')
  const cRast = document.getElementById('det-container-rastreio')

  if (cPrev) {
    const mostrarPrev = comPrazo.includes(statusValue)
    cPrev.style.display = mostrarPrev ? 'block' : 'none'
    if (!mostrarPrev) document.getElementById('det-data-previsao').value = ''
  }

  if (cRast) {
    const mostrarRast = comRastreio.includes(statusValue)
    cRast.style.display = mostrarRast ? 'block' : 'none'
    if (!mostrarRast) document.getElementById('det-codigo-rastreio').value = ''
  }
}

// ── Calculadora de Precificação ───────────────────────────────────
function calcularPrecificacao() {
  const material      = parseFloat(document.getElementById('cp-material')?.value)        || 0
  const tempo         = parseFloat(document.getElementById('cp-tempo')?.value)           || 0
  const hora          = parseFloat(document.getElementById('cp-hora')?.value)            || 0
  const margem        = parseFloat(document.getElementById('cp-margem')?.value)          || 0
  const margemAtacado = parseFloat(document.getElementById('cp-margem-atacado')?.value)  || 0

  const custoTempo  = (tempo / 60) * hora
  const custoTotal  = material + custoTempo

  // Preço de varejo: custo / (1 - margem/100)
  const fatorVarejo  = margem >= 100 ? null : 1 - (margem / 100)
  const precoVarejo  = fatorVarejo ? custoTotal / fatorVarejo : null

  // Preço de atacado
  const fatorAtacado = margemAtacado >= 100 ? null : 1 - (margemAtacado / 100)
  const precoAtacado = fatorAtacado && custoTotal > 0 ? custoTotal / fatorAtacado : null

  // Desconto máximo: quanto pode descontar do varejo sem perder (= preço varejo - custo)
  const descontoMax  = precoVarejo ? precoVarejo - custoTotal : null

  const lucroVarejo  = precoVarejo ? precoVarejo - custoTotal : null
  const pctLucro     = custoTotal > 0 && lucroVarejo ? (lucroVarejo / precoVarejo * 100) : null

  // ── Atualiza DOM ────────────────────────────────────────────────
  document.getElementById('cp-out-material').textContent    = material > 0   ? brl(material)   : '—'
  document.getElementById('cp-out-tempo').textContent       = custoTempo > 0 ? brl(custoTempo) : '—'
  document.getElementById('cp-out-custo-total').textContent = custoTotal > 0 ? brl(custoTotal) : '—'

  document.getElementById('cp-out-varejo').textContent      = precoVarejo  ? brl(precoVarejo)  : '—'
  document.getElementById('cp-out-atacado').textContent     = precoAtacado ? brl(precoAtacado) : '—'
  document.getElementById('cp-out-equilibrio').textContent  = custoTotal > 0 ? brl(custoTotal) : '—'

  document.getElementById('cp-out-desconto-max').textContent = descontoMax !== null
    ? `${brl(descontoMax)} (${descontoMax > 0 ? ((descontoMax / precoVarejo) * 100).toFixed(0) : 0}%)`
    : '—'

  document.getElementById('cp-out-lucro-varejo').textContent = lucroVarejo !== null && precoVarejo
    ? `Lucro de ${brl(lucroVarejo)} por peça (${pctLucro.toFixed(0)}% do preço)`
    : 'Preencha os campos para calcular'

  // ── Avisos ──────────────────────────────────────────────────────
  const aviso     = document.getElementById('cp-aviso')
  const avisoTxt  = document.getElementById('cp-aviso-texto')
  let mensagemAviso = ''

  if (margem >= 100) {
    mensagemAviso = 'Margem de varejo igual ou acima de 100% — não é possível calcular o preço de venda.'
  } else if (precoAtacado && precoVarejo && precoAtacado >= precoVarejo) {
    mensagemAviso = 'A margem de atacado está próxima ou igual à de varejo. Considere reduzi-la para viabilizar o desconto por volume.'
  } else if (custoTotal > 0 && margem > 0 && margemAtacado > 0 && precoAtacado && precoAtacado < custoTotal) {
    mensagemAviso = 'Atenção: o preço de atacado calculado está abaixo do custo total. Você operaria no prejuízo.'
  }

  if (mensagemAviso) {
    aviso.style.display    = 'flex'
    avisoTxt.textContent   = mensagemAviso
  } else {
    aviso.style.display    = 'none'
    avisoTxt.textContent   = ''
  }
}

// ── Previsão de entrega — visibilidade condicional ────────────────
const STATUS_COM_PRAZO   = ['Em produção', 'Pronto para envio', 'Pago parcial', 'Pago integral']
const STATUS_COM_RASTREIO = ['Enviado']

function atualizarVisibilidadePrevisao(statusValue) {
  const container = document.getElementById('container-data-previsao')
  if (!container) return
  const mostrar = STATUS_COM_PRAZO.includes(statusValue)
  container.style.display = mostrar ? 'block' : 'none'
  if (!mostrar) document.getElementById('pedido-data-previsao').value = ''
}

function atualizarVisibilidadeRastreio(statusValue) {
  const container = document.getElementById('container-rastreio')
  if (!container) return
  const mostrar = STATUS_COM_RASTREIO.includes(statusValue)
  container.style.display = mostrar ? 'block' : 'none'
  if (!mostrar) document.getElementById('pedido-rastreio').value = ''
}

// listener delegado — funciona mesmo após o modal ser reiniciado
document.addEventListener('change', function (e) {
  if (e.target.id === 'pedido-status') {
    atualizarVisibilidadePrevisao(e.target.value)
    atualizarVisibilidadeRastreio(e.target.value)
  }
})

// ── Comunicação com cliente ────────────────────────────────────────
function _getPedidoAtualDetalhes() {
  const id = document.getElementById('det-id').value
  return pedidosCarregados.find(x => x.id === id) || null
}

function _formatarTelefone(tel) {
  if (!tel) return null
  return tel.replace(/\D/g, '')
}

function _mostrarMensagem(texto) {
  document.getElementById('det-msg-texto').textContent    = texto
  document.getElementById('det-msg-preview').style.display = 'block'
}

function gerarResumoPedido() {
  const p = _getPedidoAtualDetalhes()
  if (!p) return
  const template = templatesMensagem.msg_resumo || TEMPLATES_PADRAO.msg_resumo
  _mostrarMensagem(formatarMensagem(template, p))
}

function avisarStatus() {
  const p      = _getPedidoAtualDetalhes()
  if (!p) return
  const status = document.getElementById('det-status-pedido').value

  let chave = null
  if (status === 'Em produção')      chave = 'msg_status_producao'
  if (status === 'Pronto para envio') chave = 'msg_status_pronto'
  if (status === 'Enviado')          chave = 'msg_status_enviado'

  if (chave) {
    const template = templatesMensagem[chave] || TEMPLATES_PADRAO[chave]
    _mostrarMensagem(formatarMensagem(template, p))
    return
  }

  // Fallback para status sem template customizável
  const nome = (p.cliente_nome || '').split(' ')[0]
  let msg = ''

  if (status === 'Entregue') {
    msg = `Oie ${nome}! 🍒\n\nO sistema apontou que o seu pedido foi entregue! Espero que você tenha amado tudo. 🥰\n\nSe puder, me conta o que achou — fico feliz demais com o seu feedback! 💕`
  } else if (status === 'Aguardando confirmação') {
    msg = `Oie ${nome}! 🍒\n\nPassando pra confirmar o seu pedido *${p.codigo}*:\n\n*Produto:* ${p.produto || '—'}\n*Total:* ${brl(p.total_final)}\n\nMe confirma se tudo está certinho para eu dar início à produção! 🎀`
  } else {
    msg = `Oie ${nome}! 🍒\n\nPassando para dar um update sobre o seu pedido *${p.codigo}*:\n\n*Status atual:* ${status}\n\nQualquer dúvida é só chamar! 💕`
  }

  _mostrarMensagem(msg)
}

function copiarMensagem() {
  const texto = document.getElementById('det-msg-texto').textContent
  if (!texto) return
  navigator.clipboard.writeText(texto)
    .then(() => toast('Mensagem copiada!'))
    .catch(() => toast('Erro ao copiar. Selecione o texto manualmente.', 'error'))
}

function enviarWhatsApp() {
  const p = _getPedidoAtualDetalhes()
  if (!p) return

  const texto = document.getElementById('det-msg-texto').textContent
  if (!texto) { toast('Gere uma mensagem primeiro', 'error'); return }

  const tel = _formatarTelefone(p.contato_cliente ||
    clientesCarregados.find(c => c.id === p.cliente_id)?.contato || '')

  const encoded = encodeURIComponent(texto)

  if (tel && tel.length >= 10) {
    window.open(`https://wa.me/55${tel}?text=${encoded}`, '_blank')
  } else {
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }
}

async function atualizarStatusPedido() {
  const id = document.getElementById('det-id').value
  if (!id) { toast('Pedido não identificado', 'error'); return }

  const status_pedido    = document.getElementById('det-status-pedido').value
  const status_pagamento = document.getElementById('det-status-pagamento').value

  // Captura previsão e rastreio diretamente dos inputs do modal
  const dataPrevisaoRaw = document.getElementById('det-data-previsao')?.value?.trim() || ''
  const rastreioRaw     = document.getElementById('det-codigo-rastreio')?.value?.trim() || ''

  const data_previsao   = dataPrevisaoRaw  || null
  const codigo_rastreio = rastreioRaw ? rastreioRaw.toUpperCase() : null

  const { error } = await sb.schema(S).from('pedidos').update({
    status_pedido,
    status_pagamento,
    data_previsao,
    codigo_rastreio,
  }).eq('id', id)

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  // Atualiza cache local
  const idx = pedidosCarregados.findIndex(x => x.id === id)
  if (idx >= 0) {
    pedidosCarregados[idx].status_pedido    = status_pedido
    pedidosCarregados[idx].status_pagamento = status_pagamento
    pedidosCarregados[idx].data_previsao    = data_previsao
    pedidosCarregados[idx].codigo_rastreio  = codigo_rastreio
  }

  toast('Alterações salvas!')
  fecharModal('modal-detalhes')
  loadPedidos()
  loadDashboard()
}

async function salvarAdiantadoDetalhes() {
  const idPedido = document.getElementById('det-id').value
  if (!idPedido) { toast('Pedido não identificado', 'error'); return }

  const p = pedidosCarregados.find(x => x.id === idPedido)
  if (!p) { toast('Pedido não encontrado', 'error'); return }

  const raw          = document.getElementById('det-adiantado-input').value || '0'
  const valorTratado = parseFloat(raw.replace(',', '.')) || 0
  const totalPedido  = parseFloat(p.total_final) || 0

  const vPago  = parseFloat(valorTratado) || 0
  const vTotal = parseFloat(totalPedido)  || 0

  if (vPago > vTotal) {
    toast('O valor pago não pode ser maior que o total do pedido.', 'error')
    return
  }

  let novoStatusPagamento = 'Aguardando Pagamento'
  if (vPago >= vTotal && vTotal > 0)       novoStatusPagamento = 'Pago Integral'
  else if (vPago > 0 && vPago < vTotal)    novoStatusPagamento = 'Pago Parcialmente'

  const { error } = await sb.schema(S).from('pedidos')
    .update({ valor_adiantado: vPago, status_pagamento: novoStatusPagamento })
    .eq('id', idPedido)

  if (error) { toast('Erro ao salvar valor pago: ' + error.message, 'error'); return }

  // Atualiza cache local
  const idx = pedidosCarregados.findIndex(x => x.id === idPedido)
  if (idx >= 0) {
    pedidosCarregados[idx].valor_adiantado  = vPago
    pedidosCarregados[idx].status_pagamento = novoStatusPagamento
  }

  // Sincroniza o select de status no modal
  const selPagto = document.getElementById('det-status-pagamento')
  if (selPagto) selPagto.value = novoStatusPagamento

  // Re-renderiza o bloco financeiro sem fechar o modal
  p.valor_adiantado = vPago
  const restante    = vTotal - vPago
  const detFinEl    = document.getElementById('det-financeiro')
  if (detFinEl) {
    detFinEl.querySelectorAll('.det-fin-row').forEach(row => {
      const label = row.querySelector('span:first-child')?.textContent?.trim()
      const val   = row.querySelector('span:last-child')
      if (label === 'Valor pago'      && val) val.textContent = brl(valorTratado)
      if (label === 'Ainda a receber' && val) val.textContent = brl(restante)
    })
  }

  toast('Valor pago salvo!')
  loadDashboard()
  // modal permanece aberto
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
  document.getElementById('form-pedido').reset()
  document.getElementById('pedido-id').value = ''
  document.querySelector('#modal-pedido .modal-header h2').textContent = 'Novo pedido'

  const [resClientes, resProdutos] = await Promise.all([
    sb.schema(S).from('clientes').select('id, nome').order('nome'),
    sb.schema(S).from('produtos')
      .select('*, produto_variacoes(*), produto_precos(*)')
      .eq('ativo', true).order('nome')
  ])

  document.getElementById('pedido-cliente').innerHTML =
    '<option value="">Selecione o cliente...</option>' +
    (resClientes.data || []).map(c =>
      `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('')

  if (resProdutos.data) {
    resProdutos.data.forEach(p => {
      const idx = produtosCarregados.findIndex(x => x.id === p.id)
      idx >= 0 ? produtosCarregados[idx] = p : produtosCarregados.push(p)
    })
  }

  document.getElementById('container-itens-pedido').innerHTML = ''
  blocoItemCounter = 0
  adicionarBlocoItem()
  recalcPedido()
  document.getElementById('modal-pedido').classList.add('open')
}

async function abrirModalEditarPedido(id) {
  document.querySelectorAll('.dropdown-content.open')
    .forEach(d => d.classList.remove('open'))

  const p = pedidosCarregados.find(x => x.id === id)
  if (!p) { toast('Pedido não encontrado', 'error'); return }

  console.log('Dados do Pedido:', p)
  console.log('Itens do Pedido:', p.itens_pedido)

  const [resClientes, resProdutos] = await Promise.all([
    sb.schema(S).from('clientes').select('id, nome').order('nome'),
    sb.schema(S).from('produtos')
      .select('*, produto_variacoes(*), produto_precos(*)')
      .eq('ativo', true).order('nome')
  ])

  document.getElementById('pedido-cliente').innerHTML =
    '<option value="">Selecione o cliente...</option>' +
    (resClientes.data || []).map(c =>
      `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('')

  if (resProdutos.data) {
    resProdutos.data.forEach(pr => {
      const idx = produtosCarregados.findIndex(x => x.id === pr.id)
      idx >= 0 ? produtosCarregados[idx] = pr : produtosCarregados.push(pr)
    })
  }

  document.getElementById('pedido-id').value        = p.id
  document.getElementById('pedido-cliente').value   = p.cliente_id || ''
  document.getElementById('pedido-desconto').value  = p.desconto_acrescimo || ''
  document.getElementById('pedido-frete').value     = p.frete || ''
  document.getElementById('pedido-obs').value       = p.observacao || ''
  document.getElementById('pedido-adiantado').value = p.valor_adiantado || ''

  // Garante que produtosCarregados está populado antes de criar blocos
  if (resProdutos.data) {
    resProdutos.data.forEach(pr => {
      const idx = produtosCarregados.findIndex(x => x.id === pr.id)
      idx >= 0 ? produtosCarregados[idx] = pr : produtosCarregados.push(pr)
    })
  }

  // Busca itens frescos do banco para garantir produto_id e produto_nome
  const { data: itensFrescos } = await sb.schema(S)
    .from('itens_pedido')
    .select('*')
    .eq('pedido_id', p.id)

  const itens = itensFrescos || p.itens_pedido || []

  const container = document.getElementById('container-itens-pedido')
  container.innerHTML = ''
  blocoItemCounter = 0

  if (itens.length) {
    const grupos = {}
    itens.forEach(item => {
      const prodId   = item.produto_id   || ''
      const prodNome = item.produto_nome || ''
      const chave    = prodId || prodNome || '__sem_produto__'

      console.log('Item lido:', { prodId, prodNome, variacao: item.variacao, quantidade: item.quantidade })

      if (!grupos[chave]) {
        grupos[chave] = { produto_id: prodId, produto_nome: prodNome, variacoes: [] }
      }
      grupos[chave].variacoes.push({
        variacao:   item.variacao,
        quantidade: item.quantidade,
      })
    })
    Object.values(grupos).forEach(g => {
      console.log('Criando bloco:', g)
      adicionarBlocoItem(g.produto_id, g.variacoes)
    })
  } else {
    adicionarBlocoItem()
  }

  recalcPedido()
  document.querySelector('#modal-pedido .modal-header h2').textContent = `Editar Pedido ${p.codigo || ''}`
  document.getElementById('modal-pedido').classList.add('open')
}

async function onProdutoChange(existingItems = []) {
  const produtoId = document.getElementById('pedido-produto').value
  const list      = document.getElementById('variacao-list')
  list.innerHTML  = ''

  if (produtoId) {
    const prod = produtosCarregados.find(x => x.id === produtoId)
    produtoAtualVariacoes = (prod?.produto_variacoes || [])
      .sort((a, b) => a.nome.localeCompare(b.nome))
    produtoAtualPrecos    = (prod?.produto_precos    || [])
      .sort((a, b) => a.qtd_minima - b.qtd_minima)

    if (existingItems.length) {
      existingItems.forEach(item => addVariacao(produtoAtualVariacoes, item.variacao, item.quantidade))
    } else {
      addVariacao(produtoAtualVariacoes)
      addVariacao(produtoAtualVariacoes)
    }
  } else {
    produtoAtualVariacoes = []
    produtoAtualPrecos    = []
    addVariacao()
    addVariacao()
  }
  recalcPedido()
}

function addVariacao(variacoes, selectedValue = '', qtd = '') {
  // se não receber variacoes explícitas, usa o contexto atual do produto
  const lista = (variacoes !== undefined && variacoes !== null)
    ? variacoes
    : produtoAtualVariacoes

  const list = document.getElementById('variacao-list')
  const n    = list.children.length + 1
  const div  = document.createElement('div')
  div.className = 'var-row'

  const varInput = lista.length
    ? `<select class="var-nome" oninput="recalcPedido()">
        <option value="">Selecione...</option>
        ${lista.map(v =>
          `<option value="${v.nome}" ${v.nome === selectedValue ? 'selected' : ''}>${v.nome}</option>`
        ).join('')}
       </select>`
    : `<input type="text" placeholder="Variação ${n}" class="var-nome"
        value="${selectedValue}" oninput="recalcPedido()">`

  div.innerHTML = `
    ${varInput}
    <input type="number" placeholder="Qtd" min="0" step="1" class="var-qtd"
      value="${qtd}" oninput="recalcPedido()">
    <button type="button" class="btn-rm-var"
      onclick="this.parentElement.remove(); recalcPedido()">×</button>
  `
  list.appendChild(div)
}

// ── Blocos de item (múltiplos produtos) ───────────────────────────
let blocoItemCounter = 0

function adicionarBlocoItem(produtoIdSel = '', itemsDoBloco = []) {
  const container = document.getElementById('container-itens-pedido')
  if (!container) return

  blocoItemCounter++
  const blocoId = `bloco-item-${blocoItemCounter}`

  const div = document.createElement('div')
  div.className = 'bloco-item'
  div.id = blocoId
  div.style.cssText = 'border:1.5px solid var(--border); border-radius:10px; padding:12px; margin-bottom:10px; background:var(--card, #fff);'

  const produtosOptions = produtosCarregados
    .filter(p => p.ativo !== false)
    .map(p => `<option value="${p.id}" ${p.id === produtoIdSel ? 'selected' : ''}>${p.nome}</option>`)
    .join('')

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <label style="font-size:12px; font-weight:700; color:var(--cherry-dark); margin:0;">Produto</label>
      <button type="button" class="btn-rm-var" style="font-size:18px; line-height:1;"
        onclick="document.getElementById('${blocoId}').remove(); recalcPedido()">×</button>
    </div>
    <select class="bloco-produto-select" style="width:100%; margin-bottom:8px;"
      onchange="onBlocoProdutoChange('${blocoId}')">
      <option value="">Selecione o produto...</option>
      ${produtosOptions}
    </select>
    <div class="bloco-variacoes-container" id="${blocoId}-vars"></div>
    <button type="button" class="btn-add-var" style="font-size:11px; margin-top:4px;"
      onclick="adicionarVarNoBloco('${blocoId}')">+ variação</button>
    <div id="${blocoId}-subtotal"
      style="font-size:12px; color:var(--muted); text-align:right; margin-top:6px; font-weight:700;"></div>
  `

  container.appendChild(div)

  if (produtoIdSel) {
    const prod = produtosCarregados.find(x => x.id === produtoIdSel)
    if (prod) {
      div.dataset.produtoId   = prod.id
      div.dataset.produtoNome = prod.nome
      const variacoes = (prod.produto_variacoes || []).sort((a, b) => a.nome.localeCompare(b.nome))
      if (itemsDoBloco.length) {
        itemsDoBloco.forEach(item => adicionarVarNoBloco(blocoId, variacoes, item.variacao, item.quantidade))
      } else {
        adicionarVarNoBloco(blocoId, variacoes)
      }
    }
  } else {
    adicionarVarNoBloco(blocoId, [])
  }

  recalcPedido()
}

function onBlocoProdutoChange(blocoId) {
  const bloco = document.getElementById(blocoId)
  if (!bloco) return
  const selectProd = bloco.querySelector('.bloco-produto-select')
  const produtoId  = selectProd?.value || ''
  const prod       = produtosCarregados.find(x => x.id === produtoId) || null

  bloco.dataset.produtoId   = produtoId
  bloco.dataset.produtoNome = prod?.nome || ''

  const varsContainer = document.getElementById(`${blocoId}-vars`)
  if (varsContainer) varsContainer.innerHTML = ''

  const variacoes = (prod?.produto_variacoes || []).sort((a, b) => a.nome.localeCompare(b.nome))
  adicionarVarNoBloco(blocoId, variacoes)
  recalcPedido()
}

function adicionarVarNoBloco(blocoId, variacoes = null, varSelecionada = '', qtdSelecionada = '') {
  const bloco = document.getElementById(blocoId)
  if (!bloco) return
  const varsContainer = document.getElementById(`${blocoId}-vars`)
  if (!varsContainer) return

  if (variacoes === null) {
    const prod = produtosCarregados.find(x => x.id === bloco.dataset.produtoId)
    variacoes  = (prod?.produto_variacoes || []).sort((a, b) => a.nome.localeCompare(b.nome))
  }

  const div = document.createElement('div')
  div.className = 'var-row'

  const varInput = variacoes.length
    ? `<select class="var-nome" oninput="recalcPedido()">
        <option value="">Selecione...</option>
        ${variacoes.map(v =>
          `<option value="${v.nome}" ${v.nome === varSelecionada ? 'selected' : ''}>${v.nome}</option>`
        ).join('')}
       </select>`
    : `<input type="text" placeholder="Variação" class="var-nome"
        value="${varSelecionada}" oninput="recalcPedido()">`

  div.innerHTML = `
    ${varInput}
    <input type="number" placeholder="Qtd" min="0" step="1" class="var-qtd"
      value="${qtdSelecionada}" oninput="recalcPedido()">
    <button type="button" class="btn-rm-var"
      onclick="this.parentElement.remove(); recalcPedido()">×</button>
  `
  varsContainer.appendChild(div)
  recalcPedido()
}

function parseMoeda(val) {
  if (!val) return 0
  return parseFloat(String(val).replace(',', '.')) || 0
}

function recalcPedido() {
  const blocos        = Array.from(document.querySelectorAll('#container-itens-pedido .bloco-item'))
  let   grandSubtotal = 0
  let   grandQtd      = 0

  blocos.forEach(bloco => {
    const prod   = produtosCarregados.find(x => x.id === bloco.dataset.produtoId) || null
    const precos = (prod?.produto_precos || []).sort((a, b) => a.qtd_minima - b.qtd_minima)

    const blocoQtd = Array.from(bloco.querySelectorAll('.var-row'))
      .reduce((s, row) => s + (parseInt(row.querySelector('.var-qtd')?.value) || 0), 0)

    let preco = null
    if (precos.length > 0 && blocoQtd > 0) {
      const aplicaveis = precos.filter(p => blocoQtd >= p.qtd_minima)
      if (aplicaveis.length)
        preco = parseFloat(aplicaveis.reduce((best, p) => p.qtd_minima > best.qtd_minima ? p : best).preco_unitario)
    }

    const blocoSubtotal = preco ? blocoQtd * preco : 0
    grandQtd      += blocoQtd
    grandSubtotal += blocoSubtotal

    const subtotalEl = document.getElementById(`${bloco.id}-subtotal`)
    if (subtotalEl) {
      if (!bloco.dataset.produtoId || blocoQtd === 0) {
        subtotalEl.textContent = ''
      } else if (!preco) {
        const minQtd = precos.length ? Math.min(...precos.map(p => p.qtd_minima)) : 1
        subtotalEl.innerHTML = `<span style="color:#b45309;">⚠ mín. ${minQtd} un</span>`
      } else {
        subtotalEl.textContent = `${blocoQtd} un × ${brl(preco)} = ${brl(blocoSubtotal)}`
      }
    }
  })

  const desconto = parseMoeda(document.getElementById('pedido-desconto')?.value)
  const frete    = parseMoeda(document.getElementById('pedido-frete')?.value)
  const total    = grandSubtotal + desconto + frete

  document.getElementById('calc-qtd').textContent      = grandQtd > 0      ? `${grandQtd} un` : '—'
  document.getElementById('calc-subtotal').textContent = grandSubtotal > 0  ? brl(grandSubtotal) : '—'
  document.getElementById('calc-total').textContent    = grandSubtotal > 0  ? brl(total) : '—'
}

async function salvarPedido(e) {
  e.preventDefault()

  const editId      = document.getElementById('pedido-id').value
  const selCli      = document.getElementById('pedido-cliente')
  const clienteId   = selCli.value
  const clienteNome = selCli.selectedOptions[0]?.dataset.nome || ''

  if (!clienteId) { toast('Selecione um cliente', 'error'); return }

  // ── Coleta itens de todos os blocos ───────────────────────────
  const todosBlocos = Array.from(document.querySelectorAll('#container-itens-pedido .bloco-item'))
  const todosItens  = []

  todosBlocos.forEach(bloco => {
    const selectProd  = bloco.querySelector('.bloco-produto-select')
    const produtoId   = selectProd?.value || null
    const produtoNome = produtoId
      ? (selectProd.options[selectProd.selectedIndex]?.text || '').trim()
      : ''

    bloco.querySelectorAll('.var-row').forEach(row => {
      const variacao   = row.querySelector('.var-nome')?.value?.trim() || ''
      const quantidade = parseInt(row.querySelector('.var-qtd')?.value) || 0
      if (variacao && quantidade > 0) {
        todosItens.push({
          produto_id:   produtoId   || null,
          produto_nome: produtoNome || '',
          variacao,
          quantidade,
        })
      }
    })
  })

  if (!todosItens.length) {
    toast('Adicione pelo menos um produto com variação e quantidade', 'error')
    return
  }

  // ── Calcula subtotal por bloco ────────────────────────────────
  let grandSubtotal = 0
  let hasError      = false

  for (const bloco of todosBlocos) {
    const selectProd = bloco.querySelector('.bloco-produto-select')
    const produtoId  = selectProd?.value || null
    const prod       = produtosCarregados.find(x => x.id === produtoId) || null
    const precos     = (prod?.produto_precos || []).sort((a, b) => a.qtd_minima - b.qtd_minima)

    const blocoQtd = Array.from(bloco.querySelectorAll('.var-row'))
      .reduce((s, row) => s + (parseInt(row.querySelector('.var-qtd')?.value) || 0), 0)

    if (blocoQtd === 0) continue

    if (!produtoId) {
      toast('Selecione um produto em cada bloco', 'error')
      hasError = true
      break
    }

    if (precos.length > 0) {
      const minQtd = Math.min(...precos.map(pr => pr.qtd_minima))
      if (blocoQtd < minQtd) {
        const nomeProd = selectProd.options[selectProd.selectedIndex]?.text || produtoId
        toast(`Quantidade mínima para "${nomeProd}" é ${minQtd} un`, 'error')
        hasError = true
        break
      }
      const aplicaveis = precos.filter(pr => blocoQtd >= pr.qtd_minima)
      if (aplicaveis.length) {
        const melhor = aplicaveis.reduce((best, pr) => pr.qtd_minima > best.qtd_minima ? pr : best)
        grandSubtotal += blocoQtd * parseFloat(melhor.preco_unitario)
      }
    }
  }

  if (hasError) return

  const qtdTotal       = todosItens.reduce((s, i) => s + i.quantidade, 0)
  const desconto       = parseMoeda(document.getElementById('pedido-desconto').value)
  const frete          = parseMoeda(document.getElementById('pedido-frete').value)
  const total          = grandSubtotal + desconto + frete
  const valorAdiantado = parseMoeda(document.getElementById('pedido-adiantado').value)

  const vPago  = parseFloat(valorAdiantado) || 0
  const vTotal = parseFloat(total)          || 0

  let statusPagto = 'Aguardando Pagamento'
  if (vTotal > 0 && vPago >= vTotal)    statusPagto = 'Pago Integral'
  else if (vPago > 0 && vPago < vTotal) statusPagto = 'Pago Parcialmente'

  let pedidoId = editId

  if (editId) {
    // ── UPDATE ────────────────────────────────────────────────────
    const payloadEdicao = {
      cliente_id:         clienteId,
      cliente_nome:       clienteNome,
      qtd_total:          qtdTotal,
      preco_unitario:     null,
      subtotal:           grandSubtotal,
      desconto_acrescimo: desconto,
      frete:              frete,
      total_final:        total,
      observacao:         document.getElementById('pedido-obs').value.trim(),
      valor_adiantado:    vPago,
      status_pagamento:   statusPagto,
    }

    const { error } = await sb.schema(S).from('pedidos')
      .update(payloadEdicao).eq('id', editId)

    if (error) {
      console.error('Erro pedido:', error)
      toast('Erro ao atualizar: ' + error.message, 'error')
      return
    }

    toast('Pedido atualizado com sucesso!')

  } else {
    // ── INSERT ────────────────────────────────────────────────────
    const payloadInsert = {
      cliente_id:         clienteId,
      cliente_nome:       clienteNome,
      qtd_total:          qtdTotal,
      preco_unitario:     null,
      subtotal:           grandSubtotal,
      desconto_acrescimo: desconto,
      frete:              frete,
      total_final:        total,
      status_pedido:      'Aguardando confirmação',
      status_pagamento:   statusPagto,
      valor_adiantado:    vPago,
      observacao:         document.getElementById('pedido-obs').value.trim(),
      data_pedido:        new Date().toISOString().split('T')[0],
    }

    const { data, error } = await sb.schema(S).from('pedidos')
      .insert(payloadInsert).select()

    if (error) {
      console.error('Erro pedido:', error)
      toast('Erro ao salvar: ' + error.message, 'error')
      return
    }

    pedidoId = data[0].id
    toast('Pedido criado!')
  }

  // ── Deleta itens antigos e insere os novos ────────────────────
  const { error: errDel } = await sb.schema(S).from('itens_pedido')
    .delete().eq('pedido_id', pedidoId)
  if (errDel) console.error('Erro ao deletar itens:', errDel)

  const arrayItens = todosItens.map(i => ({ ...i, pedido_id: pedidoId }))
  const { error: errItens } = await sb.schema(S).from('itens_pedido').insert(arrayItens)
  if (errItens) console.error('Erro Itens:', errItens)

  fecharModal('modal-pedido')
  loadPedidos()
  loadDashboard()
}

  // ── Coleta todos os itens de todos os blocos ──────────────────
  const todosBlocos = Array.from(document.querySelectorAll('#container-itens-pedido .bloco-item'))
  const todosItens  = []

  todosBlocos.forEach(bloco => {
    const produtoId   = bloco.dataset.produtoId   || null
    const produtoNome = bloco.dataset.produtoNome || ''
    bloco.querySelectorAll('.var-row').forEach(row => {
      const variacao   = row.querySelector('.var-nome')?.value?.trim() || ''
      const quantidade = parseInt(row.querySelector('.var-qtd')?.value) || 0
      if (variacao && quantidade > 0)
        todosItens.push({ produto_id: produtoId, produto_nome: produtoNome, variacao, quantidade })
    })
  })

  if (!todosItens.length) {
    toast('Adicione pelo menos um produto com variação e quantidade', 'error')
    return
  }

  // ── Calcula subtotal por bloco (cada produto usa sua própria faixa) ──
  let grandSubtotal = 0
  let hasError      = false

  for (const bloco of todosBlocos) {
    const produtoId = bloco.dataset.produtoId
    const prod      = produtosCarregados.find(x => x.id === produtoId) || null
    const precos    = (prod?.produto_precos || []).sort((a, b) => a.qtd_minima - b.qtd_minima)

    const blocoQtd = Array.from(bloco.querySelectorAll('.var-row'))
      .reduce((s, row) => s + (parseInt(row.querySelector('.var-qtd')?.value) || 0), 0)

    if (blocoQtd === 0) continue

    if (!produtoId) { toast('Selecione um produto em cada bloco', 'error'); hasError = true; break }

    if (precos.length > 0) {
      const minQtd     = Math.min(...precos.map(p => p.qtd_minima))
      if (blocoQtd < minQtd) {
        toast(`Quantidade mínima para "${bloco.dataset.produtoNome}" é ${minQtd} un`, 'error')
        hasError = true
        break
      }
      const aplicaveis = precos.filter(p => blocoQtd >= p.qtd_minima)
      if (aplicaveis.length) {
        const preco = parseFloat(aplicaveis.reduce((best, p) => p.qtd_minima > best.qtd_minima ? p : best).preco_unitario)
        grandSubtotal += blocoQtd * preco
      }
    }
  }

  if (hasError) return

  const qtdTotal       = todosItens.reduce((s, i) => s + i.quantidade, 0)
  const desconto       = parseMoeda(document.getElementById('pedido-desconto').value)
  const frete          = parseMoeda(document.getElementById('pedido-frete').value)
  const total          = grandSubtotal + desconto + frete
  const valorAdiantado = parseMoeda(document.getElementById('pedido-adiantado').value)

  // Nome do produto para a coluna resumo da tabela pedidos
  const nomesUnicos = [...new Set(todosItens.map(i => i.produto_nome).filter(Boolean))]
  const produtoStr  = nomesUnicos.length > 0 ? nomesUnicos.join(', ') : '—'

  // Status de pagamento calculado
  const vPago  = parseFloat(valorAdiantado) || 0
  const vTotal = parseFloat(total)          || 0
  let statusPagto = 'Aguardando Pagamento'
  if (vTotal > 0 && vPago >= vTotal)    statusPagto = 'Pago Integral'
  else if (vPago > 0 && vPago < vTotal) statusPagto = 'Pago Parcialmente'

  if (editId) {
    // ── UPDATE — sem tocar em status_pedido ─────────────────────
    const payloadEdicao = {
      cliente_id:         clienteId,
      cliente_nome:       clienteNome,
      produto:            produtoStr,
      qtd_total:          qtdTotal,
      preco_unitario:     null,
      subtotal:           grandSubtotal,
      desconto_acrescimo: desconto,
      frete:              frete,
      total_final:        total,
      observacao:         document.getElementById('pedido-obs').value.trim(),
      valor_adiantado:    vPago,
      status_pagamento:   statusPagto,
    }

    const { error } = await sb.schema(S).from('pedidos').update(payloadEdicao).eq('id', editId)
    if (error) { toast('Erro ao atualizar: ' + error.message, 'error'); return }

    await sb.schema(S).from('itens_pedido').delete().eq('pedido_id', editId)
    if (todosItens.length)
      await sb.schema(S).from('itens_pedido').insert(
        todosItens.map(i => ({ ...i, pedido_id: editId }))
      )

    toast('Pedido atualizado com sucesso!')

  } else {
    // ── INSERT ──────────────────────────────────────────────────
    const payloadInsert = {
      cliente_id:         clienteId,
      cliente_nome:       clienteNome,
      produto:            produtoStr,
      qtd_total:          qtdTotal,
      preco_unitario:     null,
      subtotal:           grandSubtotal,
      desconto_acrescimo: desconto,
      frete:              frete,
      total_final:        total,
      status_pedido:      'Aguardando confirmação',
      status_pagamento:   statusPagto,
      valor_adiantado:    vPago,
      observacao:         document.getElementById('pedido-obs').value.trim(),
      data_pedido:        new Date().toISOString().split('T')[0],
    }

    const { data: pedido, error } = await sb.schema(S).from('pedidos')
      .insert(payloadInsert).select().single()
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

    if (todosItens.length)
      await sb.schema(S).from('itens_pedido').insert(
        todosItens.map(i => ({ ...i, pedido_id: pedido.id }))
      )

    toast(`Pedido ${pedido.codigo} criado!`)
  }

  fecharModal('modal-pedido')
  loadPedidos()
  loadDashboard()

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

// ── Templates de mensagens ────────────────────────────────────────
let templatesMensagem = {}

const TEMPLATES_PADRAO = {
  msg_resumo:
`🍒 *Cherry Bomb Handmade*
━━━━━━━━━━━━━━━━━━━━
📦 *Resumo do seu pedido*
Código: *{{codigo}}*

*Produto:* {{produto}}
*Itens:*
{{itens}}

💰 *Valores*
Subtotal: {{subtotal}}
{{frete_linha}}{{desconto_linha}}*Total: {{total}}*
━━━━━━━━━━━━━━━━━━━━
✅ Valor pago: {{pago}}
🔴 Ainda a receber: *{{receber}}*

Qualquer dúvida é só chamar! 🍒`,

  msg_status_producao:
`Oie {{nome}}! 🍒

Passando pra avisar que o seu pedido *{{codigo}}* já entrou em produção e está sendo feito com muito carinho!
{{previsao_linha}}Assim que ficar prontinho eu te aviso. 💕`,

  msg_status_pronto:
`Oie {{nome}}! 🍒

Suas lindezas ficaram prontas e já estão na bancada de expedição! 🎀📦

Assim que você confirmar o acerto do restante (*{{receber}}*), eu já libero o rastreio pra você! ✨`,

  msg_status_enviado:
`Oie {{nome}}! 🍒

O seu pedido *{{codigo}}* foi enviado hoje e já está a caminho! 📦🚚

Assim que eu tiver o código de rastreio eu mando aqui pra você acompanhar. 💕`
}

async function carregarTemplates() {
  const { data, error } = await sb.schema(S).from('configuracoes').select('chave, valor')
  if (error || !data?.length) {
    templatesMensagem = { ...TEMPLATES_PADRAO }
    return
  }
  templatesMensagem = { ...TEMPLATES_PADRAO }
  data.forEach(row => { templatesMensagem[row.chave] = row.valor })
}

async function loadMensagens() {
  await carregarTemplates()
  Object.keys(TEMPLATES_PADRAO).forEach(chave => {
    const el = document.getElementById(`tmpl-${chave}`)
    if (el) el.value = templatesMensagem[chave] || ''
  })
}

async function salvarTemplates() {
  const upserts = Object.keys(TEMPLATES_PADRAO).map(chave => {
    const el = document.getElementById(`tmpl-${chave}`)
    return { chave, valor: el?.value || TEMPLATES_PADRAO[chave] }
  })

  for (const row of upserts) {
    await sb.schema(S).from('configuracoes')
      .upsert({ chave: row.chave, valor: row.valor }, { onConflict: 'chave' })
  }

  await carregarTemplates()
  toast('Templates salvos com sucesso!')
}

async function resetarTemplates() {
  if (!confirm('Deseja restaurar todos os templates para o texto padrão? As suas edições serão perdidas.')) return

  for (const [chave, valor] of Object.entries(TEMPLATES_PADRAO)) {
    await sb.schema(S).from('configuracoes')
      .upsert({ chave, valor }, { onConflict: 'chave' })
    const el = document.getElementById(`tmpl-${chave}`)
    if (el) el.value = valor
  }

  await carregarTemplates()
  toast('Templates restaurados para o padrão!')
}

// ── Processador de templates ──────────────────────────────────────
function formatarMensagem(template, p) {
  const subtotal  = parseFloat(p.subtotal)           || 0
  const frete     = parseFloat(p.frete)              || 0
  const desconto  = parseFloat(p.desconto_acrescimo) || 0
  const total     = parseFloat(p.total_final)        || 0
  const adiantado = parseFloat(p.valor_adiantado)    || 0
  const restante  = total - adiantado
  const nome      = (p.cliente_nome || '').split(' ')[0]

  const itens = (p.itens_pedido || [])
    .map(i => `   • ${i.quantidade}x ${i.variacao}`)
    .join('\n')

  const freteLinha    = frete > 0   ? `Frete: + ${brl(frete)}\n` : ''
  const descontoLinha = desconto !== 0
    ? `${desconto < 0 ? 'Desconto' : 'Acréscimo'}: ${desconto < 0 ? '− ' + brl(Math.abs(desconto)) : '+ ' + brl(desconto)}\n`
    : ''

  const previsaoLinha = p.data_previsao
    ? `\nA previsão de envio é para o dia *${
        new Date(p.data_previsao + 'T12:00:00')
          .toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
      }*! 🍒✂️`
    : ''

  const dataHoje = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })

  return template
    .replace(/{{nome}}/g,           nome)
    .replace(/{{codigo}}/g,         p.codigo           || '—')
    .replace(/{{produto}}/g,        p.produto          || '—')
    .replace(/{{itens}}/g,          itens              || '—')
    .replace(/{{subtotal}}/g,       brl(subtotal))
    .replace(/{{frete_linha}}/g,    freteLinha)
    .replace(/{{desconto_linha}}/g, descontoLinha)
    .replace(/{{total}}/g,          brl(total))
    .replace(/{{pago}}/g,           brl(adiantado))
    .replace(/{{receber}}/g,        brl(restante))
    .replace(/{{previsao_linha}}/g, previsaoLinha)
    .replace(/{{rastreio}}/g,       p.codigo_rastreio || 'Em breve')
    .replace(/{{data}}/g,           dataHoje)
}

// ── Produtos ──────────────────────────────────────────────────────
let produtosCarregados    = []
let produtoAtualVariacoes = []
let produtoAtualPrecos    = []

async function loadProdutos() {
  const { data, error } = await sb.schema(S).from('produtos')
    .select('*, produto_variacoes(*), produto_precos(*)')
    .order('nome')
  if (error) { toast('Erro ao carregar produtos: ' + error.message, 'error'); return }
  produtosCarregados = data || []
  renderProdutoCards(produtosCarregados)
}

function renderProdutoCards(lista) {
  const grid = document.getElementById('produtos-grid')
  if (!grid) return

  if (!lista.length) {
    grid.innerHTML = `<div style="text-align:center; padding:60px 20px; color:var(--hint); grid-column:1/-1;">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px; display:block; opacity:0.3;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      <p style="font-weight:800; font-size:14px; color:var(--muted);">Nenhum produto cadastrado</p>
      <p style="font-size:13px; margin-top:4px;">Clique em "+ Novo produto" para começar</p>
    </div>`
    return
  }

  grid.innerHTML = lista.map(p => {
    const vars   = (p.produto_variacoes || []).sort((a, b) => a.nome.localeCompare(b.nome))
    const precos = (p.produto_precos    || []).sort((a, b) => a.qtd_minima - b.qtd_minima)

    const varTags  = vars.length
      ? vars.map(v => `<span class="var-tag">${v.nome}</span>`).join('')
      : `<span style="color:var(--hint);font-size:12px;">Sem variações</span>`

    const precoStr = precos.length
      ? precos.map(pr => `${pr.qtd_minima}un = ${brl(pr.preco_unitario)}`).join(' &middot; ')
      : `<span style="color:var(--hint);">Sem preços</span>`

    return `
      <div class="produto-card ${p.ativo ? '' : 'produto-card-inativo'}">
        <div class="produto-card-header">
          <span class="produto-card-nome">${p.nome}</span>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
            <span class="badge ${p.ativo ? 'badge-green' : 'badge-gray'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>
            <div class="dropdown" id="dd-prod-${p.id}">
              <button class="btn-icon dropdown-trigger" onclick="toggleDropdown('dd-prod-${p.id}')">⋮</button>
              <div class="dropdown-content">
                <button class="dropdown-item" onclick="abrirModalEditarProduto('${p.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button class="dropdown-item" onclick="toggleAtivoProduto('${p.id}', ${!p.ativo})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                  ${p.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button class="dropdown-item dropdown-item-danger" onclick="abrirModalExcluirProduto('${p.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
        ${p.descricao ? `<p class="produto-card-desc">${p.descricao}</p>` : ''}
        <div class="produto-card-vars">${varTags}</div>
        <div class="produto-card-precos">${precoStr}</div>
      </div>`
  }).join('')
}

function abrirModalProduto() {
  document.getElementById('form-produto').reset()
  document.getElementById('prod-id').value = ''
  document.getElementById('prod-ativo').checked = true
  document.getElementById('prod-variacoes-list').innerHTML = ''
  document.getElementById('prod-precos-list').innerHTML = ''
  document.getElementById('modal-produto-titulo').textContent = 'Novo Produto'
  addVariacaoProduto()
  addFaixaPreco()
  document.getElementById('modal-produto').classList.add('open')
}

function abrirModalEditarProduto(id) {
  const p = produtosCarregados.find(x => x.id === id)
  if (!p) { toast('Produto não encontrado', 'error'); return }

  document.getElementById('prod-id').value    = p.id
  document.getElementById('prod-nome').value  = p.nome       || ''
  document.getElementById('prod-desc').value  = p.descricao  || ''
  document.getElementById('prod-ativo').checked = p.ativo !== false
  document.getElementById('toggle-ativo-label').textContent = p.ativo !== false ? 'Ativo' : 'Inativo'

  const varList = document.getElementById('prod-variacoes-list')
  varList.innerHTML = ''
  const vars = (p.produto_variacoes || []).sort((a, b) => a.nome.localeCompare(b.nome))
  vars.length ? vars.forEach(v => addVariacaoProduto(v.nome)) : addVariacaoProduto()

  const precoList = document.getElementById('prod-precos-list')
  precoList.innerHTML = ''
  const precos = (p.produto_precos || []).sort((a, b) => a.qtd_minima - b.qtd_minima)
  precos.length ? precos.forEach(pr => addFaixaPreco(pr.qtd_minima, pr.preco_unitario)) : addFaixaPreco()

  document.getElementById('modal-produto-titulo').textContent = `Editar: ${p.nome}`
  document.getElementById('modal-produto').classList.add('open')
}

function addVariacaoProduto(value = '') {
  const div = document.createElement('div')
  div.className = 'var-row'
  div.style.gridTemplateColumns = '1fr 30px'
  div.innerHTML = `
    <input type="text" placeholder="Nome da variação (ex: Vermelho)" class="prod-var-nome" value="${value}">
    <button type="button" class="btn-rm-var" onclick="this.parentElement.remove()">×</button>
  `
  document.getElementById('prod-variacoes-list').appendChild(div)
}

function addFaixaPreco(qtd = '', preco = '') {
  const div = document.createElement('div')
  div.className = 'preco-row'
  div.innerHTML = `
    <span class="preco-row-label">A partir de</span>
    <input type="number" placeholder="1" class="preco-qtd" min="1" step="1" value="${qtd}" inputmode="numeric">
    <span class="preco-row-label">un = R$</span>
    <input type="number" placeholder="0,00" class="preco-val" min="0" step="0.01" inputmode="decimal" value="${preco}">
    <button type="button" class="btn-rm-var" onclick="this.parentElement.remove()">×</button>
  `
  document.getElementById('prod-precos-list').appendChild(div)
}

async function salvarProduto(e) {
  e.preventDefault()
  const id = document.getElementById('prod-id').value

  const variacoes = Array.from(document.querySelectorAll('.prod-var-nome'))
    .map(i => i.value.trim()).filter(Boolean)

  const precos = Array.from(document.querySelectorAll('.preco-row'))
    .map(row => ({
      qtd_minima:     parseInt(row.querySelector('.preco-qtd').value)   || 0,
      preco_unitario: parseFloat(row.querySelector('.preco-val').value) || 0,
    }))
    .filter(p => p.qtd_minima > 0 && p.preco_unitario > 0)

  const payload = {
    nome:      document.getElementById('prod-nome').value.trim(),
    descricao: document.getElementById('prod-desc').value.trim(),
    ativo:     document.getElementById('prod-ativo').checked,
  }

  if (!payload.nome)  { toast('Nome é obrigatório', 'error'); return }
  if (!precos.length) { toast('Adicione ao menos uma faixa de preço', 'error'); return }

  let prodId = id

  if (id) {
    const { error } = await sb.schema(S).from('produtos').update(payload).eq('id', id)
    if (error) { toast('Erro ao atualizar: ' + error.message, 'error'); return }
  } else {
    const { data, error } = await sb.schema(S).from('produtos').insert(payload).select().single()
    if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }
    prodId = data.id
  }

  await sb.schema(S).from('produto_variacoes').delete().eq('produto_id', prodId)
  if (variacoes.length)
    await sb.schema(S).from('produto_variacoes').insert(variacoes.map(nome => ({ produto_id: prodId, nome })))

  await sb.schema(S).from('produto_precos').delete().eq('produto_id', prodId)
  if (precos.length)
    await sb.schema(S).from('produto_precos').insert(precos.map(p => ({ ...p, produto_id: prodId })))

  toast(id ? 'Produto atualizado!' : 'Produto cadastrado!')
  fecharModal('modal-produto')
  loadProdutos()
}

function abrirModalExcluirProduto(id) {
  const p = produtosCarregados.find(x => x.id === id)
  if (!p) return
  document.getElementById('exc-prod-id').value         = id
  document.getElementById('exc-prod-nome').textContent = p.nome
  document.getElementById('modal-excluir-produto').classList.add('open')
}

async function confirmarExclusaoProduto() {
  const id = document.getElementById('exc-prod-id').value
  if (!id) return
  const { error } = await sb.schema(S).from('produtos').delete().eq('id', id)
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return }
  toast('Produto excluído!')
  fecharModal('modal-excluir-produto')
  loadProdutos()
}

async function toggleAtivoProduto(id, novoStatus) {
  const { error } = await sb.schema(S).from('produtos').update({ ativo: novoStatus }).eq('id', id)
  if (error) { toast('Erro: ' + error.message, 'error'); return }
  toast(novoStatus ? 'Produto ativado!' : 'Produto desativado!')
  loadProdutos()
}

// ── Configurações ─────────────────────────────────────────────────
let ultimaConfigTab = 'clientes'

function loadConfig() {
  switchConfigTab(ultimaConfigTab)
}

function switchConfigTab(tab) {
  ultimaConfigTab = tab
  document.querySelectorAll('.config-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab)
  })
  document.querySelectorAll('.config-panel').forEach(p => {
    p.style.display = p.id === `config-tab-${tab}` ? 'block' : 'none'
  })
  if (tab === 'clientes')     loadClientes()
  if (tab === 'financeiro')   loadLancamentos()
  if (tab === 'produtos')     loadProdutos()
  if (tab === 'mensagens')    loadMensagens()
  if (tab === 'calculadora')  calcularPrecificacao()
}

// ── Lançamentos Financeiros ───────────────────────────────────────
let lancamentosCarregados = []

async function loadLancamentos() {
  const { data, error } = await sb.schema(S).from('lancamentos')
    .select('*').order('data', { ascending: false })
  if (error) { toast('Erro ao carregar lançamentos: ' + error.message, 'error'); return }

  lancamentosCarregados = data

  document.getElementById('lancamentos-tbody').innerHTML =
    data.length
      ? data.map(l => `
          <tr>
            <td class="td-secondary">${fmtData(l.data)}</td>
            <td><strong>${l.descricao}</strong></td>
            <td>${l.tipo === 'entrada'
              ? '<span class="badge badge-green">Entrada</span>'
              : '<span class="badge badge-red">Saída</span>'}</td>
            <td style="font-weight:800; color:${l.tipo === 'entrada' ? 'var(--cherry-dark)' : '#991b1b'};">
              ${l.tipo === 'entrada' ? '+' : '−'} ${brl(l.valor)}
            </td>
            <td class="td-secondary">${l.observacao || '—'}</td>
            <td>
              <div class="dropdown" id="dd-lanc-${l.id}">
                <button class="btn-icon dropdown-trigger" onclick="toggleDropdown('dd-lanc-${l.id}')">⋮</button>
                <div class="dropdown-content">
                  <button class="dropdown-item" onclick="abrirModalEditarLancamento('${l.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                  <button class="dropdown-item dropdown-item-danger" onclick="abrirModalExcluirLancamento('${l.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                    Excluir
                  </button>
                </div>
              </div>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nenhum lançamento registrado ainda</td></tr>'
}

function abrirModalLancamento() {
  document.getElementById('form-lancamento').reset()
  document.getElementById('lanc-id').value   = ''
  document.getElementById('lanc-data').value = new Date().toISOString().split('T')[0]
  document.getElementById('modal-lancamento-titulo').textContent = 'Novo Lançamento'
  document.getElementById('modal-lancamento').classList.add('open')
}

function abrirModalEditarLancamento(id) {
  const l = lancamentosCarregados.find(x => x.id === id)
  if (!l) { toast('Lançamento não encontrado', 'error'); return }

  document.getElementById('lanc-id').value    = l.id
  document.getElementById('lanc-desc').value  = l.descricao  || ''
  document.getElementById('lanc-tipo').value  = l.tipo       || 'entrada'
  document.getElementById('lanc-valor').value = l.valor      || 0
  document.getElementById('lanc-data').value  = l.data ? l.data.split('T')[0] : ''
  document.getElementById('lanc-obs').value   = l.observacao || ''

  document.getElementById('modal-lancamento-titulo').textContent = `Editar: ${l.descricao}`
  document.getElementById('modal-lancamento').classList.add('open')
}

function abrirModalExcluirLancamento(id) {
  const l = lancamentosCarregados.find(x => x.id === id)
  if (!l) return
  document.getElementById('exc-lanc-id').value          = id
  document.getElementById('exc-lanc-nome').textContent  = l.descricao
  document.getElementById('modal-excluir-lancamento').classList.add('open')
}

async function confirmarExclusaoLancamento() {
  const id = document.getElementById('exc-lanc-id').value
  if (!id) return
  const { error } = await sb.schema(S).from('lancamentos').delete().eq('id', id)
  if (error) { toast('Erro ao excluir: ' + error.message, 'error'); return }
  toast('Lançamento excluído!')
  fecharModal('modal-excluir-lancamento')
  loadLancamentos()
  loadDashboard()
}

async function salvarLancamento(e) {
  e.preventDefault()
  const id = document.getElementById('lanc-id').value
  const payload = {
    descricao:  document.getElementById('lanc-desc').value.trim(),
    tipo:       document.getElementById('lanc-tipo').value,
    valor:      parseFloat(document.getElementById('lanc-valor').value) || 0,
    data:       document.getElementById('lanc-data').value,
    observacao: document.getElementById('lanc-obs').value.trim(),
  }
  if (!payload.descricao || payload.valor <= 0) { toast('Preencha descrição e valor válido', 'error'); return }

  let error
  if (id) {
    const res = await sb.schema(S).from('lancamentos').update(payload).eq('id', id)
    error = res.error
  } else {
    const res = await sb.schema(S).from('lancamentos').insert(payload)
    error = res.error
  }
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  toast(id ? 'Lançamento atualizado!' : 'Lançamento registrado!')
  fecharModal('modal-lancamento')
  loadLancamentos()
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
                  <button class="dropdown-item" onclick="event.stopPropagation(); abrirModalEditarCliente('${c.id}')">
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
  // esconde histórico em novo cadastro
  document.getElementById('cliente-historico-secao').style.display = 'none'
  document.getElementById('modal-cliente').classList.add('open')
}

function abrirModalClienteRapido() {
  abrirModalCliente()
}

async function carregarHistoricoCliente(clienteId) {
  const secao = document.getElementById('cliente-historico-secao')
  const lista = document.getElementById('cliente-historico-lista')
  if (!secao || !lista) return

  secao.style.display = 'block'
  lista.innerHTML = '<p class="cli-historico-vazio">Carregando...</p>'

  const { data, error } = await sb.schema(S)
    .from('pedidos')
    .select('id, codigo, data_pedido, produto, total_final, status_pedido, status_pagamento')
    .eq('cliente_id', clienteId)
    .order('data_pedido', { ascending: false })

  if (error) {
    lista.innerHTML = '<p class="cli-historico-vazio">Erro ao carregar histórico.</p>'
    return
  }

  if (!data || !data.length) {
    lista.innerHTML = '<p class="cli-historico-vazio">Nenhuma encomenda registrada para este cliente.</p>'
    return
  }

  lista.innerHTML = data.map(p => `
    <div class="cli-historico-item" onclick="fecharModal('modal-cliente'); abrirDetalhesPedido('${p.id}')">
      <span class="cli-historico-data">${fmtData(p.data_pedido)}</span>
      <span class="cli-historico-prod">${p.produto || p.codigo || '—'}</span>
      ${badgePedido(p.status_pedido)}
      <span class="cli-historico-valor">${brl(p.total_final)}</span>
    </div>
  `).join('')
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
  carregarHistoricoCliente(c.id)
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

  // ── Verificação de duplicidade (apenas em novos cadastros) ────
  if (!editId) {
    let query = sb.schema(S).from('clientes').select('id, nome, contato').limit(5)

    const filtros = []
    if (payload.nome)    filtros.push(`nome.ilike.${payload.nome}`)
    if (payload.contato) filtros.push(`contato.eq.${payload.contato}`)

    if (filtros.length) {
      const { data: duplicados } = await query.or(filtros.join(','))

      if (duplicados && duplicados.length > 0) {
        const encontrado = duplicados[0]
        const msg = `Atenção! Já existe um cliente cadastrado com este nome ou contato:\n\n` +
                    `"${encontrado.nome}" — ${encontrado.contato || 'sem contato'}\n\n` +
                    `Deseja prosseguir com o novo cadastro mesmo assim?`

        if (!confirm(msg)) return
      }
    }
  }

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

  // Se o modal de pedido estiver aberto, atualiza o select de clientes
  if (document.getElementById('modal-pedido').classList.contains('open')) {
    const { data: clientes2 } = await sb.schema(S).from('clientes').select('id, nome').order('nome')
    const sel = document.getElementById('pedido-cliente')
    if (sel && clientes2) {
      const valorAtual = sel.value
      sel.innerHTML = '<option value="">Selecione o cliente...</option>' +
        clientes2.map(c => `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('')
      sel.value = valorAtual
    }
  }
}

// ── Compras / Custos ──────────────────────────────────────────────
let comprasCarregadas = [];

async function loadCompras() {
  const { data, error } = await sb.schema(S).from('compras').select('*').order('data_compra', { ascending: false })
  if (error) { toast('Erro ao carregar compras: ' + error.message, 'error'); return }

  comprasCarregadas = data;

  // ── Mini-card de custos ─────────────────────────────────────────
  const totalCustos = data.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
  const mcCustos    = document.getElementById('mc-total-custos')
  if (mcCustos) mcCustos.textContent = brl(totalCustos)

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
                  <button class="dropdown-item" onclick="event.stopPropagation(); abrirModalEditarCompra('${c.id}')">
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

  document.querySelectorAll('.dropdown-content.open')
    .forEach(el => el.classList.remove('open'))

  if (!isOpen) {
    const rect       = trigger.getBoundingClientRect()
    const dropW      = 170
    const margin     = 12
    const vpW        = window.innerWidth

    content.style.top   = `${rect.bottom + 4}px`
    content.style.left  = ''
    content.style.right = ''

    // tenta abrir para a esquerda (padrão)
    const rightAncorado = vpW - rect.right
    if (rightAncorado + rect.width >= dropW) {
      // ancora na borda direita do trigger
      const rightVal = vpW - rect.right
      content.style.right = `${Math.max(margin, rightVal)}px`
    } else {
      // não tem espaço — ancora na margem esquerda segura
      const leftVal = Math.min(rect.left, vpW - dropW - margin)
      content.style.left = `${Math.max(margin, leftVal)}px`
    }

    content.classList.add('open')
  }
}

// ── Fechar dropdowns ao clicar fora ou em item do menu ───────────
document.addEventListener('click', function (e) {
  if (!e.target.closest('.dropdown') || e.target.closest('.dropdown-item')) {
    document.querySelectorAll('.dropdown-content.open')
      .forEach(el => el.classList.remove('open'))
  }
}, true) // fase de captura: ignora stopPropagation dos botões filhos

// ── Modais ────────────────────────────────────────────────────────
function fecharModal(id) {
  const el = document.getElementById(id)
  el.classList.remove('open')
  // fecha qualquer dropdown aberto ao abrir/fechar modais
  document.querySelectorAll('.dropdown-content.open')
    .forEach(d => d.classList.remove('open'))
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
window.salvarAdiantadoDetalhes      = salvarAdiantadoDetalhes
window.toggleValores                = toggleValores
window.switchConfigTab              = switchConfigTab
window.abrirModalLancamento         = abrirModalLancamento
window.abrirModalEditarLancamento   = abrirModalEditarLancamento
window.abrirModalExcluirLancamento  = abrirModalExcluirLancamento
window.confirmarExclusaoLancamento  = confirmarExclusaoLancamento
window.salvarLancamento             = salvarLancamento
window.abrirModalClienteRapido      = abrirModalClienteRapido
window.onProdutoChange              = onProdutoChange
window.adicionarBlocoItem           = adicionarBlocoItem
window.adicionarVarNoBloco          = adicionarVarNoBloco
window.onBlocoProdutoChange         = onBlocoProdutoChange
window.abrirModalProduto            = abrirModalProduto
window.abrirModalEditarProduto      = abrirModalEditarProduto
window.abrirModalExcluirProduto     = abrirModalExcluirProduto
window.confirmarExclusaoProduto     = confirmarExclusaoProduto
window.toggleAtivoProduto           = toggleAtivoProduto
window.salvarProduto                = salvarProduto
window.addVariacaoProduto           = addVariacaoProduto
window.addFaixaPreco                = addFaixaPreco
window.gerarResumoPedido            = gerarResumoPedido
window.avisarStatus                 = avisarStatus
window.copiarMensagem               = copiarMensagem
window.enviarWhatsApp               = enviarWhatsApp
window.salvarTemplates              = salvarTemplates
window.resetarTemplates             = resetarTemplates
window.atualizarStatusPedido        = atualizarStatusPedido
window.onDetStatusChange            = onDetStatusChange
window.carregarHistoricoCliente     = carregarHistoricoCliente
window.calcularPrecificacao         = calcularPrecificacao

// ── Inicialização ─────────────────────────────────────────────────
document.getElementById('today-date').textContent =
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// Esconde splash após dashboard carregar
async function init() {
  await carregarTemplates()
  await navigate('dashboard')
  setTimeout(() => {
    document.getElementById('splash').classList.add('hide')
  }, 600)
}

init()