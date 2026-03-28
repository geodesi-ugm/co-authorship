import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Edge, Node } from '../lib/data';

const SPECIALTY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1',
];

interface SpecialtyChordChartProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSpecialtyClick: (specialty: string) => void;
}

export function SpecialtyChordChart({ nodes, edges, selectedNodeId, onSpecialtyClick }: SpecialtyChordChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const parseSpec = (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

    const dominantByAuthor = new Map<string, string>();
    nodes.forEach(node => {
      const d = parseSpec(node.specialities)[0];
      if (d) dominantByAuthor.set(node.id, d);
    });

    const specCounts = d3.rollup(
      Array.from(dominantByAuthor.values()), v => v.length, k => k,
    );
    const topSpecs = Array.from(specCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);

    if (topSpecs.length < 2) return;

    const indexBySpec = new Map(topSpecs.map((s, i) => [s, i]));
    const matrix = Array.from({ length: topSpecs.length }, () =>
      Array.from({ length: topSpecs.length }, () => 0),
    );

    edges.forEach(edge => {
      const sId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const tId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      const sSpec = dominantByAuthor.get(sId);
      const tSpec = dominantByAuthor.get(tId);
      if (!sSpec || !tSpec) return;
      const i = indexBySpec.get(sSpec);
      const j = indexBySpec.get(tSpec);
      if (i === undefined || j === undefined) return;
      matrix[i][j] += edge.weight;
      if (i !== j) matrix[j][i] += edge.weight;
    });

    const width = svgRef.current.clientWidth || 460;
    const height = svgRef.current.clientHeight || 340;
    const outerRadius = Math.min(width, height) * 0.40;
    const innerRadius = outerRadius - 24;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const zoomRoot = svg.append('g');
    const chart = zoomRoot.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        zoomRoot.attr('transform', event.transform);
      });
    svg.call(zoom as any);

    const colorScale = d3.scaleOrdinal<string>().domain(topSpecs).range(SPECIALTY_COLORS);

    const chord = d3.chord().padAngle(0.04).sortSubgroups(d3.descending)(matrix);
    const arc = d3.arc<d3.ChordGroup>().innerRadius(innerRadius).outerRadius(outerRadius);
    const ribbon = d3.ribbon<d3.Chord, d3.ChordSubgroup>().radius(innerRadius);

    const selectedSpec = selectedNodeId ? dominantByAuthor.get(selectedNodeId) : null;

    chart.append('g').attr('fill-opacity', 0.55)
      .selectAll('path').data(chord).join('path')
      .attr('d', ribbon)
      .attr('fill', d => colorScale(topSpecs[d.source.index]))
      .attr('stroke', '#ffffff').attr('stroke-width', 0.5)
      .attr('opacity', d => {
        if (!selectedSpec) return 1;
        const s = topSpecs[d.source.index];
        const t = topSpecs[d.target.index];
        return s === selectedSpec || t === selectedSpec ? 1 : 0.15;
      });

    const group = chart.append('g').selectAll('g').data(chord.groups).join('g');

    group.append('path')
      .attr('d', arc)
      .attr('fill', d => colorScale(topSpecs[d.index]))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', d => selectedSpec && topSpecs[d.index] === selectedSpec ? 2 : 1)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        onSpecialtyClick(topSpecs[d.index]);
      })
      .append('title')
      .text(d => `${topSpecs[d.index]}\nCollaborative weight: ${Math.round(d.value)}`);

    group.append('text')
      .each(d => {
        (d as d3.ChordGroup & { angle?: number }).angle = (d.startAngle + d.endAngle) / 2;
      })
      .attr('dy', '0.35em')
      .attr('transform', d => {
        const angle = (d as d3.ChordGroup & { angle: number }).angle;
        const rotate = (angle * 180) / Math.PI - 90;
        const flip = angle > Math.PI ? 180 : 0;
        return `rotate(${rotate}) translate(${outerRadius + 10}) rotate(${flip})`;
      })
      .attr('text-anchor', d => ((d as d3.ChordGroup & { angle: number }).angle > Math.PI ? 'end' : 'start'))
      .attr('fill', d => selectedSpec && topSpecs[d.index] === selectedSpec ? '#1d4ed8' : '#475569')
      .attr('font-size', 10)
      .attr('font-weight', d => selectedSpec && topSpecs[d.index] === selectedSpec ? 700 : 400)
      .text(d => {
        const label = topSpecs[d.index];
        return label.length > 18 ? `${label.slice(0, 18)}…` : label;
      })
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        onSpecialtyClick(topSpecs[d.index]);
      });

    svg.on('click', () => {
      onSpecialtyClick('');
    });

  }, [edges, nodes, onSpecialtyClick, selectedNodeId]);

  return <svg ref={svgRef} className="h-full w-full" />;
}
