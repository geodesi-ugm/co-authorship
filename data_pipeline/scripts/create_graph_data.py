
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

# Save
nodes.to_csv('../processed/nodes.csv', index=False)
edges.to_csv('../processed/edges.csv', index=False)

print(f"Created nodes.csv with {len(nodes)} authors in processed/")
print(f"Created edges.csv with {len(edges)} co-authorship links in processed/")
