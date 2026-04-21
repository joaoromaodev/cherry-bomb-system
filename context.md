# 🌸 Documentação de Contexto: Sistema Cherry Bomb

## 📌 Visão Geral do Projeto
O **Sistema Cherry Bomb** é uma aplicação web focada na gestão de encomendas de produtos artesanais (handmade). O objetivo é ter uma plataforma acessível via browser (PC e mobile) para facilitar a administração de pedidos, controle de custos e carteira de clientes, com um design personalizado e banco de dados real na nuvem.

## 🛠️ Stack Tecnológico
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla/ESModules).
* **Backend/Database:** Supabase (PostgreSQL) para manter os dados seguros e acessíveis.
* **Hospedagem:** Web (Browser-based), gratuito e acessível de qualquer lugar.

## 🚀 Funcionalidades Desenvolvidas

### 1. Dashboard (Visão Geral)
* Cálculo automático e exibição de métricas vitais: Faturamento Bruto, Custos/Saídas e Lucro Líquido.
* Contadores de status: Total de pedidos, Pedidos em produção, Aguardando pagamento.
* Tabela de resumo com os pedidos mais recentes.

### 2. Gestão de Pedidos
* Listagem completa de encomendas com filtros por status de produção e controle de pagamentos (sinal de 50%, etc).
* **Criação de Pedidos:**
    * Seleção de cliente pré-cadastrado.
    * Adição de múltiplas variações de produto (ex: cor, 10 vermelhas e 20 rosas) e quantidades.
    * Cálculo de preço automatizado baseado em volume (ex: mínimo 10 un = R$8, 20+ un = R$6, 50+ un = R$5) somando o total do cliente.
    * Campos para descontos/acréscimos, observações e valor de frete.
* **Edição Rápida:** Modal para visualizar os detalhes da produção e atualizar rapidamente o status do pedido e do pagamento.

### 3. Gestão de Clientes
* Listagem de clientes com código, nome, contato, CEP e cidade.
* Cadastro ágil com suporte a observações personalizadas.

### 4. Controle de Compras e Custos
* Registro de despesas com materiais (tecidos, fretes, embalagens, etc).
* Categorização de gastos para melhor controle financeiro.
* Opções completas de CRUD (Criar, Ler, Editar, Excluir) para os custos, refletindo automaticamente no cálculo de Lucro Líquido do Dashboard.

## 🐛 Resolução de Problemas (Bug Fixes Recentes)
* **Correção Crítica no `app.js`:** Resolução de erro de sintaxe (uma chave `}` extra e perdida no final do arquivo) que causava um `SyntaxError`, impedia o carregamento do JavaScript e deixava a interface "congelada" com botões não clicáveis.
* **Refatoração de Funções:** Remoção de blocos duplicados (como a função `salvarCompra`) e limpeza do escopo global nas exportações para o HTML, garantindo o funcionamento limpo e correto dos modais.

## 🎯 Contexto de Estratégia B2B Associada
* **Campanha Dia das Mães:** Planejamento de marketing direcionado ao público B2B (RH de empresas, escolas, clínicas e lojas) para venda de xuxinhas de cetim que se transformam em rosas ("Amor de mãe floresce para sempre").
* **Estratégia de Aquisição:** Uso de campanhas de Meta Ads estruturadas para encontrar públicos corporativos em Belém e Ananindeua. A comunicação foca na percepção de valor (um "brinde que não vai pro lixo"), personalização e na urgência da "escassez de agenda" por ser um produto feito à mão.