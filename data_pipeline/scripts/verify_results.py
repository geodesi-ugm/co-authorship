
import pandas as pd

links = pd.read_csv('../processed/paper_authors_links.csv')
papers = pd.read_csv('../processed/cleaned_papers.csv')
authors = pd.read_csv('../raw/combined_authors.csv')

# Get papers with more than 1 author
counts = links.groupby('paper_id').size()
multi_author_papers = counts[counts > 1].index.tolist()

print(f"Total multi-author papers: {len(multi_author_papers)}")
print("-" * 30)

for pid in multi_author_papers[:10]:
    title = papers[papers.paper_id == pid]['title'].values[0]
    author_ids = links[links.paper_id == pid]['author_id'].tolist()
    author_names = authors[authors.ID.isin(author_ids)]['Name'].tolist()
    
    print(f"Paper ID: {pid}")
    print(f"Title: {title}")
    print(f"Authors: {', '.join(author_names)}")
    print("-" * 30)
