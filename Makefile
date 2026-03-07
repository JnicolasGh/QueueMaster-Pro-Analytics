.PHONY: help run-raw-to-bronze run-bronze-to-silver

help:
	@echo "Lakehouse Commands:"
	@echo "  make run-raw-to-bronze    - Clean raw data into bronze layer"
	@echo "  make run-bronze-to-silver - Transform bronze into silver metrics"

run-raw-to-bronze:
	python apps/pipelines/raw_to_bronze.py

run-bronze-to-silver:
	python apps/pipelines/bronze_to_silver.py
