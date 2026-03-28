import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Node } from '../lib/data';

const SPECIALTY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1',
];

interface CoauthorLink {
  node: Node;
  weight: number;
}

interface AuthorEgoGraphProps {
  centerNode: Node | null;
  coauthors: CoauthorLink[];
  selectedNodeId: string | null;
  onNodeClick: (node: Node | null) => void;
}

export function AuthorEgoGraph({ centerNode, coauthors, selectedNodeId, onNodeClick }: AuthorEgoGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth || 480;
    const height = svgRef.current.clientHeight || 300;
    const cx = width / 2;
    const cy = height / 2;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!centerNode) {
      svg.append('text')
        .attr('x', cx).attr('y', cy)
        .text('Select an author to see co-authors')
        .attr('fill', '#94a3b8').attr('font-size', 13).attr('text-anchor', 'middle');
      return;
    }

    const parseSpec = (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

    const allSpecs = [
      ...parseSpec(centerNode.specialities),
      ...coauthors.flatMap(c => parseSpec(c.node.specialities)),
    ];
    const specCounts = d3.rollup(allSpecs, v => v.length, s => s);
    const topSpecs = Array.from(specCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
    const colorScale = d3.scaleOrdinal<string>().domain(topSpecs).range(SPECIALTY_COLORS);
    const nodeColor = (node: Node) => {
      const key = parseSpec(node.specialities)[0];
      return key && topSpecs.includes(key) ? colorScale(key) : '#94a3b8';
    };

    const maxCitations = d3.max(coauthors, d => d.node.citations) || 1;
    const maxWeight = d3.max(coauthors, d => d.weight) || 1;
    const ringRadius = Math.min(width, height) * 0.36;
    const centerRadius = 16;
    const coauthorRadius = d3.scaleSqrt<number, number>()
      .domain([0, maxCitations]).range([7, 18]);

    const zoomRoot = svg.append('g');
    const graph = zoomRoot.append('g').attr('transform', `translate(${cx},${cy})`);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        zoomRoot.attr('transform', event.transform);
      });
    svg.call(zoom as any);

    const angleStep = coauthors.length ? (Math.PI * 2) / coauthors.length : 0;

    const positioned = coauthors.map((coauthor, i) => {
      const angle = angleStep * i - Math.PI / 2;
      return { ...coauthor, x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius };
    });

    graph.append('circle')
      .attr('r', ringRadius).attr('fill', 'none')
      .attr('stroke', '#e2e8f0').attr('stroke-dasharray', '3 5').attr('opacity', 0.7);

    graph.selectAll('line').data(positioned).join('line')
      .attr('x1', 0).attr('y1', 0).attr('x2', d => d.x).attr('y2', d => d.y)
      .attr('stroke', '#cbd5e1').attr('stroke-opacity', 0.7)
      .attr('stroke-width', d => 0.6 + (d.weight / maxWeight) * 2.5);

    const nodesG = graph.selectAll('g.coauthor').data(positioned).join('g')
      .attr('class', 'coauthor')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => { event.stopPropagation(); onNodeClick(d.node); });

    nodesG.append('circle')
      .attr('r', d => coauthorRadius(d.node.citations))
      .attr('fill', d => nodeColor(d.node))
      .attr('stroke', d => d.node.id === selectedNodeId ? '#1d4ed8' : '#ffffff')
      .attr('stroke-width', d => d.node.id === selectedNodeId ? 2.5 : 1.5)
      .attr('opacity', 0.9);

    nodesG.append('text')
      .attr('y', d => coauthorRadius(d.node.citations) + 12)
      .attr('text-anchor', 'middle').attr('fill', '#475569').attr('font-size', 10)
      .text(d => d.node.name.length > 16 ? `${d.node.name.slice(0, 16)}…` : d.node.name);

    nodesG.append('title')
      .text(d => `${d.node.name}\nStrength: ${d.weight}\nCitations: ${d.node.citations}\nPapers: ${d.node.paper_count}`);

    const centerGroup = graph.append('g').style('cursor', 'pointer')
      .on('click', event => { event.stopPropagation(); onNodeClick(centerNode); });

    centerGroup.append('circle')
      .attr('r', centerRadius).attr('fill', '#1d4ed8').attr('stroke', '#ffffff').attr('stroke-width', 2);

    centerGroup.append('text')
      .attr('y', 4).attr('text-anchor', 'middle')
      .attr('fill', '#ffffff').attr('font-size', 10).attr('font-weight', 700)
      .text('YOU');

    svg.on('click', () => onNodeClick(null));
  }, [centerNode, coauthors, onNodeClick, selectedNodeId]);

  return <svg ref={svgRef} className="h-full w-full" />;
}
