# 🍒 Documentação de Contexto: Sistema Cherry Bomb

## 📌 Visão Geral do Projeto
O **Sistema Cherry Bomb** é uma aplicação web mobile-first para gestão completa de encomendas de produtos artesanais (handmade). Desenvolvida para a marca Cherry Bomb — especializada em scrunchies e acessórios de cetim/veludo — o sistema substitui planilhas e cadernos por uma plataforma acessível via browser (PC e mobile), com banco de dados real na nuvem e identidade visual fiel à marca.

---

## 🛠️ Stack Tecnológico
- **Frontend:** HTML5, CSS3, JavaScript Vanilla (ESModules)
- **Backend/Database:** Supabase (PostgreSQL) — schema `public`
- **Hospedagem:** Vercel (deploy automático via GitHub)
- **Fontes:** Dancing Script (marca) + Nunito (UI) via Google Fonts
- **PWA:** Instalável no celular com ícone e splash screen

---

## 🗄️ Estrutura do Banco de Dados (schema: public)

### Tabelas principais
| Tabela | Descrição |
|---|---|
| `clientes` | Cadastro de clientes com código automático CLI-XXX |
| `pedidos` | Encomendas com código automático CB-XXX |
| `itens_pedido` | Variações e quantidades de cada pedido (CASCADE) |
| `compras` | Registro de custos e saídas financeiras |
| `lancamentos` | Lançamentos manuais de caixa (aportes, retiradas) |
| `produtos` | Catálogo de produtos da marca |
| `produto_variacoes` | Variações por produto (cores, tamanhos) (CASCADE) |
| `produto_precos` | Faixas de preço por volume por produto (CASCADE) |

### Colunas extras em `pedidos`
- `valor_adiantado` — valor já pago pelo cliente (manual)
- `produto_id` — FK para a tabela de produtos

### Funções RPC (contornam cache do PostgREST)
- `atualizar_pedido_extra(p_id, p_valor_adiantado, p_produto_id)` — salva campos extras
- `get_campos_extras()` — retorna `valor_adiantado` e `produto_id` de todos os pedidos

---

## 🚀 Funcionalidades Implementadas

### 1. Dashboard
- **Saldo em Caixa Real** = Receita recebida (adiantamentos + pagos integrais) − Custos − Lançamentos de saída + Lançamentos de entrada
- **Faturamento Bruto** — soma dos pedidos confirmados (exclui "Aguardando confirmação")
- **Lucro Líquido** — Faturamento − Custos
- **Grupo Fluxo Operacional** — Total de pedidos, Em produção (+valor), Entregues (+valor)
- **Grupo Expectativa** — Sem pagamento (+valor), Sinal recebido (qtd+valor adiantado), Total a Receber
- **Aguardando Confirmação** — pedidos em negociação, fora de todos os cálculos
- Filtro de período: Este mês / Últimos 3 meses / Tudo
- Botão de olho para ocultar/revelar todos os valores monetários

### 2. Gestão de Pedidos
- CRUD completo com modal de criação e edição
- Produto vinculado ao catálogo (select dinâmico)
- Variações carregadas automaticamente conforme produto selecionado
- Precificação automática por faixas de volume do produto
- Campo "Valor já pago" (adiantamento manual) separado do status de pagamento
- Modal de "Ver detalhes" com resumo financeiro (total, já pago, ainda a receber) e campo para atualizar adiantamento
- Filtros: Pesquisa (cliente/código/produto) + Produto + Status de Pedido + Status de Pagamento
- Status de pedido: Aguardando confirmação / Em produção / Pronto para envio / Enviado / Entregue / Cancelado
- Status de pagamento: Pendente / Pago parcial / Pago integral / Reembolsado

### 3. Controle de Compras e Custos
- CRUD completo com categorias (Tecidos/Aviamentos, Embalagem/Tags, Frete/Transporte, Ferramentas/Manutenção, Outros)
- Reflexo automático no Saldo em Caixa do Dashboard

### 4. Configurações (aba com sub-abas)

#### Clientes
- CRUD completo migrado para Configurações
- Botão "+ Novo cliente" disponível também dentro do modal de Novo Pedido (sem sair do fluxo)

