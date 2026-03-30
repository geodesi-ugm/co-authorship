# Co-Authorship Dashboard

A Co-authorship dashboard for Geodetic Engineering UGM's lecturers. Interactive, responsive visualization and analysis of Google Scholar co-authorship networks.

## Project Structure

- `/data_pipeline`: The Python backend utilities. Converts messy, raw Google Scholar JSONs into clean, deduplicated, and graph-ready `nodes.csv` and `edges.csv` files. Extrapolates citation counts and specialities.
- `/src`: The Vite + React frontend code. Houses all the interactive D3.js layers (`src/components/NetworkGraph.tsx`, etc) and `shadcn/ui` components for an elegant dark-themed interface.
- `/public/data`: Holds the static CSV datasets read by the dashboard.

## Quickstart

### 1. Generating Data
If you update the raw Scholar `.json` dumps or add new aliases to `/data_pipeline/raw/combined_authors.csv`, re-run the pipeline to clean the data:

```bash
cd data_pipeline/scripts
# Clean, link, and export the datasets
python3 cleanup_data.py
python3 create_graph_data.py
python3 verify_cleanup.py
```
After successfully running the pipeline, copy the generated `.csv` files from `data_pipeline/processed/` into `/public/data/` for the dashboard to read.

### 2. Running the Dashboard
The dashboard is built using Vite, React, and Tailwind CSS v3. Ensure you have Node.js installed.

```bash
# Return to root directory
cd ../..

# Install required dependencies
npm install

# Start the local development server
npm run dev
```

Navigate your browser to `http://localhost:5173/` to view the interactive network graph.

## Tech Stack & Key Features
- **Frontend Environment**: React + TypeScript + Vite.
- **Visualizations**: Direct `d3.js` DOM manipulation mapped via standard React `useRef` hooks to ensure peak physics performance without rendering bottlenecks.
  - **Force-Directed Graph**: Drag, pin, pan, and zoom the network. Visual node scaling based on Papers, Citations, or Connections.
  - **Bar Charts**: Author contribution timelines and top specialities.
- **Styling**: `tailwindcss` combined with `shadcn/ui` for premium, clean UI elements. Dark mode by default.

## GitHub Pages Deployment

### Setup (already done in this repo)
- `package.json` includes:
  - `homepage`: `https://danylaksono.is-a.dev/co-authorship`
  - `predeploy`: `npm run build`
  - `deploy`: `npm install --no-save gh-pages && npx gh-pages -d dist`
- `vite.config.ts` includes:
  - `base: (import.meta.env.VITE_BASE_URL as string) || "/co-authorship/"`
- `.env` includes:
  - `VITE_BASE_URL=/co-authorship/`

### Deploy with script
```bash
npm install
npm run build
npm run deploy
```

Then in GitHub:
1. Settings → Pages
2. Source: `gh-pages` branch
3. Folder: `/ (root)`
4. Save

Your site will be available at: `https://danylaksono.is-a.dev/co-authorship`

### Deploy with GitHub Actions (alternative)
Create `.github/workflows/gh-pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches:
      - main
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm install --no-save gh-pages
      - run: npx gh-pages -d dist
```

Then set Pages source to `gh-pages` branch.

### Fork / org migration
- Update `.env`: `VITE_BASE_URL=/new-repo-name/`
- Update `package.json.homepage` to `https://<org>.github.io/<new-repo-name>`
- Re-run `npm run deploy` / push workflow


