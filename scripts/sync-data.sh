#!/usr/bin/env bash
set -euo pipefail

cp data_pipeline/processed/nodes.csv public/data/nodes.csv
cp data_pipeline/processed/edges.csv public/data/edges.csv

echo "Synced nodes.csv and edges.csv to public/data/"