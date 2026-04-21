// ================================================================
//  🌸 Cherry Bomb — app.js
//  Lógica principal do sistema
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CONFIG } from './config.js' // Verifique se o caminho está correto

// ── Configuração do Supabase ──────────────────────────────────────

// Garantimos que o cliente do Supabase use as chaves do config.js
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY)
// O nome do schema no banco é 'cherry_bomb' (com underline), verifique se no seu config.js está assim.
const S = CONFIG.SCHEMA || 'cherry_bomb'

// ── Utilitários ───────────────────────────────────────────────────
function brl(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

function fmtData(d) {
  if (!d) return '—'
  // Lê a data que vem do banco e converte para o fuso horário local
  const data = new Date(d);
  if (isNaN(data.getTime())) return '—'; 
  return data.toLocaleDateString('pt-BR');
}

function calcPreco(qtd) {
  if (qtd < 10) return null   // abaixo do mínimo
  if (qtd < 20) return 8      // 10–19 un
  if (qtd < 50) return 6      // 20–49 un
  return 5                    // 50+ un
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
    'Pendente':       'badge-gray',
    '50% pago':       'badge-blue',
    'Pago integral':  'badge-green',
    'Reembolsado':    'badge-red',
  }
  return `<span class="badge ${mapa[status] || 'badge-gray'}">${status || '—'}</span>`
}