#### Financeiro
- Lançamentos manuais de caixa (Entrada/Saída)
- Exemplos: investimento inicial, aporte pessoal, retirada de lucro
- Entradas somam e saídas subtraem do Saldo em Caixa
- Respeitam o filtro de período do Dashboard

#### Produtos
- Cadastro de produtos com nome, descrição e status (Ativo/Inativo)
- Variações próprias por produto (texto livre, sem restrição)
- Faixas de preço por volume configuráveis por produto
  - Ex: 1un=R$10 / 10un=R$8 / 20un=R$6 / 50un=R$5
- Cards visuais com tags de variações e faixas de preço
- Ativar/Desativar produto sem excluir

---

## 🎨 Design System

### Identidade Visual
- **Cor primária:** `#A31C2E` (Cherry Red — extraído do logo)
- **Fundo:** `#FFF5F7` (rosé suave)
- **Surface:** `#FFFFFF`
- **Sidebar:** `#240810` (bordô escuro)
- **Tipografia display:** Dancing Script (cursiva, usada nos títulos de página e logo)
- **Tipografia UI:** Nunito (arredondada, legível)

### Layout
- **Mobile-first** — sidebar oculta, Bottom Navigation fixa com 4 abas
- **Desktop (≥768px)** — Sidebar lateral com hambúrguer retrátil
- Sidebar colapsável para 56px mantendo ícones visíveis

### Componentes
- Cards de estatística com hover suave
- Hero card com gradiente cereja para o Saldo em Caixa
- Dropdown de ações (⋮) com `position: fixed` para não ser cortado por `overflow`
- Modais com animação de entrada (scale + fade)
- Toast notifications (sucesso e erro)
- Badges coloridos por status
- Toggle switch para ativo/inativo
- Splash screen animada com bounce + dots loader

### PWA
- `manifest.json` com ícones 192px e 512px
- `apple-touch-icon.png` para iOS
- `theme-color: #240810`
- Modo standalone (sem barra do browser)

---

## 🧮 Lógica Financeira

```
Receita Recebida  = Σ valor_adiantado (pedidos não-reembolsados)
                  + Σ total_final (pedidos "Pago integral")

Saldo em Caixa    = Receita Recebida
                  - Custos (tabela compras)
                  + Entradas Manuais (lancamentos tipo 'entrada')
                  - Saídas Manuais (lancamentos tipo 'saida')

Faturamento Bruto = Σ total_final (pedidos confirmados — exclui "Aguardando confirmação")

Lucro Líquido     = Faturamento Bruto - Custos

Total a Receber   = Σ (total_final - valor_adiantado) por pedido não-quitado
```

### Precificação por faixas
O sistema aplica a faixa de maior `qtd_minima` que seja ≤ à quantidade total do pedido. Se a quantidade for menor que a menor faixa, o pedido é bloqueado.

---

## 📁 Arquivos do Projeto

| Arquivo | Descrição |
|---|---|
| `index.html` | Estrutura HTML completa — páginas, modais, bottom nav |
| `style.css` | Design system completo mobile-first |
| `app.js` | Toda a lógica de negócio, CRUD e integração Supabase |
| `config.js` | Credenciais Supabase (gitignored) |
| `schema.sql` | SQL completo para recriar o banco do zero |
| `manifest.json` | Configuração PWA |
| `logo-white.svg` | Logo branca (usada na sidebar e splash) |
| `logo-red.svg` | Logo vermelha (favicon) |
| `apple-touch-icon.png` | Ícone iOS |
| `web-app-manifest-192x192.png` | Ícone PWA 192px |
| `web-app-manifest-512x512.png` | Ícone PWA 512px |

---

## 🔐 Segurança
- Chave `anon` do Supabase exposta no browser (padrão para apps sem auth)
- RLS (Row Level Security) desativado nas tabelas — acesso controlado pela chave
- `config.js` no `.gitignore` — credenciais não vão para o repositório
- **Recomendação v2:** Implementar autenticação Supabase Auth para proteger os dados

---

## 🗺️ Roadmap v2
- [ ] Autenticação (login com email/senha via Supabase Auth)
- [ ] Confirmação de pedido via WhatsApp (link `wa.me` pré-formatado)
- [ ] Exportação CSV da tabela de pedidos
- [ ] Relatório de produtos mais vendidos
- [ ] Ticket médio por período
- [ ] Alerta de pedidos em produção há mais de X dias