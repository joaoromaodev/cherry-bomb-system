<div align="center">
  <img src="logo-red.svg" width="100" alt="Cherry Bomb Logo">

  # Cherry Bomb — Sistema de Gestão
  ### Feito à mão. Gerenciado com carinho. 🍒

  ![Status](https://img.shields.io/badge/status-MVP%20v1.0-A31C2E?style=flat-square)
  ![Stack](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Supabase-240810?style=flat-square)
  ![Deploy](https://img.shields.io/badge/deploy-Vercel-black?style=flat-square)

</div>

---

## O que é isso?

O **Cherry Bomb** é um sistema de gestão completo desenvolvido para a marca **Cherry Bomb Handmade** — especializada em scrunchies e acessórios artesanais de cetim e veludo.

O sistema substitui planilhas e cadernos por uma plataforma acessível via browser — no celular ou no computador — com banco de dados real na nuvem, design fiel à identidade da marca e foco no uso diário da Vívian.

---

## Funcionalidades

### 📊 Dashboard Financeiro
- **Saldo em Caixa Real** — o dinheiro que realmente entrou, descontando todos os custos
- **Faturamento Bruto** e **Lucro Líquido**
- Controle de pedidos **sem pagamento**, **com sinal** e **total a receber**
- Filtro por período: este mês, últimos 3 meses ou tudo
- Botão de privacidade para ocultar todos os valores

### 📦 Gestão de Pedidos
- Criação de pedidos vinculados a clientes e produtos cadastrados
- Variações automáticas por produto (cores, tamanhos)
- Precificação automática por faixas de volume — cada produto tem sua própria tabela de preços
- Controle de **quanto o cliente já pagou** independente do status
- Filtros por cliente, produto, status de produção e status de pagamento

### 💰 Compras e Custos
- Registro de todos os gastos com materiais, embalagens, frete e ferramentas
- Reflexo automático no saldo do caixa

### ⚙️ Configurações
- **Clientes** — cadastro completo com histórico
- **Produtos** — catálogo com variações e faixas de preço por volume
- **Financeiro** — lançamentos manuais de entrada e saída (investimentos, aportes, retiradas)

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript Vanilla (ESModules) |
| Banco de dados | Supabase (PostgreSQL) |
| Hospedagem | Vercel |
| Fontes | Dancing Script + Nunito (Google Fonts) |

---

## Como rodar localmente

### Pré-requisitos
- Conta no [Supabase](https://supabase.com)
- Conta no [Vercel](https://vercel.com) (opcional para deploy)

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/cherry-bomb.git
cd cherry-bomb
```

### 2. Configure o banco de dados
Acesse seu projeto no Supabase → **SQL Editor** → cole e execute o conteúdo do arquivo `schema.sql`.

Em seguida, execute também:
```sql
-- Colunas extras em pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS valor_adiantado NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS produto_id UUID;

-- Tabelas de produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL, descricao TEXT,
  ativo BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.produto_variacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.produto_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  qtd_minima INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE DEFAULT CURRENT_DATE, descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'entrada',
  valor NUMERIC(10,2) NOT NULL, observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões e RPCs
GRANT ALL ON public.produtos TO anon;
GRANT ALL ON public.produto_variacoes TO anon;
GRANT ALL ON public.produto_precos TO anon;
GRANT ALL ON public.lancamentos TO anon;

ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_variacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_precos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.atualizar_pedido_extra(
  p_id UUID, p_valor_adiantado NUMERIC, p_produto_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE public.pedidos SET valor_adiantado = p_valor_adiantado, produto_id = p_produto_id WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_campos_extras()
RETURNS TABLE(pedido_id UUID, valor_adiantado NUMERIC, produto_id UUID) AS $$
  SELECT id, valor_adiantado, produto_id FROM public.pedidos;
$$ LANGUAGE sql;

GRANT EXECUTE ON FUNCTION public.atualizar_pedido_extra TO anon;
GRANT EXECUTE ON FUNCTION public.get_campos_extras TO anon;
```

### 3. Configure as credenciais
Crie o arquivo `config.js` na raiz do projeto:
```javascript
export const CONFIG = {
  SUPABASE_URL: 'https://seu-projeto.supabase.co',
  SUPABASE_KEY: 'sua-chave-anon',
  SCHEMA: 'public'
};
```

> ⚠️ O arquivo `config.js` está no `.gitignore` — nunca suba suas credenciais para o GitHub.

### 4. Abra no browser
Sirva os arquivos com qualquer servidor estático. Recomendado:
```bash
npx serve .
```
Ou abra direto com a extensão **Live Server** no VS Code.

---

## Deploy no Vercel

1. Suba o repositório para o GitHub (com o repo **privado**)
2. Importe o projeto no [Vercel](https://vercel.com)
3. Não é necessário nenhum build command — é HTML puro
4. O deploy acontece automaticamente a cada push

> ✅ Repositório privado no GitHub não afeta o funcionamento do site no Vercel.

---

## Estrutura de arquivos

```
cherry-bomb/
├── index.html              # Estrutura completa — páginas e modais
├── style.css               # Design system mobile-first
├── app.js                  # Lógica de negócio e integração Supabase
├── config.js               # Credenciais (gitignored)
├── schema.sql              # SQL para recriar o banco do zero
├── manifest.json           # Configuração PWA
├── logo-white.svg          # Logo para fundo escuro
├── logo-red.svg            # Logo para fundo claro (favicon)
├── apple-touch-icon.png    # Ícone para iOS
├── web-app-manifest-192x192.png
├── web-app-manifest-512x512.png
└── .gitignore              # Exclui config.js do repositório
```

---

## Identidade Visual

A interface foi desenhada para refletir fielmente a marca Cherry Bomb:

- 🍒 **Cherry Red** `#A31C2E` — cor primária extraída do logo
- 🌸 **Rosé** `#FFF5F7` — fundo principal
- 🖤 **Bordô escuro** `#240810` — sidebar e splash screen
- ✍️ **Dancing Script** — títulos e nome da marca
- 📱 **Nunito** — textos e interface

---

## Roadmap v2

- [ ] Autenticação com login (Supabase Auth)
- [ ] Confirmação de pedido via WhatsApp
- [ ] Exportação de pedidos em CSV
- [ ] Relatório de produtos mais vendidos
- [ ] Ticket médio por período
- [ ] Alerta de pedidos em produção há mais de X dias

---

<div align="center">
  <p>Feito com muito carinho para a Cherry Bomb 🍒</p>
  <p><a href="https://instagram.com/cherrybomb.hm">@cherrybomb.hm</a></p>
</div>