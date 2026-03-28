# Co-Authorship Data Pipeline

This directory contains the Python scripts and data necessary to clean, verify, and prepare raw Google Scholar JSON data for force-directed co-authorship visualization.

## Directory Structure
- `raw/`: Contains the messy data fetched from Scholar (`data/` folder full of JSONs) and our canonical dictionary (`combined_authors.csv`).
- `scripts/`: Contains the python pipeline scripts.
- `processed/`: The clean output files ready for graphing.

## Pipeline Steps
Whenever you retrieve new data or update the JSON files in the `raw/data/` folder, open your terminal, navigate into the `scripts/` directory, and run the following steps in sequence:

```bash
cd data_pipeline/scripts
```

---

### Step 1: Clean and Consolidate Raw Data
Parses through all the messy `.json` files. It uses known aliases to merge duplicate papers and untangle concatenated author strings.
```bash
python3 cleanup_data.py
```
**↳ Outputs (in `processed/`)**:
- `cleaned_papers.csv` (A list of definitively unique papers)
- `paper_authors_links.csv` (Mapping records connecting authors to paper IDs)

---

### Step 2: Generate Network Graph Data
Transforms the outputs of Step 1 into standardized `nodes` and `edges` format.
```bash
python3 create_graph_data.py
```
**↳ Outputs (in `processed/`)**:
- `nodes.csv` (List of vertices, which are the Authors with their attributes)
- `edges.csv` (List of graph links, denoting how many times two authors co-authored a paper)

---

### Step 3: Run Verification Sanity Checks
Confirm nothing broke by running the verification script. It ensures all nodes are correctly connected, verifies no paper has 0 contributors, and catches any inconsistencies.
```bash
python3 verify_cleanup.py
```
↳ Review the terminal output and look for `✅ No critical issues found!`

---

## 🛠️ Modifying Author Aliases
If an author's name isn't reliably hooking up to their colleagues, supply a new alias:
1. Open `raw/combined_authors.csv`.
2. Append their missing name to the `potential_aliases` column. Ensure the aliases are separated by **semicolons** (`;`).

**Testing Aliases**:
To test if the new string matching catches a difficult concatenation (without rerunning everything), add the test string into `test_name_matching.py` and run:
```bash
python3 test_name_matching.py
```
