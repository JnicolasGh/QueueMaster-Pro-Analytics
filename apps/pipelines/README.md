# Pipelines for Lakehouse
This folder contains the ETL pipelines.

## Requirements
- Python 3.10+
- Packages from `environment.yml` (`pandas`, `sqlalchemy`, `python-dotenv`, `psycopg2`)
- `DATABASE_URL` configured (via environment variable or `.env`)

## Run
Windows (PowerShell):
```powershell
python apps/pipelines/raw_to_bronze.py
python apps/pipelines/bronze_to_silver.py
```

Linux/macOS:
```bash
python apps/pipelines/raw_to_bronze.py
python apps/pipelines/bronze_to_silver.py
```

`make run-raw-to-bronze` and `make run-bronze-to-silver` are optional wrappers and require `make` installed.
