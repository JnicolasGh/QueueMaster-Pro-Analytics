import pandas as pd
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv
import datetime

load_dotenv()

def normalize_database_url(db_url: str) -> str:
    if db_url.startswith("postgres://"):
        return db_url.replace("postgres://", "postgresql://", 1)
    return db_url

def run_pipeline():
    print(f"[{datetime.datetime.now()}] Starting Raw to Bronze ETL...")

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment.")
        return

    engine = create_engine(normalize_database_url(db_url))

    try:
        # 1. Extract from Raw (Postgres 'tickets' table)
        df_raw = pd.read_sql("SELECT * FROM tickets", engine)

        if df_raw.empty:
            print("No data found in raw layer.")
            return

        # 2. Clean & Transform
        # - Convert BIGINT timestamps to datetime
        df_raw["created_at_dt"] = pd.to_datetime(df_raw["created_at"], unit="ms", errors="coerce")

        # - Split document type and number (e.g., "CC 12345" -> "CC", "12345")
        doc_series = df_raw["customer_document"].fillna("").astype(str)
        df_raw[["doc_type", "doc_number"]] = doc_series.str.extract(r"^(\w+)\s+(.*)$")

        # - Calculate wait time if called
        df_raw["wait_time_sec"] = (df_raw["called_at"] - df_raw["created_at"]) / 1000

        # - Calculate service time if completed
        df_raw["service_time_sec"] = (df_raw["completed_at"] - df_raw["started_at"]) / 1000

        # 3. Load to Bronze Layer
        # Keep the same schema as infra/postgres/init_schema.sql.
        bronze_df = df_raw[[
            "id",
            "display_id",
            "category_id",
            "doc_type",
            "doc_number",
            "status",
            "created_at_dt",
            "wait_time_sec",
            "service_time_sec",
            "counter_id",
        ]].copy()

        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
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
                )
                """
            )
            conn.exec_driver_sql("TRUNCATE TABLE bronze_tickets")

        bronze_df.to_sql("bronze_tickets", engine, if_exists="append", index=False)

        print(f"Successfully processed {len(bronze_df)} records into Bronze layer.")

    except Exception as e:
        print(f"Pipeline failed: {e}")

if __name__ == "__main__":
    run_pipeline()