// ── Navegação ─────────────────────────────────────────────────────
function navigate(pagina) {
  document.querySelectorAll('.nav-btn').forEach(b => {
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
// ── Dashboard ─────────────────────────────────────────────────────
async function loadDashboard() {
  // Dica de Sênior: Promise.all busca Pedidos e Compras ao mesmo tempo (muito mais rápido!)
  const [resPedidos, resCompras] = await Promise.all([
    sb.schema(S).from('pedidos').select('*'),
    sb.schema(S).from('compras').select('*')
  ])

  if (resPedidos.error) { toast('Erro ao carregar pedidos: ' + resPedidos.error.message, 'error'); return }
  if (resCompras.error) { toast('Erro ao carregar compras: ' + resCompras.error.message, 'error'); return }

  const pedidos = resPedidos.data || []
  const compras = resCompras.data || []

  // 1. Cálculos de Pedidos
  const total       = pedidos.length
  const faturamento = pedidos.reduce((s, p) => s + (p.total_final || 0), 0)
  const emProd      = pedidos.filter(p => p.status_pedido?.toLowerCase().includes('produção')).length
  const pendentes   = pedidos.filter(p => p.status_pagamento === 'Pendente').length

  // 2. Cálculos de Custos e Lucro
  const custos = compras.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)
  const lucro  = faturamento - custos

  // 3. Preenche a tela
  document.getElementById('stat-total').textContent = total
  document.getElementById('stat-fat').textContent   = brl(faturamento)
  document.getElementById('stat-prod').textContent  = emProd
  document.getElementById('stat-pend').textContent  = pendentes
  
  // Preenche os cards novos
  document.getElementById('stat-custos').textContent = brl(custos)
  document.getElementById('stat-lucro').textContent  = brl(lucro)

  // 4. Lista de Recentes
  const recentes = [...pedidos]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

  document.getElementById('recentes-tbody').innerHTML =
    recentes.length
      ? recentes.map(p => `
          <tr>
            <td><span class="code">${p.codigo || '—'}</span></td>
            <td>${p.cliente_nome || '—'}</td>
            <td>${p.produto || '—'}</td>
            <td><strong>${brl(p.total_final)}</strong></td>
            <td>${badgePedido(p.status_pedido)}</td>
            <td>${badgePagto(p.status_pagamento)}</td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nenhum pedido ainda</td></tr>'
}



// ── Pedidos — listagem ────────────────────────────────────────────
let pedidosCarregados = []; // Guarda os pedidos na memória

async function loadPedidos(filtroStatus = '') {
  let query = sb.schema(S).from('pedidos')
    .select('*, itens_pedido(*)')
    .order('created_at', { ascending: false })

  if (filtroStatus) query = query.eq('status_pedido', filtroStatus)
  
  const { data, error } = await query
  if (error) { toast('Erro ao carregar pedidos: ' + error.message, 'error'); return }
  
  // A variável precisa ser preenchida DEPOIS que a busca (query) termina
  pedidosCarregados = data; 

  document.getElementById('pedidos-tbody').innerHTML =
    data.length
      ? data.map(p => {
          const varStr = (p.itens_pedido || [])
            .map(i => `${i.quantidade} ${i.variacao}`).join(', ')
          return `
            <tr>
              <td><span class="code">${p.codigo || '—'}</span></td>
              <td>${fmtData(p.data_pedido)}</td>
              <td><strong>${p.cliente_nome || '—'}</strong></td>
              <td>${p.produto || '—'}</td>
              <td class="vars">${varStr || '—'}</td>
              <td><strong>${p.qtd_total || 0} un</strong></td>
              <td>${p.preco_unitario ? brl(p.preco_unitario) + '/un' : '—'}</td>
              <td><strong>${brl(p.total_final)}</strong></td>
              <td>${badgePedido(p.status_pedido)}</td>
              <td>${badgePagto(p.status_pagamento)}</td>
              <td>
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="abrirDetalhesPedido('${p.id}')">
                  Ver detalhes
                </button>
              </td>
            </tr>`
        }).join('')
      : '<tr><td colspan="11" class="empty">Nenhum pedido encontrado</td></tr>'
}

// ── Pedido — atualizar status (edição rápida) ─────────────────────
// ── Abrir modal de detalhes ───────────────────────────────────────
function abrirDetalhesPedido(id) {
  // Procura o pedido na memória
  const p = pedidosCarregados.find(x => x.id === id);
  if(!p) return;

  // Preenche os textos no HTML
  document.getElementById('det-id').value = p.id;
  document.getElementById('det-codigo').textContent = p.codigo || '—';
  document.getElementById('det-cliente').textContent = p.cliente_nome || '—';
  document.getElementById('det-produto').textContent = p.produto || '—';
  document.getElementById('det-obs').textContent = p.observacao || 'Nenhuma observação.';

  // Monta a lista de cores/variações
  const varStr = (p.itens_pedido || [])
    .map(i => `<strong>${i.quantidade} un</strong> — ${i.variacao}`)
    .join('<br>');
  document.getElementById('det-variacoes').innerHTML = varStr || 'Sem variações registradas.';

  // Seleciona o status atual nos campos
  document.getElementById('det-status-pedido').value = p.status_pedido;
  document.getElementById('det-status-pagamento').value = p.status_pagamento;

  // Abre a janela
  document.getElementById('modal-detalhes').classList.add('open');
}

// ── Salvar o novo status ──────────────────────────────────────────
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
  loadPedidos(); // Recarrega a tabela
  loadDashboard(); // Atualiza os números do início
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
  document.getElementById('variacao-list').innerHTML = ''

  addVariacao()
  addVariacao()
  recalcPedido()

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

  if (!clienteId)      { toast('Selecione um cliente', 'error'); return }
  if (!variacoes.length){ toast('Adicione pelo menos uma variação com quantidade', 'error'); return }
  if (qtdTotal < 10)   { toast('Pedido mínimo: 10 unidades', 'error'); return }

  const desconto  = parseFloat(document.getElementById('pedido-desconto').value) || 0
  const frete     = parseFloat(document.getElementById('pedido-frete').value)    || 0
  const subtotal  = preco * qtdTotal
  const total     = subtotal + desconto + frete

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
    status_pedido:       document.getElementById('pedido-status').value,
    status_pagamento:    document.getElementById('pedido-status-pgto').value,
    observacao:          document.getElementById('pedido-obs').value.trim(),
    data_pedido:         new Date().toISOString().split('T')[0],
  }

  const { data: pedido, error } = await sb.schema(S).from('pedidos').insert(pedidoPayload).select().single()

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  // Salva as variações (itens)
  if (variacoes.length) {
    const itens = variacoes.map(v => ({ ...v, pedido_id: pedido.id }))
    await sb.schema(S).from('itens_pedido').insert(itens)
  }

  toast(`Pedido ${pedido.codigo} criado!`)
  fecharModal('modal-pedido')
  loadPedidos()
  loadDashboard()
}

// ── Clientes ──────────────────────────────────────────────────────
async function loadClientes() {
  const { data, error } = await sb.schema(S).from('clientes').select('*').order('nome')
  if (error) { toast('Erro ao carregar clientes: ' + error.message, 'error'); return }

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
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nenhum cliente cadastrado ainda</td></tr>'
}

function abrirModalCliente() {
  document.getElementById('form-cliente').reset()
  document.getElementById('modal-cliente').classList.add('open')
}

async function salvarCliente(e) {
  e.preventDefault()

  const payload = {
    nome:      document.getElementById('cli-nome').value.trim(),
    contato:   document.getElementById('cli-contato').value.trim(),
    cep:       document.getElementById('cli-cep').value.trim(),
    cidade:    document.getElementById('cli-cidade').value.trim(),
    observacao:document.getElementById('cli-obs').value.trim(),
  }

  if (!payload.nome) { toast('Nome é obrigatório', 'error'); return }

  const { error } = await sb.schema(S).from('clientes').insert(payload)
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  toast('Cliente cadastrado!')
  fecharModal('modal-cliente')
  loadClientes()
}
// ── Compras / Custos ──────────────────────────────────────────────
let comprasCarregadas = []; // Guarda as compras na memória para poder editar

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
              <button class="btn-icon" title="Editar" onclick="editarCompra('${c.id}')">✏️</button>
              <button class="btn-icon" title="Excluir" onclick="abrirModalExcluirCompra('${c.id}')" style="color: #991b1b;">🗑️</button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nenhuma compra registrada ainda</td></tr>'
}

function abrirModalCompra() {
  document.getElementById('form-compra').reset()
  document.getElementById('comp-id').value = '' // Limpa o ID para nova compra
  document.getElementById('comp-data').value = new Date().toISOString().split('T')[0]
  document.getElementById('modal-compra').classList.add('open')
}

// ── Editar Compra (Blindado contra erros de data)
function editarCompra(id) {
  const c = comprasCarregadas.find(x => x.id === id);
  if(!c) { toast('Erro ao buscar compra', 'error'); return; }

  document.getElementById('comp-id').value = c.id; 
  document.getElementById('comp-desc').value = c.descricao || '';
  document.getElementById('comp-cat').value = c.categoria || 'Outros';
  document.getElementById('comp-valor').value = c.valor || 0;
  
  // Tratamento seguro da data para voltar pro campo
  const dataFormatada = c.data_compra ? c.data_compra.split('T')[0] : '';
  document.getElementById('comp-data').value = dataFormatada;
  
  document.getElementById('comp-obs').value = c.observacao || '';

  document.getElementById('modal-compra').classList.add('open');
}

// ── Funções do Novo Modal de Exclusão
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
  loadDashboard(); // Atualiza a matemática do Dashboard
}

// ── Salvar ou Atualizar
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
// Salva (Insert) ou Atualiza (Update) dependendo do campo oculto
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
    // Se tem ID, ATUALIZA
    const res = await sb.schema(S).from('compras').update(payload).eq('id', id);
    error = res.error;
  } else {
    // Se não tem ID, CRIA NOVO
    const res = await sb.schema(S).from('compras').insert(payload);
    error = res.error;
  }

  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return }

  toast(id ? 'Custo atualizado!' : 'Novo custo registrado!')
  fecharModal('modal-compra')
  loadCompras()
  loadDashboard() // Atualiza a matemática do Dashboard
}
// ── Modais ────────────────────────────────────────────────────────
function fecharModal(id) {
  document.getElementById(id).classList.remove('open')
}

function fecharSeBackdrop(e, id) {
  if (e.target.id === id) fecharModal(id)
}

// ── Expõe funções para o HTML ─────────────────────────────────────
window.navigate              = navigate
window.abrirModalPedido      = abrirModalPedido
window.abrirModalCliente     = abrirModalCliente
window.fecharModal           = fecharModal
window.fecharSeBackdrop      = fecharSeBackdrop
window.addVariacao           = addVariacao
window.recalcPedido          = recalcPedido
window.salvarPedido          = salvarPedido
window.salvarCliente         = salvarCliente
window.loadPedidos           = loadPedidos
window.abrirDetalhesPedido   = abrirDetalhesPedido // <--- Função NOVA aqui
window.salvarNovoStatus      = salvarNovoStatus    // <--- Função NOVA aqui
window.loadCompras           = loadCompras
window.abrirModalCompra      = abrirModalCompra
window.salvarCompra          = salvarCompra
window.loadCompras           = loadCompras
window.editarCompra          = editarCompra  // <--- NOVA
window.excluirCompra         = excluirCompra // <--- NOVA
window.loadCompras             = loadCompras
window.abrirModalCompra        = abrirModalCompra
window.abrirModalExcluirCompra = abrirModalExcluirCompra
window.confirmarExclusao       = confirmarExclusao

// ── Inicialização ─────────────────────────────────────────────────
document.getElementById('today-date').textContent =
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

navigate('dashboard')