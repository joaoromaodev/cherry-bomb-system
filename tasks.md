import os

# Conteúdo do arquivo Markdown de Tasks
tasks_content = """# 🚀 Plano de Atualizações: Sistema Cherry Bomb

Este documento detalha as próximas implementações técnicas para transformar o sistema em uma ferramenta de gestão completa (CRUD).

---

## 📅 Task 1: Gestão de Pedidos (Aba Pedidos)
**Objetivo:** Permitir a edição de erros e a remoção de encomendas canceladas.

- [ ] **Interface (HTML/CSS):**
    - Adicionar coluna "Ações" na tabela de pedidos.
    - Incluir botões de ícone: `✏️ (Editar)` e `🗑️ (Excluir)`.
- [ ] **Lógica (JS):**
    - Criar função `abrirModalEditarPedido(id)`: deve buscar os dados no Supabase e preencher o formulário de "Novo Pedido".
    - Alterar a lógica de salvamento para identificar se é um `INSERT` (novo) ou `UPDATE` (edição).
    - Criar função `excluirPedido(id)` com alerta de confirmação (`confirm()`).

---

## 👥 Task 2: Gestão de Clientes (Aba Clientes)
**Objetivo:** Manter a base de contatos atualizada e limpa.

- [ ] **Interface (HTML/CSS):**
    - Inserir botões de ação na listagem de clientes.
- [ ] **Lógica (JS):**
    - Criar função `editarCliente(id)`: carregar Nome, Contato e Endereço no modal de cadastro.
    - Criar função `excluirCliente(id)`: validar se o cliente não possui pedidos vinculados antes de permitir a exclusão (integridade de dados).

---

## 🛒 Task 3: Correção do Módulo de Compras (Aba Compras)
**Objetivo:** Restaurar a funcionalidade de registro de custos e saídas.

- [ ] **Debug:**
    - Verificar se o ID do botão "Adicionar Compras" no HTML (`id="btn-add-compra"`) está mapeado corretamente no `addEventListener` do `app.js`.
- [ ] **Lógica (JS):**
    - Garantir que `abrirModalCompra()` limpe o campo oculto de ID para evitar sobreposição de dados.
    - Validar o cálculo: cada compra salva deve disparar automaticamente o `loadDashboard()` para atualizar o Lucro Líquido.

---

## 🎨 Task 4: UI/UX — Sidebar Retrátil
**Objetivo:** Otimizar o espaço de trabalho para visualização de tabelas grandes.

- [ ] **Estilização (CSS):**
    - Criar classe `.sidebar-collapsed` (largura reduzida para ~60px).
    - Ocultar textos do menu (`span`) e manter apenas os ícones quando colapsada.
    - Adicionar `transition: 0.3s` para um efeito suave.
- [ ] **Interatividade (JS):**
    - Adicionar botão de "Hambúrguer" no topo da Sidebar.
    - Criar função `toggleSidebar()` para alternar as classes CSS.

---

## 🛠️ Notas Técnicas
- **Recálculo de Preço:** Na edição de pedidos, a lógica de automação de valor (ex: 50un = R$ 5,00) deve ser reexecutada caso a quantidade seja alterada.
- **Segurança:** Todas as funções de exclusão devem solicitar confirmação do usuário para evitar perda acidental de dados.
"""

file_path = 'TASKS_ATUALIZACAO.md'

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(tasks_content)