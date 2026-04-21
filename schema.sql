-- ================================================================
--  🌸 CHERRY BOMB — Schema do banco de dados
--  Cole e execute TUDO isso no SQL Editor do Supabase:
--  Seu projeto > SQL Editor > New query > Cole > Run
-- ================================================================

-- 1. Schema isolado (não toca em nada do SIMF-SEDUC)
CREATE SCHEMA IF NOT EXISTS cherry_bomb;

-- 2. Sequences para os códigos automáticos (CB-001, CLI-001...)
CREATE SEQUENCE IF NOT EXISTS cherry_bomb.seq_pedido  START 1;
CREATE SEQUENCE IF NOT EXISTS cherry_bomb.seq_cliente START 1;

-- 3. Clientes
CREATE TABLE IF NOT EXISTS cherry_bomb.clientes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     TEXT        UNIQUE,
  nome       TEXT        NOT NULL,
  contato    TEXT,
  cep        TEXT,
  cidade     TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Pedidos
CREATE TABLE IF NOT EXISTS cherry_bomb.pedidos (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo             TEXT          UNIQUE,
  cliente_id         UUID          REFERENCES cherry_bomb.clientes(id),
  cliente_nome       TEXT,
  produto            TEXT,
  data_pedido        DATE          DEFAULT CURRENT_DATE,
  qtd_total          INTEGER       DEFAULT 0,
  preco_unitario     NUMERIC(10,2),
  subtotal           NUMERIC(10,2) DEFAULT 0,
  desconto_acrescimo NUMERIC(10,2) DEFAULT 0,
  frete              NUMERIC(10,2) DEFAULT 0,
  total_final        NUMERIC(10,2) DEFAULT 0,
  status_pedido      TEXT          DEFAULT 'Aguardando confirmação',
  status_pagamento   TEXT          DEFAULT 'Pendente',
  observacao         TEXT,
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

-- 5. Itens do pedido (variações: 20 vermelhas, 10 rosas etc.)
CREATE TABLE IF NOT EXISTS cherry_bomb.itens_pedido (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id  UUID    REFERENCES cherry_bomb.pedidos(id) ON DELETE CASCADE,
  variacao   TEXT    NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0
);

-- 6. Compras / custos (fase 2 — tabela já criada, usada depois)
CREATE TABLE IF NOT EXISTS cherry_bomb.compras (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT          UNIQUE,
  data_compra DATE          DEFAULT CURRENT_DATE,
  descricao   TEXT          NOT NULL,
  categoria   TEXT,
  valor       NUMERIC(10,2) NOT NULL,
  observacao  TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- 7. Trigger: gera código automático para clientes (CLI-001, CLI-002...)
CREATE OR REPLACE FUNCTION cherry_bomb.gerar_codigo_cliente()
RETURNS TRIGGER AS $$
BEGIN
  NEW.codigo := 'CLI-' || LPAD(nextval('cherry_bomb.seq_cliente')::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_cliente_codigo
  BEFORE INSERT ON cherry_bomb.clientes
  FOR EACH ROW WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION cherry_bomb.gerar_codigo_cliente();

-- 8. Trigger: gera código automático para pedidos (CB-001, CB-002...)
CREATE OR REPLACE FUNCTION cherry_bomb.gerar_codigo_pedido()
RETURNS TRIGGER AS $$
BEGIN
  NEW.codigo := 'CB-' || LPAD(nextval('cherry_bomb.seq_pedido')::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_pedido_codigo
  BEFORE INSERT ON cherry_bomb.pedidos
  FOR EACH ROW WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION cherry_bomb.gerar_codigo_pedido();

-- 9. Permissões para a chave anon (necessário para o app funcionar)
GRANT USAGE  ON SCHEMA cherry_bomb TO anon;
GRANT ALL    ON ALL TABLES    IN SCHEMA cherry_bomb TO anon;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA cherry_bomb TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA cherry_bomb GRANT ALL ON TABLES    TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA cherry_bomb GRANT ALL ON SEQUENCES TO anon;