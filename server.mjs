import 'dotenv/config';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import sql from 'mssql';

const port = Number(process.env.API_PORT || 8787);
const loginApiUrl = process.env.LOGIN_API_URL || 'https://portais.reptec.com.br:4482/api/api/genericos/ge/login';
const sessions = new Map();

const sqlConfig = {
  server: process.env.SQL_SERVER,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  port: Number(process.env.SQL_PORT || 1433),
  options: {
    encrypt: process.env.SQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

const pool = new sql.ConnectionPool({
  ...sqlConfig,
  database: process.env.SQL_REPTEC_DATABASE || process.env.SQL_DATABASE || 'REPTEC',
});
const cigamPool = new sql.ConnectionPool({
  ...sqlConfig,
  database: process.env.SQL_CIGAM_DATABASE || 'CIGAM',
});

if (!process.env.SQL_SERVER || !process.env.SQL_DATABASE || !process.env.SQL_USER || !process.env.SQL_PASSWORD) {
  throw new Error('SQL_SERVER, SQL_DATABASE, SQL_USER e SQL_PASSWORD são obrigatórias.');
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || '{}');
}

function sendJson(response, status, payload, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((value) => {
    const [key, ...parts] = value.trim().split('=');
    return [key, parts.join('=')];
  }));
}

function actor(request) {
  const session = sessions.get(parseCookies(request).reptec_session);
  return session || null;
}

function requireActor(request, response) {
  const current = actor(request);
  if (!current) sendJson(response, 401, { error: 'Sessão expirada.' });
  return current;
}

