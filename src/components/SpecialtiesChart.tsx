import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Node } from '../lib/data';

interface SpecialtiesChartProps {
  nodes: Node[];
}

interface SpecialtyDatum {
  name: string;
  count: number;
  citationsPerAuthor: number;
}

interface RootDatum {
  children: SpecialtyDatum[];
}

export function SpecialtiesChart({ nodes }: SpecialtiesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const specsMap = new Map<string, { count: number; citations: number }>();
    nodes.forEach(n => {
      if (!n.specialities) return;
      n.specialities.split(';').map(s => s.trim()).filter(Boolean).forEach(p => {
        const cur = specsMap.get(p) || { count: 0, citations: 0 };
        specsMap.set(p, { count: cur.count + 1, citations: cur.citations + n.citations });
      });
    });

    const data: SpecialtyDatum[] = Array.from(specsMap, ([name, v]) => ({
      name,
      count: v.count,
      citationsPerAuthor: v.count > 0 ? v.citations / v.count : 0,
    })).sort((a, b) => b.count - a.count).slice(0, 20);

    if (data.length === 0) return;

    const width = svgRef.current.clientWidth || 460;
    const height = svgRef.current.clientHeight || 340;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const hierarchy = d3
      .hierarchy<RootDatum | SpecialtyDatum>({ children: data })
      .sum(d => ('count' in d ? d.count : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const packed = d3.pack<RootDatum | SpecialtyDatum>()
      .size([width, height]).padding(4)(hierarchy);

    const citDomain = [
      d3.min(data, d => d.citationsPerAuthor) || 0,
      d3.max(data, d => d.citationsPerAuthor) || 1,
    ];
    const colorScale = d3.scaleSequential(
      (t: number) => d3.interpolateBlues(0.25 + t * 0.65)
    ).domain(citDomain);

    const root = svg.append('g');
    const bubble = root.selectAll('g').data(packed.leaves()).join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    bubble.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => colorScale((d.data as SpecialtyDatum).citationsPerAuthor))
      .attr('fill-opacity', 0.8)
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    bubble.filter(d => d.r > 26).append('text')
      .attr('text-anchor', 'middle').attr('dy', '-0.1em')
      .attr('fill', d => {
        const cpa = (d.data as SpecialtyDatum).citationsPerAuthor;
        const domain = colorScale.domain();
        const ratio = (cpa - domain[0]) / (domain[1] - domain[0]);
        return ratio > 0.5 ? '#ffffff' : '#1e293b';
      })
      .attr('font-size', d => Math.min(11, d.r / 3.2))
      .attr('font-weight', 600)
      .text(d => {
        const name = (d.data as SpecialtyDatum).name;
        return name.length > 14 ? `${name.slice(0, 14)}…` : name;
      });

    bubble.filter(d => d.r > 22).append('text')
      .attr('text-anchor', 'middle').attr('dy', '1.1em')
      .attr('fill', d => {
        const cpa = (d.data as SpecialtyDatum).citationsPerAuthor;
        const domain = colorScale.domain();
        const ratio = (cpa - domain[0]) / (domain[1] - domain[0]);
        return ratio > 0.5 ? 'rgba(255,255,255,0.8)' : '#64748b';
      })
      .attr('font-size', 9)
      .text(d => `${(d.data as SpecialtyDatum).count} authors`);

    bubble.append('title')
      .text(d => {
        const cur = d.data as SpecialtyDatum;
        return `${cur.name}\nAuthors: ${cur.count}\nAvg citations: ${Math.round(cur.citationsPerAuthor)}`;
      });

  }, [nodes]);

  return (
    <div className="h-full w-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
