#!/usr/bin/env bash
set -euo pipefail

cp data_pipeline/processed/nodes.csv public/data/nodes.csv
cp data_pipeline/processed/edges.csv public/data/edges.csv
cp data_pipeline/processed/cleaned_papers.csv public/data/cleaned_papers.csv
cp data_pipeline/processed/paper_authors_links.csv public/data/paper_authors_links.csv

echo "Synced all processed data to public/data/"