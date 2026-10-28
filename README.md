# mikro-orm-v7-mariadb-session-timezone-repro

With the same config (`forceUtcTimezone: true`), `@mikro-orm/mariadb` 6 sets the session time zone to UTC and 7 does not. In 7 the session follows the server default, so `now()` and `current_timestamp` column defaults stop matching the UTC values the ORM writes.

MikroORM passes `timezone: 'Z'` to the client in both versions. The `mariadb` client used in 6 turns that into `SET time_zone`. `mysql2`, used in 7, only applies it when converting `Date` values.

Node v24.11.0, MariaDB 11.4 started with `--default-time-zone=+09:00`, `@mikro-orm/mariadb` 6.6.17 and 7.2.5.

## Run

```sh
docker run -d --rm --name mikro-tz-repro -p 3307:3306 \
  -e MARIADB_ROOT_PASSWORD=root -e MARIADB_DATABASE=repro \
  mariadb:11.4 --default-time-zone=+09:00

for v in v6 v7; do cp repro.mjs $v/ && (cd $v && npm install && node repro.mjs); done
(cd v7 && FIX=1 node repro.mjs)

docker stop mikro-tz-repro
```

`repro.mjs` reads the session time zone, then inserts one row where `written_by_app` comes from `new Date()` and `defaulted` comes from `default current_timestamp`. Values are read back with `date_format` so the client does not convert them again. `FIX=1` adds an `onCreateConnection` hook that runs `set time_zone = '+00:00'`.

## Output

```
{"mikroOrm":"6.6.17","globalTz":"+09:00","sessionTz":"+00:00","nowValue":"2026-10-28 01:33:37","utcValue":"2026-10-28 01:33:37","writtenByApp":"2026-10-28 01:33:37","defaulted":"2026-10-28 01:33:37"}
{"mikroOrm":"7.2.5","fix":false,"globalTz":"+09:00","sessionTz":"+09:00","nowValue":"2026-10-28 10:35:32","utcValue":"2026-10-28 01:35:32","writtenByApp":"2026-10-28 01:35:32","defaulted":"2026-10-28 10:35:32"}
{"mikroOrm":"7.2.5","fix":true,"globalTz":"+09:00","sessionTz":"+00:00","nowValue":"2026-10-28 01:35:32","utcValue":"2026-10-28 01:35:32","writtenByApp":"2026-10-28 01:35:32","defaulted":"2026-10-28 01:35:32"}
```

In 7 without the hook, the two columns of the same row are nine hours apart.
