import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Node } from '../lib/data';

const SPECIALTY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1',
];

interface AuthorScatterChartProps {
  nodes: Node[];
  selectedNodeId: string | null;
  onNodeClick: (node: Node | null) => void;
}

export function AuthorScatterChart({ nodes, selectedNodeId, onNodeClick }: AuthorScatterChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth || 460;
    const height = svgRef.current.clientHeight || 340;
    const margin = { top: 16, right: 16, bottom: 40, left: 48 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const parseSpec = (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

    const topSpecs = Array.from(
      d3.rollup(
        nodes.map(n => parseSpec(n.specialities)[0]).filter(Boolean) as string[],
        v => v.length, k => k,
      ),
    ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);

    const colorScale = d3.scaleOrdinal<string>().domain(topSpecs).range(SPECIALTY_COLORS);
    const colorForNode = (node: Node) => {
      const spec = parseSpec(node.specialities)[0];
      return spec && topSpecs.includes(spec) ? colorScale(spec) : '#94a3b8';
    };

    const x = d3.scaleLinear()
      .domain([0, d3.max(nodes, d => d.paper_count) || 10]).nice().range([0, innerWidth]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(nodes, d => d.citations) || 10]).nice().range([innerHeight, 0]);
    const r = d3.scaleSqrt<number, number>()
      .domain([0, d3.max(nodes, d => d.degree || 0) || 1]).range([3, 13]);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const zoomRoot = svg.append('g');
    const g = zoomRoot.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        zoomRoot.attr('transform', event.transform);
      });
    svg.call(zoom as any);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#e2e8f0'))
      .call(g => g.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', 10));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(7))
      .call(g => g.select('.domain').attr('stroke', '#e2e8f0'))
      .call(g => g.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', 10));

    const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

    const dots = g.selectAll('circle').data(nodes).join('circle')
      .attr('cx', d => x(d.paper_count))
      .attr('cy', d => y(d.citations))
      .attr('r', d => r(d.degree || 0))
      .attr('fill', d => selectedNodeId === d.id ? '#1d4ed8' : colorForNode(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', d => selectedNodeId === d.id ? 2 : 0.8)
      .style('cursor', 'pointer');

    const updateOpacity = () => {
      dots.attr('fill-opacity', d => {
        if (!selectedNodeId) return 0.75;
        return d.id === selectedNodeId ? 1 : 0.15;
      });
    };

    updateOpacity();

    dots.on('mouseover', function(event, d) {
      d3.select(this).attr('stroke', '#64748b').attr('stroke-width', 2).attr('fill-opacity', 1);
      g.selectAll('circle').filter((node: any) => node.id !== d.id && node.id !== selectedNodeId)
        .attr('fill-opacity', 0.1);
    })
    .on('mouseout', function(event, d) {
      const node: any = d;
      d3.select(this).attr('stroke', '#ffffff')
        .attr('stroke-width', node.id === selectedNodeId ? 2 : 0.8);
      updateOpacity();
    })
    .on('click', (event: MouseEvent, d) => {
      event.stopPropagation();
      onNodeClick(d);
    });

    dots.append('title')
      .text(d => `${d.name}\nPapers: ${d.paper_count}\nCitations: ${d.citations}\nDegree: ${d.degree || 0}`);

    g.append('text')
      .attr('x', innerWidth / 2).attr('y', innerHeight + 32)
      .attr('text-anchor', 'middle').attr('fill', '#64748b').attr('font-size', 11)
      .text('Paper Count');

    g.append('text')
      .attr('x', -innerHeight / 2).attr('y', -34)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle').attr('fill', '#64748b').attr('font-size', 11)
      .text('Citations');

    svg.on('click', () => {
      onNodeClick(null);
    });

  }, [nodes, onNodeClick, selectedNodeId]);

  return <svg ref={svgRef} className="h-full w-full" />;
}
