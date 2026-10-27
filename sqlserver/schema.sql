-- REPTEC application schema for Microsoft SQL Server.
-- The material catalog remains in the existing ERP tables.

IF OBJECT_ID('dbo.permissoes_usuario', 'U') IS NULL
CREATE TABLE dbo.permissoes_usuario (
  codigo_usuario varchar(50) NOT NULL CONSTRAINT PK_permissoes_usuario PRIMARY KEY,
  login_usuario varchar(100) NULL,
  nome_exibicao nvarchar(200) NOT NULL,
  nome_permissao varchar(50) NOT NULL CONSTRAINT DF_permissoes_nome DEFAULT 'solicitante',
  nivel tinyint NOT NULL CONSTRAINT CK_permissoes_nivel CHECK (nivel BETWEEN 1 AND 5),
  empresa varchar(50) NULL,
  ativo bit NOT NULL CONSTRAINT DF_permissoes_ativo DEFAULT 1,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_permissoes_created DEFAULT sysdatetime(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_permissoes_updated DEFAULT sysdatetime()
);

IF OBJECT_ID('dbo.requisicoes', 'U') IS NULL
CREATE TABLE dbo.requisicoes (
  id uniqueidentifier NOT NULL CONSTRAINT PK_requisicoes PRIMARY KEY DEFAULT newid(),
  numero_solicitacao bigint IDENTITY(1,1) NOT NULL CONSTRAINT UQ_requisicoes_numero UNIQUE,
  solicitante_codigo varchar(50) NOT NULL,
  status varchar(30) NOT NULL CONSTRAINT DF_requisicoes_status DEFAULT 'rascunho',
  ciclo int NOT NULL CONSTRAINT DF_requisicoes_ciclo DEFAULT 1,
  motivo_reprovacao nvarchar(1000) NULL,
  numero_ct varchar(100) NULL,
  empresa varchar(50) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_requisicoes_created DEFAULT sysdatetime(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_requisicoes_updated DEFAULT sysdatetime(),
  CONSTRAINT CK_requisicoes_status CHECK (status IN ('rascunho','aguardando_gestao','aguardando_diretoria','aguardando_geracao_ct','reprovada','ct_realizada'))
);

IF OBJECT_ID('dbo.requisicao_itens', 'U') IS NULL
CREATE TABLE dbo.requisicao_itens (
  id uniqueidentifier NOT NULL CONSTRAINT PK_requisicao_itens PRIMARY KEY DEFAULT newid(),
  requisicao_id uniqueidentifier NOT NULL,
  material nvarchar(1000) NOT NULL,
  quantidade_solicitada decimal(14,3) NOT NULL CONSTRAINT CK_itens_qtd_solicitada CHECK (quantidade_solicitada > 0),
  quantidade_aprovada decimal(14,3) NOT NULL CONSTRAINT DF_itens_qtd_aprovada DEFAULT 0,
  giro_calculado decimal(10,3) NULL,
  decisao_item varchar(20) NOT NULL CONSTRAINT DF_itens_decisao DEFAULT 'pendente',
  ct_gerada bit NOT NULL CONSTRAINT DF_itens_ct_gerada DEFAULT 0,
  numero_ct varchar(100) NULL,
  ct_gerada_em datetime2(3) NULL,
  ct_gerada_por varchar(50) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_itens_created DEFAULT sysdatetime(),
  CONSTRAINT FK_itens_requisicao FOREIGN KEY (requisicao_id) REFERENCES dbo.requisicoes(id) ON DELETE CASCADE,
  CONSTRAINT CK_itens_decisao CHECK (decisao_item IN ('pendente','aprovado','reprovado','ajustado'))
);

IF OBJECT_ID('dbo.requisicao_historico', 'U') IS NULL
CREATE TABLE dbo.requisicao_historico (
  id uniqueidentifier NOT NULL CONSTRAINT PK_requisicao_historico PRIMARY KEY DEFAULT newid(),
  requisicao_id uniqueidentifier NOT NULL,
  etapa varchar(30) NOT NULL,
  usuario_codigo varchar(50) NOT NULL,
  acao varchar(40) NOT NULL,
  motivo nvarchar(1000) NULL,
  valores_antes nvarchar(max) NULL,
  valores_depois nvarchar(max) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_historico_created DEFAULT sysdatetime(),
  CONSTRAINT FK_historico_requisicao FOREIGN KEY (requisicao_id) REFERENCES dbo.requisicoes(id) ON DELETE CASCADE
);

CREATE INDEX IX_requisicoes_status ON dbo.requisicoes(status);
CREATE INDEX IX_requisicoes_solicitante ON dbo.requisicoes(solicitante_codigo);
CREATE INDEX IX_itens_requisicao ON dbo.requisicao_itens(requisicao_id);
CREATE INDEX IX_historico_requisicao ON dbo.requisicao_historico(requisicao_id);
