// Configura leitura no banco do serviço Compose postgres. Sem --apply, só consulta.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = req('pg');
const secretFile = path.join(root, '.env.readonly');
const apply = process.argv.includes('--apply');
const settings = fs.existsSync(secretFile) ? dotenv.parse(fs.readFileSync(secretFile)) : {};
const role = settings.POSTGRES_READONLY_USER || 'oda_leitura';
assert.match(role, /^[a-z_][a-z0-9_]{0,62}$/);
const password = settings.POSTGRES_READONLY_PASSWORD || randomBytes(36).toString('base64url');
function docker(...args) { return execFileSync('docker', args, { cwd: root, encoding: 'utf8', timeout: 30000 }).trim(); }
const quote = value => '"' + value.replace(/"/g, '""') + '"';
const literal = value => "'" + value.replace(/'/g, "''") + "'";

async function main() {
  const container = docker('compose', 'ps', '-q', 'postgres');
  if (!container || container.includes('\n')) throw new Error('Inicie o serviço postgres local antes de executar.');
  const info = JSON.parse(docker('inspect', container))[0];
  const env = Object.fromEntries(info.Config.Env.map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  const binding = info.NetworkSettings.Ports['5432/tcp']?.find(b => b.HostIp === '127.0.0.1');
  if (!binding) throw new Error('Este script exige PostgreSQL publicado em loopback no host Docker local.');
  const database = env.POSTGRES_DB;
  if (settings.POSTGRES_READONLY_DB && settings.POSTGRES_READONLY_DB !== database) {
    throw new Error('.env.readonly pertence a outro banco; confira o destino antes de reutilizar as credenciais.');
  }
  const admin = new Client({ host: '127.0.0.1', port: Number(binding.HostPort), database,
    user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000 });
  await admin.connect();
  try {
    const exists = (await admin.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1', [role])).rows[0];
    console.log('Destino:', { host: '127.0.0.1', port: binding.HostPort, database, usuario: role, existe: !!exists });
    if (!apply) { console.log('Simulação: nenhuma senha, usuário ou permissão foi alterado. Use --apply.'); return; }
    if (exists) {
      if (!settings.POSTGRES_READONLY_PASSWORD) throw new Error('Usuário já existe; forneça suas credenciais em .env.readonly. A senha não será redefinida.');
      if (Object.values(exists).some(Boolean)) throw new Error('Usuário existente possui atributos administrativos; revisão manual necessária.');
      const memberships = await admin.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)', [role]);
      if (memberships.rowCount) throw new Error('Usuário existente participa de outras roles; revisão manual necessária.');
    }
    if (!fs.existsSync(secretFile)) {
      execFileSync('git', ['check-ignore', '--quiet', '.env.readonly'], { cwd: root });
      const url = new URL('postgresql://postgres:5432/');
      url.username = role; url.password = password; url.pathname = '/' + database;
      fs.writeFileSync(secretFile, [
        `POSTGRES_READONLY_USER=${role}`, `POSTGRES_READONLY_PASSWORD=${password}`,
        `POSTGRES_READONLY_DB=${database}`, `POSTGRES_READONLY_URL=${url.toString()}`, '',
      ].join('\n'), { mode: 0o600, flag: 'wx' });
    }
    await admin.query('BEGIN');
    try {
      if (!exists) await admin.query(`CREATE ROLE ${quote(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD ${literal(password)}`);
      await admin.query(`REVOKE ALL ON DATABASE ${quote(database)} FROM ${quote(role)}`);
      await admin.query(`GRANT CONNECT ON DATABASE ${quote(database)} TO ${quote(role)}`);
      await admin.query(`REVOKE ALL ON SCHEMA public FROM ${quote(role)}`);
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${quote(role)}`);
      await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${quote(role)}`);
      await admin.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${quote(role)}`);
      await admin.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${quote(role)}`);
      const owners = await admin.query(`SELECT DISTINCT pg_get_userbyid(c.relowner) AS owner FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
        UNION SELECT current_user`);
      for (const { owner } of owners.rows) {
        await admin.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(owner)} IN SCHEMA public GRANT SELECT ON TABLES TO ${quote(role)}`);
      }
      await admin.query(`ALTER ROLE ${quote(role)} SET default_transaction_read_only = on`);
      const write = await admin.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
        AND has_table_privilege($1,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`, [role]);
      assert.equal(write.rowCount, 0, 'Há privilégios de escrita herdados no schema public.');
      const create = await admin.query(`SELECT has_schema_privilege($1,'public','CREATE') OR has_database_privilege($1,current_database(),'CREATE') AS allowed`, [role]);
      assert.equal(create.rows[0].allowed, false, 'Há permissão CREATE herdada.');
      await admin.query('COMMIT');
      console.log('Usuário configurado com SELECT nas tabelas/views public atuais e futuras dos proprietários identificados.');
    } catch (error) { await admin.query('ROLLBACK'); throw error; }

    // Tabela vazia e descartável: nunca executar TRUNCATE/DROP de teste em dados do ODA.
    const probe = 'oda_readonly_probe_' + randomBytes(6).toString('hex');
    const forbidden = probe + '_forbidden';
    await admin.query(`CREATE TABLE public.${quote(probe)} (id integer)`);
    const reader = new Client({ host: '127.0.0.1', port: Number(binding.HostPort), database,
      user: role, password, connectionTimeoutMillis: 5000 });
    try {
      await reader.connect();
      assert.equal((await reader.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
      await reader.query('SELECT count(*) FROM public.producao');
      await reader.query(`SELECT * FROM public.${quote(probe)}`); // criada após o GRANT
      // Os privilégios devem bloquear escrita mesmo que a sessão desative o padrão read-only.
      await reader.query('SET default_transaction_read_only=off');
      for (const sql of [
        `INSERT INTO public.${quote(probe)} VALUES (1)`,
        `UPDATE public.${quote(probe)} SET id=2`,
        `DELETE FROM public.${quote(probe)}`,
        `TRUNCATE public.${quote(probe)}`,
        `DROP TABLE public.${quote(probe)}`,
        `CREATE TABLE public.${quote(forbidden)} (id integer)`,
      ]) {
        await assert.rejects(reader.query(sql), error => error.code === '42501');
      }
      console.log('PASS SELECT atual/futuro, login e padrão read-only; INSERT, UPDATE, DELETE, TRUNCATE, DROP e CREATE em public bloqueados por ACL.');
    } finally {
      await reader.end();
      await admin.query(`DROP TABLE IF EXISTS public.${quote(probe)}`);
      await admin.query(`DROP TABLE IF EXISTS public.${quote(forbidden)}`);
    }
    console.log('Credenciais preservadas em .env.readonly (não exibidas e ignoradas pelo Git).');
  } finally { await admin.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
