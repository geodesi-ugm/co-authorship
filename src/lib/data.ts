import * as d3 from 'd3';

export interface Node {
  id: string;
  name: string;
  specialities: string;
  scholar_id: string;
  paper_count: number;
  citations: number;
  degree?: number;
  fx?: number | null;
  fy?: number | null;
  x?: number;
  y?: number;
}

export interface Edge {
  source: string | Node;
  target: string | Node;
  weight: number;
}

export interface Paper {
  paper_id: string;
  title: string;
  year: number | null;
  venue: string;
  cited_by: number;
  author_count: number;
}

export interface PaperLink {
  paper_id: string;
  author_id: string;
}

export interface DashboardData {
  nodes: Node[];
  edges: Edge[];
  papers: Paper[];
  links: PaperLink[];
}

const dataBaseUrl = import.meta.env.BASE_URL || '/'
const dataUrl = (file: string) => {
  const base = dataBaseUrl.endsWith('/') ? dataBaseUrl : `${dataBaseUrl}/`
  return new URL(`data/${file}`, base).toString()
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [rawNodes, rawEdges, rawPapers, rawLinks] = await Promise.all([
    d3.csv(dataUrl('nodes.csv')),
    d3.csv(dataUrl('edges.csv')),
    d3.csv(dataUrl('cleaned_papers.csv')),
    d3.csv(dataUrl('paper_authors_links.csv'))
  ]);

  const edges = rawEdges.map(d => ({
    source: d.source!,
    target: d.target!,
    weight: parseInt(d.weight || '1')
  }));

  // Calculate degrees (connections)
  const degrees = new Map<string, number>();
  edges.forEach(e => {
    degrees.set(e.source as string, (degrees.get(e.source as string) || 0) + 1);
    degrees.set(e.target as string, (degrees.get(e.target as string) || 0) + 1);
  });

  const nodes = rawNodes.map(d => ({
    id: d.id!,
    name: d.name!,
    specialities: d.specialities || '',
    scholar_id: d.scholar_id || '',
    paper_count: parseInt(d.paper_count || '0'),
    citations: parseInt(d.citations || '0'),
    degree: degrees.get(d.id!) || 0,
    x: d.x ? parseFloat(d.x) : undefined,
    y: d.y ? parseFloat(d.y) : undefined,
  }));

  const papers = rawPapers.map(d => {
    let year = parseInt(d.year || '');
    return {
      paper_id: d.paper_id!,
      title: d.title!,
      year: isNaN(year) ? null : year,
      venue: d.venue || '',
      cited_by: parseInt(d.cited_by || '0'),
      author_count: parseInt(d.author_count || '0')
    };
  });

  const links = rawLinks.map(d => ({
    paper_id: d.paper_id!,
    author_id: d.author_id!
  }));

  return { nodes, edges, papers, links };
}
