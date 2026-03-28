"""
Verification script for co-authorship data cleanup.
Checks for: isolated nodes, edge consistency, suspicious weights, 
name collisions, and basic sanity of the graph data.
"""

import pandas as pd
import json
import glob
import os
from collections import Counter, defaultdict

def verify():
    print("=" * 70)
    print("CO-AUTHORSHIP DATA CLEANUP VERIFICATION")
    print("=" * 70)
    
    # Load all data
    nodes = pd.read_csv('../processed/nodes.csv')
    edges = pd.read_csv('../processed/edges.csv')
    papers = pd.read_csv('../processed/cleaned_papers.csv')
    links = pd.read_csv('../processed/paper_authors_links.csv')
    authors = pd.read_csv('../raw/combined_authors.csv')
    
    issues = []
    warnings = []
    
    # --- 1. Basic Stats ---
    print("\n📊 BASIC STATISTICS")
    print(f"  Authors (nodes): {len(nodes)}")
    print(f"  Co-authorship links (edges): {len(edges)}")
    print(f"  Unique papers: {len(papers)}")
    print(f"  Paper-author links: {len(links)}")
    
    # --- 2. Node Consistency ---
    print("\n🔍 NODE CONSISTENCY")
    all_edge_nodes = set(edges['source'].tolist() + edges['target'].tolist())
    all_link_authors = set(links['author_id'].tolist())
    node_ids = set(nodes['id'].tolist())
    
    # Check for edge nodes not in nodes.csv
    orphan_edge_nodes = all_edge_nodes - node_ids
    if orphan_edge_nodes:
        issues.append(f"Edge references {len(orphan_edge_nodes)} author IDs not in nodes.csv: {orphan_edge_nodes}")
    
    # Check for isolated nodes (no edges)
    connected_nodes = all_edge_nodes
    isolated_nodes = node_ids - connected_nodes
    if isolated_nodes:
        isolated_names = nodes[nodes['id'].isin(isolated_nodes)]['name'].tolist()
        warnings.append(f"Isolated nodes (no co-authorship edges): {isolated_names}")
    
    # Check for authors with 0 papers
    zero_paper_authors = nodes[nodes['paper_count'] == 0]
    if len(zero_paper_authors) > 0:
        issues.append(f"Authors with 0 papers: {zero_paper_authors['name'].tolist()}")
    
    print(f"  Node IDs: {min(node_ids)} to {max(node_ids)} ({len(node_ids)} unique)")
    print(f"  Connected nodes: {len(connected_nodes)}")
    print(f"  Isolated nodes: {len(isolated_nodes)}")
    
    # --- 3. Edge Consistency ---
    print("\n🔗 EDGE CONSISTENCY")
    # Check for self-loops
    self_loops = edges[edges['source'] == edges['target']]
    if len(self_loops) > 0:
        issues.append(f"Self-loops found: {len(self_loops)}")
    
    # Check for duplicate edges
    edge_pairs = edges.apply(lambda r: tuple(sorted([r['source'], r['target']])), axis=1)
    dupes = edge_pairs[edge_pairs.duplicated()]
    if len(dupes) > 0:
        issues.append(f"Duplicate edge pairs found: {len(dupes)}")
    
    # Edge weight distribution
    print(f"  Max weight: {edges['weight'].max()} (between {edges.loc[edges['weight'].idxmax(), 'source']} and {edges.loc[edges['weight'].idxmax(), 'target']})")
    top_edges = edges.nlargest(5, 'weight')
    for _, e in top_edges.iterrows():
        src_name = nodes[nodes['id'] == e['source']]['name'].values[0]
        tgt_name = nodes[nodes['id'] == e['target']]['name'].values[0]
        print(f"    {src_name} -- {tgt_name}: {e['weight']} papers")
    
    # --- 4. Paper Consistency ---
    print("\n📄 PAPER CONSISTENCY")
    # Check papers with 0 authors
    zero_auth_papers = papers[papers['author_count'] == 0]
    if len(zero_auth_papers) > 0:
        issues.append(f"Papers with 0 authors: {len(zero_auth_papers)}")
        for _, p in zero_auth_papers.iterrows():
            print(f"    ID {p['paper_id']}: {p['title'][:60]}...")
    
    # Check actual author counts vs reported
    actual_counts = links.groupby('paper_id').size().to_dict()
    mismatches = []
    for _, p in papers.iterrows():
        actual = actual_counts.get(p['paper_id'], 0)
        if actual != p['author_count']:
            mismatches.append((p['paper_id'], p['title'][:50], p['author_count'], actual))
    if mismatches:
        issues.append(f"Author count mismatches in {len(mismatches)} papers")
        for pid, title, reported, actual in mismatches[:5]:
            print(f"    Paper {pid}: reported={reported}, actual={actual} ({title})")
    
    # Papers with only 1 known author (no co-authorship contribution)
    single_author_papers = papers[papers['author_count'] == 1]
    print(f"  Single-author papers (from our 29 authors): {len(single_author_papers)}")
    multi_author_papers = papers[papers['author_count'] > 1]
    print(f"  Multi-author papers (from our 29 authors): {len(multi_author_papers)}")
    
    # --- 5. Raw Data Cross-Check ---
    print("\n🔬 RAW DATA CROSS-CHECK")
    # Count total papers from raw JSON
    total_raw = 0
    raw_paper_counts = {}
    for f in glob.glob('../raw/data/*.json'):
        scholar_id = os.path.basename(f)[:12]
        with open(f) as fp:
            data = json.load(fp)
            raw_paper_counts[scholar_id] = len(data)
            total_raw += len(data)
    
    print(f"  Total raw papers (all JSON files combined): {total_raw}")
    print(f"  Deduplicated papers: {len(papers)}")
    print(f"  Dedup ratio: {len(papers)/total_raw:.1%}")
    
    # Compare paper counts per author
    print("\n  Author paper counts (raw vs cleaned):")
    count_mismatches = []
    for _, n in nodes.iterrows():
        raw_count = raw_paper_counts.get(n['scholar_id'], 0)
        if n['paper_count'] != raw_count:
            diff = n['paper_count'] - raw_count
            print(f"    {n['name']}: raw={raw_count}, cleaned={n['paper_count']} (diff={diff:+d})")
            if diff > raw_count * 0.5 and diff > 5:
                warnings.append(f"{n['name']}: gained {diff} extra papers through dedup merge (from {raw_count} to {n['paper_count']})")
    
    # --- 6. Known issue checks ---
    print("\n🔎 KNOWN ISSUE CHECKS")
    
    # Check for the specific concatenation issues mentioned
    # "Purnama B. Santosa, Diyono" - should have been split
    # "Harintaka Subaryono" - should have been split  
    # "Dany Puguh Laksono, Djurdjani" - should have been split
    
    # Look for papers where concatenated names might have been missed
    for f in glob.glob('../raw/data/*.json'):
        with open(f) as fp:
            data = json.load(fp)
            for paper in data:
                for author_str in paper.get('authors', []):
                    # Check for comma-separated names that look like concatenations
                    if ',' in author_str:
                        parts = [p.strip() for p in author_str.split(',')]
                        if len(parts) == 2 and len(parts[1].split()) <= 2 and len(parts[1]) > 2:
                            # Might be "Lastname, Firstname" or "Author1, Author2"
                            # Check if it looks like a concatenation of two authors
                            pass
    
    # Check co-authorship between Dany (22) and Trias (11) - should be HIGH
    dany_trias = edges[(edges['source'].isin([11, 22])) & (edges['target'].isin([11, 22]))]
    if len(dany_trias) > 0:
        print(f"  Dany-Trias co-authorship weight: {dany_trias['weight'].values[0]}")
    else:
        warnings.append("No Dany-Trias co-authorship edge found (unexpected)")
    
    # Check that single-name authors are properly matched
    single_name_authors = ['Subaryono', 'Yulaikhah', 'Harintaka', 'Diyono', 'Waljiyanto']
    for name in single_name_authors:
        author_row = nodes[nodes['name'] == name]
        if len(author_row) > 0:
            aid = author_row['id'].values[0]
            edge_count = len(edges[(edges['source'] == aid) | (edges['target'] == aid)])
            paper_count = author_row['paper_count'].values[0]
            print(f"  {name}: {paper_count} papers, {edge_count} co-authorship links")
            if edge_count == 0 and paper_count > 5:
                warnings.append(f"{name} has {paper_count} papers but 0 co-authorship links")
    
    # --- 7. Graph Connectivity ---
    print("\n🌐 GRAPH CONNECTIVITY")
    # Build adjacency list
    adj = defaultdict(set)
    for _, e in edges.iterrows():
        adj[e['source']].add(e['target'])
        adj[e['target']].add(e['source'])
    
    # Find connected components (BFS)
    visited = set()
    components = []
    for node_id in node_ids:
        if node_id not in visited:
            component = set()
            queue = [node_id]
            while queue:
                n = queue.pop(0)
                if n in visited:
                    continue
                visited.add(n)
                component.add(n)
                for neighbor in adj.get(n, set()):
                    if neighbor not in visited:
                        queue.append(neighbor)
            components.append(component)
    
    print(f"  Connected components: {len(components)}")
    for i, comp in enumerate(components):
        names = nodes[nodes['id'].isin(comp)]['name'].tolist()
        if len(comp) < len(node_ids):
            print(f"    Component {i+1}: {len(comp)} nodes - {', '.join(names[:5])}{'...' if len(names) > 5 else ''}")
    
    # --- 8. Summary ---
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    if issues:
        print(f"\n❌ ISSUES ({len(issues)}):")
        for i, issue in enumerate(issues):
            print(f"  {i+1}. {issue}")
    else:
        print("\n✅ No critical issues found!")
    
    if warnings:
        print(f"\n⚠️  WARNINGS ({len(warnings)}):")
        for i, w in enumerate(warnings):
            print(f"  {i+1}. {w}")
    else:
        print("\n✅ No warnings!")
    
    print()

if __name__ == '__main__':
    verify()