async function login(request, response) {
  const credentials = await readJson(request);
  const externalResponse = await fetch(loginApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ NomeUsuario: credentials.NomeUsuario, Senha: credentials.Senha }),
  });
  const result = await externalResponse.json();
  if (!externalResponse.ok || !result.success || !result.data?.[0]) {
    return sendJson(response, 401, { error: result.messages?.[0] || 'Usuário ou senha inválidos.' });
  }

  const external = result.data[0];
  const code = String(external.Codigo || '').trim();
  const loginName = String(external.LoginUsuario || credentials.NomeUsuario).trim();
  const requestDb = (await pool.connect()).request();
  const admin = code.toUpperCase() === 'E92';
  await requestDb.input('codigo', sql.VarChar(50), code)
    .input('login', sql.VarChar(100), loginName)
    .input('nome', sql.NVarChar(200), external.NomeUsuario || loginName)
    .input('empresa', sql.VarChar(50), external.Empresa || null)
    .input('nivel', sql.TinyInt, admin ? 5 : 1)
    .input('papel', sql.VarChar(50), admin ? 'admin' : 'solicitante')
    .query(`
      MERGE dbo.permissoes_usuario AS target
      USING (SELECT @codigo codigo_usuario) AS source ON target.codigo_usuario = source.codigo_usuario
      WHEN MATCHED AND @nivel = 5 THEN UPDATE SET nivel=@nivel, nome_permissao=@papel, login_usuario=@login, updated_at=sysdatetime()
      WHEN NOT MATCHED THEN INSERT (codigo_usuario, login_usuario, nome_exibicao, nome_permissao, nivel, empresa)
        VALUES (@codigo, @login, @nome, @papel, @nivel, @empresa);`);

  const permission = await requestDb.input('codigo2', sql.VarChar(50), code)
    .query('SELECT TOP 1 * FROM dbo.permissoes_usuario WHERE codigo_usuario=@codigo2 AND ativo=1');
  const permissionRow = permission.recordset[0];
  if (!permissionRow) return sendJson(response, 403, { error: 'Usuário sem permissão no sistema.' });

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { codigo: code, login: loginName, nome: external.NomeUsuario, permissao: permissionRow });
  return sendJson(response, 200, {
    authenticated: true,
    user: { id: code, email: loginName, nome: external.NomeUsuario },
    permissao: permissionRow,
  }, `reptec_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
}

function mapRequest(row, items) {
  return { ...row, solicitante_id: row.solicitante_codigo, itens: items || undefined };
}

async function getRequisicoes(current, filter) {
  const requestDb = (await pool.connect()).request().input('codigo', sql.VarChar(50), current.codigo);
  const where = filter === 'minhas' ? 'WHERE solicitante_codigo=@codigo' : '';
  const result = await requestDb.query(`SELECT * FROM dbo.requisicoes ${where} ORDER BY updated_at DESC`);
  return result.recordset.map((row) => mapRequest(row));
}

async function getRequisicao(id) {
  const requestDb = (await pool.connect()).request().input('id', sql.UniqueIdentifier, id);
  const req = await requestDb.query('SELECT * FROM dbo.requisicoes WHERE id=@id');
  if (!req.recordset[0]) return null;
  const items = await requestDb.query("SELECT *, CASE WHEN ct_gerada=1 THEN 'ct_gerada' ELSE decisao_item END AS situacao FROM dbo.requisicao_itens WHERE requisicao_id=@id ORDER BY created_at");
  return mapRequest(req.recordset[0], items.recordset);
}

async function transition(current, id, body) {
  const requestDb = (await pool.connect()).request()
    .input('id', sql.UniqueIdentifier, id)
    .input('codigo', sql.VarChar(50), current.codigo);
  const found = await requestDb.query('SELECT * FROM dbo.requisicoes WHERE id=@id');
  const req = found.recordset[0];
  if (!req) throw new Error('Solicitação de CT não encontrada.');
  const level = current.permissao.nivel;
  const admin = level === 5;
  const action = body.acao;
  const transitions = {
    enviar: ['rascunho', 'aguardando_gestao'], aprovar_gestao: ['aguardando_gestao', 'aguardando_diretoria'],
    aprovar_diretoria: ['aguardando_diretoria', 'aguardando_geracao_ct'], reprovar: [req.status, 'reprovada'],
    reabrir: ['reprovada', 'rascunho'], reanalise: ['aguardando_geracao_ct', 'aguardando_gestao'],
    ct_realizada: ['aguardando_geracao_ct', 'ct_realizada'],
  };
  const key = action === 'aprovar' ? (req.status === 'aguardando_gestao' ? 'aprovar_gestao' : 'aprovar_diretoria') : action;
  const next = transitions[key];
  if (!next || req.status !== next[0]) throw new Error('Transição inválida para o status atual.');
  const allowed = admin || (key === 'enviar' && (current.codigo === req.solicitante_codigo || admin)) ||
    (key === 'aprovar_gestao' && level === 2) || (key === 'aprovar_diretoria' && level === 3) ||
    (key === 'reprovar' && [2, 3].includes(level)) || (key === 'reabrir' && current.codigo === req.solicitante_codigo) ||
    (key === 'reanalise' && level === 4) || (key === 'ct_realizada' && level === 4);
  if (!allowed) throw new Error('Perfil sem permissão para esta ação.');
  if (['reprovar', 'reanalise'].includes(key) && !body.motivo?.trim()) throw new Error('Motivo obrigatório.');
  if (key === 'ct_realizada' && !body.numeroCt?.trim()) throw new Error('Número da CT obrigatório.');

  if (key === 'ct_realizada') {
    const itemIds = [...new Set(Array.isArray(body.itemIds) ? body.itemIds : [])];
    if (!itemIds.length) throw new Error('Selecione ao menos um item gerado em CT.');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const itemRequest = transaction.request().input('reqId', sql.UniqueIdentifier, id);
      const itemParams = itemIds.map((itemId, index) => {
        const name = `item${index}`;
        itemRequest.input(name, sql.UniqueIdentifier, itemId);
        return `@${name}`;
      });
      const selected = await itemRequest.query(`SELECT id FROM dbo.requisicao_itens WHERE requisicao_id=@reqId AND ct_gerada=0 AND id IN (${itemParams.join(',')})`);
      if (selected.recordset.length !== itemIds.length) throw new Error('Um ou mais itens já foram gerados ou não pertencem à requisição.');

      const updateRequest = transaction.request().input('reqId', sql.UniqueIdentifier, id)
        .input('ctNumber', sql.VarChar(100), body.numeroCt)
        .input('actorCode', sql.VarChar(50), current.codigo);
      const updateParams = itemIds.map((itemId, index) => {
        const name = `selected${index}`;
        updateRequest.input(name, sql.UniqueIdentifier, itemId);
        return `@${name}`;
      });
      await updateRequest.query(`UPDATE dbo.requisicao_itens SET ct_gerada=1, numero_ct=@ctNumber, ct_gerada_em=sysdatetime(), ct_gerada_por=@actorCode WHERE requisicao_id=@reqId AND ct_gerada=0 AND id IN (${updateParams.join(',')})`);

      const pending = await transaction.request().input('reqId', sql.UniqueIdentifier, id).query('SELECT COUNT(*) AS total FROM dbo.requisicao_itens WHERE requisicao_id=@reqId AND ct_gerada=0');
      const allGenerated = Number(pending.recordset[0].total) === 0;
      await transaction.request().input('reqId', sql.UniqueIdentifier, id)
        .input('status', sql.VarChar(30), allGenerated ? 'ct_realizada' : req.status)
        .input('ctNumber', sql.VarChar(100), allGenerated ? body.numeroCt : null)
        .query("UPDATE dbo.requisicoes SET status=@status, numero_ct=@ctNumber, updated_at=sysdatetime() WHERE id=@reqId");
      await transaction.request().input('reqId', sql.UniqueIdentifier, id)
        .input('stage', sql.VarChar(30), allGenerated ? 'ct_realizada' : req.status)
        .input('actorCode', sql.VarChar(50), current.codigo)
        .input('action', sql.VarChar(40), 'ct_itens_realizada')
        .input('reason', sql.NVarChar(1000), body.numeroCt)
        .query('INSERT INTO dbo.requisicao_historico (requisicao_id, etapa, usuario_codigo, acao, motivo) VALUES (@reqId, @stage, @actorCode, @action, @reason)');
      await transaction.commit();
      return getRequisicao(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  await requestDb.input('status', sql.VarChar(30), next[1]).input('motivo', sql.NVarChar(1000), body.motivo || null)
    .input('ct', sql.VarChar(100), body.numeroCt || null).query(`UPDATE dbo.requisicoes SET status=@status, motivo_reprovacao=CASE WHEN @status='reprovada' THEN @motivo ELSE NULL END, numero_ct=COALESCE(@ct, numero_ct), updated_at=sysdatetime() WHERE id=@id`);
  await requestDb.input('acao', sql.VarChar(40), action).query('INSERT INTO dbo.requisicao_historico (requisicao_id, etapa, usuario_codigo, acao, motivo) VALUES (@id, @status, @codigo, @acao, @motivo)');
  return getRequisicao(id);
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  if (request.method === 'POST' && url.pathname === '/api/login') return login(request, response);
  if (request.method === 'GET' && url.pathname === '/api/auth/session') {
    const current = actor(request);
    return sendJson(response, 200, current ? { authenticated: true, user: { id: current.codigo, email: current.login, nome: current.nome }, permissao: current.permissao } : { authenticated: false });
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    sessions.delete(parseCookies(request).reptec_session);
    return sendJson(response, 200, { authenticated: false }, 'reptec_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  }
  const current = requireActor(request, response);
  if (!current) return;
  if (request.method === 'GET' && url.pathname === '/api/requisicoes') return sendJson(response, 200, await getRequisicoes(current, url.searchParams.get('filter') || 'todas'));
  if (request.method === 'POST' && url.pathname === '/api/requisicoes') {
    const body = await readJson(request); const db = (await pool.connect()).request();
    const result = await db.input('codigo', sql.VarChar(50), current.codigo).input('empresa', sql.VarChar(50), body.empresa || current.permissao.empresa || null).query('INSERT INTO dbo.requisicoes (solicitante_codigo, empresa) OUTPUT INSERTED.* VALUES (@codigo, @empresa)');
    return sendJson(response, 201, mapRequest(result.recordset[0]));
  }
  if (request.method === 'POST' && parts[1] === 'requisicoes' && parts[3] === 'itens') {
    const body = await readJson(request); const db = (await pool.connect()).request();
    const result = await db.input('req', sql.UniqueIdentifier, parts[2]).input('material', sql.NVarChar(1000), body.material).input('quantidade', sql.Decimal(14, 3), body.quantidade)
      .query('INSERT INTO dbo.requisicao_itens (requisicao_id, material, quantidade_solicitada, quantidade_aprovada) OUTPUT INSERTED.* VALUES (@req, @material, @quantidade, @quantidade)');
    return sendJson(response, 201, result.recordset[0]);
  }
  if (request.method === 'GET' && parts[1] === 'requisicoes' && parts[3] === 'historico') {
    const db = (await pool.connect()).request().input('id', sql.UniqueIdentifier, parts[2]);
    return sendJson(response, 200, (await db.query('SELECT * FROM dbo.requisicao_historico WHERE requisicao_id=@id ORDER BY created_at')).recordset);
  }
  if ((request.method === 'PATCH' || request.method === 'DELETE') && parts[1] === 'itens' && parts.length === 3) {
    const db = (await pool.connect()).request().input('id', sql.UniqueIdentifier, parts[2]);
    if (request.method === 'DELETE') await db.query('DELETE FROM dbo.requisicao_itens WHERE id=@id');
    else { const body = await readJson(request); await db.input('material', sql.NVarChar(1000), body.material).input('quantidade', sql.Decimal(14, 3), body.quantidade).query('UPDATE dbo.requisicao_itens SET material=@material, quantidade_solicitada=@quantidade, quantidade_aprovada=@quantidade WHERE id=@id'); }
    return sendJson(response, 200, {});
  }
  if (request.method === 'POST' && parts[1] === 'itens' && parts[3] === 'aprovacao') {
    const body = await readJson(request); const db = (await pool.connect()).request().input('id', sql.UniqueIdentifier, parts[2]).input('quantidade', sql.Decimal(14, 3), body.quantidadeAprovada).input('decisao', sql.VarChar(20), body.decisao).input('giro', sql.Decimal(10, 3), body.giro ?? null);
    await db.query('UPDATE dbo.requisicao_itens SET quantidade_aprovada=@quantidade, decisao_item=@decisao, giro_calculado=@giro WHERE id=@id');
    return sendJson(response, 200, {});
  }
  if (request.method === 'DELETE' && parts[1] === 'requisicoes' && parts.length === 3) {
    const db = (await pool.connect()).request().input('id', sql.UniqueIdentifier, parts[2]);
    await db.query("DELETE FROM dbo.requisicoes WHERE id=@id AND status='rascunho'");
    return sendJson(response, 200, {});
  }
  if (request.method === 'GET' && parts[1] === 'requisicoes' && parts.length === 3) return sendJson(response, 200, await getRequisicao(parts[2]));
  if (request.method === 'POST' && parts[1] === 'requisicoes' && parts[3] === 'transicao') return sendJson(response, 200, await transition(current, parts[2], await readJson(request)));
  if (request.method === 'GET' && url.pathname === '/api/permissoes') return sendJson(response, 200, (await (await pool.connect()).request().query('SELECT * FROM dbo.permissoes_usuario ORDER BY nome_exibicao')).recordset);
  if (request.method === 'PUT' && url.pathname === '/api/permissoes') {
    const body = await readJson(request); const db = (await pool.connect()).request();
    await db.input('codigo', sql.VarChar(50), body.userId).input('nivel', sql.TinyInt, body.nivel).input('nome', sql.NVarChar(200), body.nome).input('empresa', sql.VarChar(50), body.empresa || null)
      .query('UPDATE dbo.permissoes_usuario SET nivel=@nivel, nome_exibicao=@nome, empresa=@empresa, ativo=1, updated_at=sysdatetime() WHERE codigo_usuario=@codigo');
    return sendJson(response, 200, {});
  }
  if (request.method === 'POST' && parts[1] === 'permissoes' && parts[3] === 'ativo') {
    const body = await readJson(request); const db = (await pool.connect()).request().input('codigo', sql.VarChar(50), parts[2]).input('ativo', sql.Bit, body.ativo);
    await db.query('UPDATE dbo.permissoes_usuario SET ativo=@ativo, updated_at=sysdatetime() WHERE codigo_usuario=@codigo');
    return sendJson(response, 200, {});
  }
  if (request.method === 'GET' && url.pathname === '/api/materiais') {
    const codigo = url.searchParams.get('codigo') || ''; const db = (await cigamPool.connect()).request().input('codigo', sql.VarChar(50), codigo);
    const result = await db.query(`
      SELECT DISTINCT
        LTRIM(RTRIM(MAT.Cd_material)) AS Cd_material,
        LTRIM(RTRIM(MAT.Descricao)) AS Descricao,
        NULLIF(LTRIM(RTRIM(EST.Cd_especif1)), '') AS Cd_especif1,
        CASE
          WHEN NULLIF(LTRIM(RTRIM(EST.Cd_especif1)), '') IS NULL THEN NULL
          ELSE ISNULL(
            DBO.cg_fc_monta_descr_ident(
              MAT.cd_especif1,
              DBO.cg_fc_monta_descr_ident(EST.cd_especif1, '', 1, 0, ' ', 0, ' '),
              0, 0, ' ', 0, ' '
            ),
            ' '
          )
        END AS Descricao_especif,
        NULLIF(LTRIM(RTRIM(EST.Numeracao)), '') AS Numeracao
      FROM ESMATERI MAT WITH (NOLOCK)
      LEFT JOIN (
        SELECT DISTINCT
          LTRIM(RTRIM(Cd_material)) AS Cd_material,
          NULLIF(LTRIM(RTRIM(Numeracao)), '') AS Numeracao,
          NULLIF(LTRIM(RTRIM(Cd_especif1)), '') AS Cd_especif1
        FROM ESESTOQU WITH (NOLOCK)
      ) EST ON EST.Cd_material = LTRIM(RTRIM(MAT.Cd_material))
      WHERE LTRIM(RTRIM(MAT.Cd_material)) = LTRIM(RTRIM(@codigo))
    `);
    return sendJson(response, 200, result.recordset);
  }
  return sendJson(response, 404, { error: 'Endpoint não encontrado.' });
}

const server = createServer(async (request, response) => {
  try { await handle(request, response); } catch (error) { console.error(error); sendJson(response, 500, { error: error.message || 'Erro interno.' }); }
});

Promise.all([pool.connect(), cigamPool.connect()]).then(() => server.listen(port, () => console.log(`API REPTEC SQL Server em http://localhost:${port}`))).catch((error) => {
  console.error('Falha ao conectar no SQL Server:', error.message);
  process.exitCode = 1;
});
