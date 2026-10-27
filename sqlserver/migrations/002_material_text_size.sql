IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.requisicao_itens')
    AND name = 'material'
    AND (system_type_id <> 231 OR max_length < 2000)
)
  ALTER TABLE dbo.requisicao_itens ALTER COLUMN material nvarchar(1000) NOT NULL;
