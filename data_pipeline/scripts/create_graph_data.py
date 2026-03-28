
import pandas as pd
from collections import Counter

# Load data
links = pd.read_csv('../processed/paper_authors_links.csv')
papers = pd.read_csv('../processed/cleaned_papers.csv')
authors = pd.read_csv('../raw/combined_authors.csv')

# Create Nodes
# Calculate paper count for each author
author_paper_counts = links.groupby('author_id').size().to_dict()

# Calculate citations for each author
merged = links.merge(papers, on='paper_id')
author_citations = merged.groupby('author_id')['cited_by'].sum().to_dict()

nodes = authors[['ID', 'Name', 'Specialities', 'GoogleScholarID']].copy()
nodes.columns = ['id', 'name', 'specialities', 'scholar_id']
nodes['paper_count'] = nodes['id'].map(author_paper_counts).fillna(0).astype(int)
nodes['citations'] = nodes['id'].map(author_citations).fillna(0).astype(int)

# Create Edges
# For each paper, find all pairs of authors
edges_list = []
for pid, group in links.groupby('paper_id'):
    author_ids = sorted(group['author_id'].tolist())
    if len(author_ids) > 1:
        # Generate all unique pairs
        for i in range(len(author_ids)):
            for j in range(i + 1, len(author_ids)):
                edges_list.append((author_ids[i], author_ids[j]))

# Count occurrences of each pair to get weights
edge_counts = Counter(edges_list)

edges = pd.DataFrame([
    {'source': pair[0], 'target': pair[1], 'weight': count}
    for pair, count in edge_counts.items()
])

# Compute stable, precomputed layout positions (normalized 0..1)
# Use jittered grid positions to fill the whole space well.
import math
import random

n = len(nodes)
if n > 0:
    random.seed(12345)
    # padded grid so nodes are spread and not crumpled in the center
    gridSize = max(2, math.ceil(math.sqrt(n * 1.3)))
    cellJitter = 0.4 / gridSize

    gridPositions = []
    for i in range(gridSize):
        for j in range(gridSize):
            centerX = (i + 0.5) / gridSize
            centerY = (j + 0.5) / gridSize
            x = min(max(centerX + random.uniform(-cellJitter, cellJitter), 0.02), 0.98)
            y = min(max(centerY + random.uniform(-cellJitter, cellJitter), 0.02), 0.98)
            gridPositions.append((x, y))

    random.shuffle(gridPositions)

    # Keep order by degree descending to get highest-importance in spread region too
    node_order = nodes.sort_values(by='paper_count', ascending=False).index.tolist()
    coords = {}
    for idx, node_idx in enumerate(node_order):
        x, y = gridPositions[idx % len(gridPositions)]
        coords[node_idx] = { 'x': x, 'y': y }

    nodes['x'] = [coords[i]['x'] for i in nodes.index]
    nodes['y'] = [coords[i]['y'] for i in nodes.index]
else:
    nodes['x'] = []
    nodes['y'] = []

# Save
nodes.to_csv('../processed/nodes.csv', index=False)
edges.to_csv('../processed/edges.csv', index=False)

print(f"Created nodes.csv with {len(nodes)} authors in processed/")
print(f"Created edges.csv with {len(edges)} co-authorship links in processed/")
