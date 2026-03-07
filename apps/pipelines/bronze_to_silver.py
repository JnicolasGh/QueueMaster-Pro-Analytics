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
    print(f"[{datetime.datetime.now()}] Starting Bronze to Silver ETL...")

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment.")
        return

    engine = create_engine(normalize_database_url(db_url))

    try:
        # 1. Extract from Bronze
        df_bronze = pd.read_sql("SELECT * FROM bronze_tickets", engine)

        if df_bronze.empty:
            print("No data found in bronze layer.")
            return

        # 2. Transform (Aggregations)
        # Group by date and calculate KPIs
        df_bronze["date"] = pd.to_datetime(df_bronze["created_at_dt"], errors="coerce").dt.date
        df_bronze["hour"] = pd.to_datetime(df_bronze["created_at_dt"], errors="coerce").dt.hour

        # Helper for peak hour
        def get_peak_hour(x):
            return x.value_counts().idxmax() if not x.empty else None

        silver_metrics = df_bronze.groupby("date").agg(
            total_tickets=("id", "count"),
            total_attended=("status", lambda x: (x == "completed").sum()),
            qwt_avg_sec=("wait_time_sec", "mean"),
            aht_avg_sec=("service_time_sec", "mean"),
            abandon_rate=("status", lambda x: (x == "no_show").sum() / len(x) if len(x) > 0 else 0),
            sla_compliance_pct=("wait_time_sec", lambda x: (x < 900).sum() / len(x) * 100 if len(x) > 0 else 0),
            peak_hour=("hour", get_peak_hour),
            active_counters=("counter_id", "nunique"),
        ).reset_index()

        # Calculate Visits per Hour (Ratio)
        # We assume an 8-hour operation day for the ratio, or we can calculate based on actual range
        silver_metrics["visits_per_hour"] = silver_metrics["total_tickets"] / 8.0

        # 3. Load to Silver Layer
        with engine.begin() as conn:
            conn.exec_driver_sql(
                """
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
                )
                """
            )
            conn.exec_driver_sql("TRUNCATE TABLE silver_daily_metrics")

        silver_metrics.to_sql("silver_daily_metrics", engine, if_exists="append", index=False)

        print(f"Successfully updated Silver layer with {len(silver_metrics)} days of metrics.")

    except Exception as e:
        print(f"Pipeline failed: {e}")

if __name__ == "__main__":
    run_pipeline()
