import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Node } from '../lib/data';

const SPECIALTY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1',
];

interface SpecialtiesChartProps {
  nodes: Node[];
  selectedSpecialty?: string | null;
  onSpecialtyClick?: (specialty: string) => void;
}

interface SpecialtyDatum {
  name: string;
  count: number;
  citationsPerAuthor: number;
}

interface RootDatum {
  children: SpecialtyDatum[];
}

export function SpecialtiesChart({ nodes, selectedSpecialty, onSpecialtyClick }: SpecialtiesChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const parseSpec = (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

    const dominantByAuthor = new Map<string, string>();
    nodes.forEach(n => {
      const dom = parseSpec(n.specialities)[0];
      if (dom) dominantByAuthor.set(n.id, dom);
    });

    const topSpecs = Array.from(
      d3.rollup(Array.from(dominantByAuthor.values()), v => v.length, k => k)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([spec]) => spec);

    const specsMap = new Map<string, { count: number; citations: number }>();
    nodes.forEach(n => {
      if (!n.specialities) return;
      parseSpec(n.specialities).forEach(p => {
        const cur = specsMap.get(p) || { count: 0, citations: 0 };
        specsMap.set(p, { count: cur.count + 1, citations: cur.citations + n.citations });
      });
    });

    const data: SpecialtyDatum[] = Array.from(specsMap, ([name, v]) => ({
      name,
      count: v.count,
      citationsPerAuthor: v.count > 0 ? v.citations / v.count : 0,
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    if (data.length === 0) return;

    const width = svgRef.current.clientWidth || 460;
    const height = svgRef.current.clientHeight || 340;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const zoomRoot = svg.append('g');
    const root = zoomRoot.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        zoomRoot.attr('transform', event.transform);
      });
    svg.call(zoom as any);

    svg.on('click', () => {
      onSpecialtyClick?.('');
    });

    const hierarchy = d3
      .hierarchy<RootDatum | SpecialtyDatum>({ children: data })
      .sum(d => ('count' in d ? d.count : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const packed = d3.pack<RootDatum | SpecialtyDatum>()
      .size([width, height]).padding(4)(hierarchy);

    const colorScale = d3.scaleOrdinal<string>().domain(topSpecs).range(SPECIALTY_COLORS);

    const specialtyColorMap = new Map<string, string>();

    data.forEach(spec => {
      if (topSpecs.includes(spec.name)) {
        specialtyColorMap.set(spec.name, colorScale(spec.name));
        return;
      }

      const authorWithSpec = nodes.find(n => parseSpec(n.specialities).includes(spec.name));
      if (authorWithSpec) {
        const dominante = parseSpec(authorWithSpec.specialities)[0];
        if (dominante) {
          specialtyColorMap.set(spec.name, colorScale(dominante));
          return;
        }
      }

      specialtyColorMap.set(spec.name, colorScale(spec.name));
    });

    const getSpecialtyColor = (spec: string) => {
      return specialtyColorMap.get(spec) ?? colorScale(spec);
    };

    const bubble = root.selectAll('g').data(packed.leaves()).join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`) 
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onSpecialtyClick?.((d.data as SpecialtyDatum).name);
      });

    bubble.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => getSpecialtyColor((d.data as SpecialtyDatum).name))
      .attr('fill-opacity', d => (selectedSpecialty && selectedSpecialty !== (d.data as SpecialtyDatum).name ? 0.2 : 0.85))
      .attr('stroke', d => selectedSpecialty === (d.data as SpecialtyDatum).name ? '#1d4ed8' : '#e2e8f0')
      .attr('stroke-width', d => selectedSpecialty === (d.data as SpecialtyDatum).name ? 2.5 : 1);

    bubble.filter(d => d.r > 26).append('text')
      .attr('text-anchor', 'middle').attr('dy', '-0.1em')
      .attr('fill', d => {
        const fillColor = getSpecialtyColor((d.data as SpecialtyDatum).name);
        const c = d3.color(fillColor);
        const hsl = c ? d3.hsl(c) : null;
        return hsl && hsl.l > 0.5 ? '#1e293b' : '#ffffff';
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
        const fillColor = getSpecialtyColor((d.data as SpecialtyDatum).name);
        const c = d3.color(fillColor);
        const hsl = c ? d3.hsl(c) : null;
        const isWhite = hsl ? hsl.l <= 0.5 : true;
        return isWhite ? 'rgba(255,255,255,0.8)' : '#64748b';
      })
      .attr('font-size', 9)
      .text(d => `${(d.data as SpecialtyDatum).count} authors`);

    bubble.append('title')
      .text(d => {
        const cur = d.data as SpecialtyDatum;
        return `${cur.name}\nAuthors: ${cur.count}\nAvg citations: ${Math.round(cur.citationsPerAuthor)}`;
      });

  }, [nodes, onSpecialtyClick, selectedSpecialty]);

  return (
    <div className="h-full w-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
