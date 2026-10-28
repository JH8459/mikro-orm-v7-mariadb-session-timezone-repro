// Copied into v6/ and v7/ before running, so @mikro-orm/* resolves from that folder.
import * as mariadb from '@mikro-orm/mariadb';
import * as core from '@mikro-orm/core';

const { MikroORM } = mariadb.MikroORM ? mariadb : mariadb.default;
const { Utils } = core.Utils ? core : core.default;

// FIX=1 (v7 only): pin the session time zone on every new pooled connection.
const fix = process.env.FIX
  ? await import('kysely').then(({ CompiledQuery }) => ({
      onCreateConnection: async (connection) => {
        await connection.executeQuery(CompiledQuery.raw("set time_zone = '+00:00'"));
      },
    }))
  : {};

const orm = await MikroORM.init({
  ...fix,
  entities: [],
  discovery: { warnWhenNoEntities: false },
  dbName: 'repro',
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'root',
  forceUtcTimezone: true,
  debug: false,
});
const em = orm.em.fork();

const [session] = await em.execute(
  `select @@global.time_zone as globalTz, @@session.time_zone as sessionTz,
          date_format(now(), '%Y-%m-%d %H:%i:%s') as nowValue,
          date_format(utc_timestamp(), '%Y-%m-%d %H:%i:%s') as utcValue`,
);

await em.execute('drop table if exists t');
await em.execute(
  'create table t (id int primary key, written_by_app datetime not null, defaulted datetime not null default current_timestamp)',
);
await em.execute('insert into t (id, written_by_app) values (1, ?)', [new Date()]);
const [row] = await em.execute(
  `select date_format(written_by_app, '%Y-%m-%d %H:%i:%s') as writtenByApp,
          date_format(defaulted, '%Y-%m-%d %H:%i:%s') as defaulted from t where id = 1`,
);

console.log(JSON.stringify({ mikroOrm: Utils.getORMVersion(), fix: Boolean(process.env.FIX), ...session, ...row }));
await orm.close();
