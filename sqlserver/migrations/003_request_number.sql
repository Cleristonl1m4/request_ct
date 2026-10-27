IF COL_LENGTH('dbo.requisicoes', 'numero_solicitacao') IS NULL
  ALTER TABLE dbo.requisicoes ADD numero_solicitacao bigint IDENTITY(1,1) NOT NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.requisicoes')
    AND name = 'UQ_requisicoes_numero'
)
  CREATE UNIQUE INDEX UQ_requisicoes_numero ON dbo.requisicoes(numero_solicitacao);
