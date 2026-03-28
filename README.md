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

## ⚙️ Modifying the UI
The network graph visualization physics (charge repulsion, collision radius, and color scheme) can be easily tweaked inside `/src/components/NetworkGraph.tsx`. 
To add or modify the standard UI elements (Search inputs, filters, tables), see `/src/App.tsx`.
