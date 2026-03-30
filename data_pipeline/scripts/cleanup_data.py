
import pandas as pd
import json
import glob
import os
import re
from difflib import SequenceMatcher
from collections import defaultdict

def normalize_string(s):
    if not s:
        return ""
    # Lowercase, remove non-alphanumeric, remove extra spaces
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def normalize_name(name):
    if not name:
        return ""
    # Remove extra spaces, lowercase
    name = re.sub(r'\s+', ' ', name).strip().lower()
    # Replace j with y for Indonesian name variations (common)
    # But be careful, let's just do it in the matching logic
    return name

def load_authors(csv_path):
    df = pd.read_csv(csv_path)
    author_list = []
    for _, row in df.iterrows():
        aliases = [row['Name']]
        if pd.notna(row['potential_aliases']):
            aliases.extend([a.strip() for a in row['potential_aliases'].split(';')])
        
        # Add variations for j/y
        expanded_aliases = []
        for a in aliases:
            norm_a = normalize_name(a)
            expanded_aliases.append(norm_a)
            if 'j' in norm_a:
                expanded_aliases.append(norm_a.replace('j', 'y'))
            if 'y' in norm_a:
                expanded_aliases.append(norm_a.replace('y', 'j'))
        
        # Also add individual parts of the name if they are unique enough
        # (e.g., "Djurdjani", "Subaryono", "Harintaka")
        parts = re.split(r'[\s,]+', normalize_name(row['Name']))
        for p in parts:
            if len(p) > 3: # Avoid initials
                expanded_aliases.append(p)
                if 'j' in p: expanded_aliases.append(p.replace('j', 'y'))
                if 'y' in p: expanded_aliases.append(p.replace('y', 'j'))

        author_list.append({
            'id': row['ID'],
            'name': row['Name'],
            'scholar_id': row['GoogleScholarID'],
            'aliases': list(set([a for a in expanded_aliases if a.strip()]))
        })
    return author_list

def identify_authors(author_strings, known_authors):
    found_ids = set()
    
    # Pre-calculate normalized author strings
    norm_author_strings = [normalize_name(s) for s in author_strings]
    full_text = " ".join(norm_author_strings)
    
    for author in known_authors:
        matched = False
        for alias in author['aliases']:
            # Search for alias in any of the author strings
            # Use word boundaries for safety
            escaped_alias = re.escape(alias)
            if len(alias.split()) == 1:
                pattern = rf'\b{escaped_alias}\b'
            else:
                pattern = rf'{escaped_alias}'
            
            if re.search(pattern, full_text):
                found_ids.add(author['id'])
                matched = True
                break
        
        if not matched:
            # Try fuzzy match for the whole string if it's a single author string
            for norm_s in norm_author_strings:
                if len(norm_s) > 5:
                    for alias in author['aliases']:
                        if len(alias) > 5:
                            if SequenceMatcher(None, norm_s, alias).ratio() > 0.85:
                                found_ids.add(author['id'])
                                matched = True
                                break
                if matched: break
    
    return found_ids

def run_cleanup():
    authors = load_authors('../raw/combined_authors.csv')
    scholar_id_to_author = {a['scholar_id']: a for a in authors}
    
    all_papers = []
    paper_lookup = defaultdict(list) # (norm_title, year) -> list of paper indices
    
    json_files = glob.glob('../raw/data/*.json')
    
    print(f"Processing {len(json_files)} files...")
    
    for file_path in json_files:
        # Extract scholar ID from filename (e.g. data/LsZIhbcAAAAJ_dany_scholar_data.json)
        filename = os.path.basename(file_path)
        scholar_id = filename[:12]
        source_author = scholar_id_to_author.get(scholar_id)
        
        with open(file_path, 'r') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
                continue
                
            for paper in data:
                title = paper.get('title', '')
                year = paper.get('year', '')
                norm_title = normalize_string(title)
                
                if not norm_title:
                    continue
                
                author_strings = paper.get('authors', [])
                found_author_ids = identify_authors(author_strings, authors)
                
                # Always add the source author if they aren't already there
                if source_author:
                    found_author_ids.add(source_author['id'])
                
                try:
                    cited_by_raw = paper.get('cited_by', '0')
                    cited_by = int(cited_by_raw) if cited_by_raw else 0
                except (ValueError, TypeError):
                    cited_by = 0

                paper_url = paper.get('pdf_link') or paper.get('citation_url', '')
                abstract = paper.get('abstract', '')

                paper_info = {
                    'title': title,
                    'norm_title': norm_title,
                    'year': year,
                    'venue': paper.get('venue', ''),
                    'cited_by': cited_by,
                    'author_ids': found_author_ids,
                    'source_scholar_id': scholar_id,
                    'url': paper_url,
                    'abstract': abstract
                }
                
                # Check for duplicates
                is_duplicate = False
                # Try matching by title and year
                for existing_idx in paper_lookup[(norm_title, year)]:
                    existing_paper = all_papers[existing_idx]
                    # Merge author IDs
                    existing_paper['author_ids'].update(found_author_ids)
                    existing_paper['cited_by'] = max(existing_paper.get('cited_by', 0), paper_info['cited_by'])
                    # Update URL if existing is empty or if we found a pdf_link and existing is just a citation_url
                    if not existing_paper['url'] or (paper.get('pdf_link') and 'scholar.google.com' in existing_paper['url']):
                        existing_paper['url'] = paper_url
                    # Update abstract if existing is empty
                    if not existing_paper['abstract'] and abstract:
                        existing_paper['abstract'] = abstract
                    is_duplicate = True
                    break
                
                if not is_duplicate:
                    # Try matching by title only if year is missing or same
                    # (This might be too aggressive, but let's see)
                    for (t, y), indices in paper_lookup.items():
                        if t == norm_title and (not y or not year or y == year):
                            for idx in indices:
                                all_papers[idx]['author_ids'].update(found_author_ids)
                                all_papers[idx]['cited_by'] = max(all_papers[idx].get('cited_by', 0), paper_info['cited_by'])
                                if not all_papers[idx]['url'] or (paper.get('pdf_link') and 'scholar.google.com' in all_papers[idx]['url']):
                                    all_papers[idx]['url'] = paper_url
                                if not all_papers[idx]['abstract'] and abstract:
                                    all_papers[idx]['abstract'] = abstract
                                is_duplicate = True
                                break
                        if is_duplicate: break
                
                if not is_duplicate:
                    paper_idx = len(all_papers)
                    all_papers.append(paper_info)
                    paper_lookup[(norm_title, year)].append(paper_idx)

    print(f"Found {len(all_papers)} unique papers.")
    
    # Prepare output
    papers_data = []
    links_data = []
    
    for i, paper in enumerate(all_papers):
        paper_id = i + 1
        papers_data.append({
            'paper_id': paper_id,
            'title': paper['title'],
            'year': paper['year'],
            'venue': paper['venue'],
            'cited_by': paper['cited_by'],
            'author_count': len(paper['author_ids']),
            'url': paper['url'],
            'abstract': paper['abstract']
        })
        
        for author_id in paper['author_ids']:
            links_data.append({
                'paper_id': paper_id,
                'author_id': author_id
            })
            
    pd.DataFrame(papers_data).to_csv('../processed/cleaned_papers.csv', index=False)
    pd.DataFrame(links_data).to_csv('../processed/paper_authors_links.csv', index=False)
    print("Saved cleaned_papers.csv and paper_authors_links.csv to processed/")

if __name__ == "__main__":
    run_cleanup()
