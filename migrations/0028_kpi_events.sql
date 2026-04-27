-- 0028_kpi_events.sql
--
-- Generic KPI event log. Captures product/AI telemetry that previously
-- lived only in the application logs (e.g. AI filename-suggestion
-- accept rate from the bulk-document-import sorting step). Schemaless
-- beyond the columns the aggregation queries always need so new
-- metrics can be added without further migrations.
--
-- See `shared/schemas/kpi.ts` for the full per-metric vocabulary.

CREATE TABLE IF NOT EXISTS kpi_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key      text        NOT NULL,
  outcome         text        NOT NULL,
  organization_id varchar,
  user_id         varchar,
  dimensions      jsonb,
  payload         jsonb,
  created_at      timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kpi_events_metric_key_idx
  ON kpi_events (metric_key);

CREATE INDEX IF NOT EXISTS kpi_events_metric_created_idx
  ON kpi_events (metric_key, created_at);

CREATE INDEX IF NOT EXISTS kpi_events_org_idx
  ON kpi_events (organization_id);
