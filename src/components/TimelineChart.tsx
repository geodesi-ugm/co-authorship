import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Paper } from '../lib/data';

interface TimelineChartProps {
  papers: Paper[];
  selectedYear: number | null;
  onYearSelect: (year: number | null) => void;
}

export function TimelineChart({ papers, selectedYear, onYearSelect }: TimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || papers.length === 0) return;

    const validPapers = papers.filter(p => p.year !== null && p.year > 1980);
    const yearly = d3.rollup(
      validPapers,
      values => ({
        papers: values.length,
        citations: d3.sum(values, d => d.cited_by),
      }),
      d => d.year as number,
    );
    const data = Array.from(yearly, ([year, values]) => ({
      year,
      papers: values.papers,
      citations: values.citations,
    })).sort((a, b) => a.year - b.year);

    if (data.length === 0) return;

    const margin = { top: 16, right: 24, bottom: 32, left: 40 };
    const width = svgRef.current.clientWidth || 720;
    const height = svgRef.current.clientHeight || 220;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year) as [number, number])
      .range([0, innerWidth]).nice();

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.papers) || 10])
      .nice().range([innerHeight, 0]);

    const citationRadius = d3.scaleSqrt<number, number>()
      .domain([0, d3.max(data, d => d.citations) || 1])
      .range([3, 9]);

    g.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerWidth))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#e2e8f0'))
      .call(g => g.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', 10));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(Math.min(12, data.length)).tickFormat(d3.format('d')))
      .call(g => g.select('.domain').attr('stroke', '#e2e8f0'))
      .call(g => g.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', 10));

    const area = d3.area<(typeof data)[number]>()
      .x(d => x(d.year)).y0(innerHeight).y1(d => y(d.papers))
      .curve(d3.curveCatmullRom.alpha(0.4));

    const line = d3.line<(typeof data)[number]>()
      .x(d => x(d.year)).y(d => y(d.papers))
      .curve(d3.curveCatmullRom.alpha(0.4));

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'tlGrad').attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.18);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.02);

    g.append('path').datum(data).attr('d', area).attr('fill', 'url(#tlGrad)');
    g.append('path').datum(data).attr('d', line)
      .attr('fill', 'none').attr('stroke', '#3b82f6').attr('stroke-width', 2);

    g.selectAll('circle')
      .data(data).join('circle')
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.papers))
      .attr('r', d => selectedYear === d.year ? citationRadius(d.citations) + 1.5 : citationRadius(d.citations))
      .attr('fill', d => selectedYear === d.year ? '#1d4ed8' : '#60a5fa')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', d => selectedYear === d.year ? 2 : 1)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => onYearSelect(selectedYear === d.year ? null : d.year))
      .append('title')
      .text(d => `${d.year}: ${d.papers} papers, ${d.citations} citations`);

  }, [papers, selectedYear, onYearSelect]);

  return (
    <div className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
