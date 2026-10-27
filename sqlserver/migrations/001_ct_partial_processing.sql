-- Adds per-item CT tracking without changing the existing request statuses.
IF COL_LENGTH('dbo.requisicao_itens', 'ct_gerada') IS NULL
  ALTER TABLE dbo.requisicao_itens ADD ct_gerada bit NOT NULL CONSTRAINT DF_itens_ct_gerada DEFAULT 0;

IF COL_LENGTH('dbo.requisicao_itens', 'numero_ct') IS NULL
  ALTER TABLE dbo.requisicao_itens ADD numero_ct varchar(100) NULL;

IF COL_LENGTH('dbo.requisicao_itens', 'ct_gerada_em') IS NULL
  ALTER TABLE dbo.requisicao_itens ADD ct_gerada_em datetime2(3) NULL;

IF COL_LENGTH('dbo.requisicao_itens', 'ct_gerada_por') IS NULL
  ALTER TABLE dbo.requisicao_itens ADD ct_gerada_por varchar(50) NULL;
