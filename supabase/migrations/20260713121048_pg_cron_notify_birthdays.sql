CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'notify-birthdays-daily',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url:='http://host.docker.internal:54321/functions/v1/notify-birthdays',
      headers:='{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
