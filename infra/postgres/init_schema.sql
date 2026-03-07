-- Schema for Lakehouse Layers
-- Raw Layer (Landing)
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    display_id TEXT,
    category_id TEXT,
    sub_category_id TEXT,
    customer_document TEXT,
    status TEXT,
    created_at BIGINT,
    called_at BIGINT,
    started_at BIGINT,
    completed_at BIGINT,
    counter_id INTEGER
);

-- Bronze Layer (Cleaning)
CREATE TABLE IF NOT EXISTS bronze_tickets (
    id TEXT PRIMARY KEY,
    display_id TEXT,
    category_id TEXT,
    doc_type TEXT,
    doc_number TEXT,
    status TEXT,
    created_at_dt TIMESTAMP,
    wait_time_sec FLOAT,
    service_time_sec FLOAT,
    counter_id INTEGER
);

-- Silver Layer (Aggregations/Business)
CREATE TABLE IF NOT EXISTS silver_daily_metrics (
    date DATE PRIMARY KEY,
    total_tickets INTEGER,
    total_attended INTEGER,
    qwt_avg_sec FLOAT,
    aht_avg_sec FLOAT,
    visits_per_hour FLOAT,
    abandon_rate FLOAT,
    sla_compliance_pct FLOAT,
    peak_hour INTEGER,
    active_counters INTEGER
);
