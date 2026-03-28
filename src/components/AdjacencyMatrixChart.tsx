import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Edge, Node } from '../lib/data';

interface AdjacencyMatrixChartProps {
  nodes: Node[];
  edges: Edge[];
  metric: 'paper_count' | 'citations' | 'degree';
  selectedNodeId: string | null;
  onNodeClick: (node: Node | null) => void;
}

export function AdjacencyMatrixChart({ nodes, edges, metric, selectedNodeId, onNodeClick }: AdjacencyMatrixChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 460;
    const height = svgRef.current.clientHeight || 400;
    const margin = { top: 80, right: 16, bottom: 16, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const matrixNodes = [...nodes]
      .sort((a, b) => {
        const diff = (b[metric] || 0) - (a[metric] || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      })
      .slice(0, Math.min(40, nodes.length));

    const indexById = new Map(matrixNodes.map((node, i) => [node.id, i]));
    const matrix = Array.from({ length: matrixNodes.length }, () =>
      Array.from({ length: matrixNodes.length }, () => 0),
    );

    edges.forEach(edge => {
      const source = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const target = typeof edge.target === 'string' ? edge.target : edge.target.id;
      const i = indexById.get(source);
      const j = indexById.get(target);
      if (i === undefined || j === undefined) return;
      matrix[i][j] = edge.weight;
      matrix[j][i] = edge.weight;
    });

    const maxWeight = d3.max(matrix.flat()) || 1;
    const cellSize = Math.min(innerWidth / matrixNodes.length, innerHeight / matrixNodes.length);
    const chartWidth = cellSize * matrixNodes.length;
    const chartHeight = cellSize * matrixNodes.length;

    const zoomRoot = svg.append('g');
    const chart = zoomRoot.append('g')
      .attr('transform', `translate(${margin.left + (innerWidth - chartWidth) / 2},${margin.top + (innerHeight - chartHeight) / 2})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', (event) => {
        zoomRoot.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxWeight]);
    const selectedIndex = selectedNodeId ? indexById.get(selectedNodeId) : undefined;

    const cells: Array<{ row: number; col: number; weight: number }> = [];
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix.length; col++) {
        cells.push({ row, col, weight: matrix[row][col] });
      }
    }

    chart.selectAll('rect').data(cells).join('rect')
      .attr('x', d => d.col * cellSize)
      .attr('y', d => d.row * cellSize)
      .attr('width', cellSize).attr('height', cellSize)
      .attr('rx', 1)
      .attr('fill', d => d.weight > 0 ? colorScale(d.weight) : '#f8fafc')
      .attr('stroke', d => {
        if (selectedIndex === undefined) return '#e2e8f0';
        return d.row === selectedIndex || d.col === selectedIndex ? '#3b82f6' : '#e2e8f0';
      })
      .attr('stroke-width', d => {
        if (selectedIndex === undefined) return 0.5;
        return d.row === selectedIndex || d.col === selectedIndex ? 1 : 0.5;
      })
      .attr('opacity', d => {
        if (selectedIndex === undefined) return 1;
        return d.row === selectedIndex || d.col === selectedIndex ? 1 : 0.4;
      })
      .style('cursor', d => d.weight > 0 ? 'pointer' : 'default')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (d.weight <= 0) return;
        const rowNode = matrixNodes[d.row];
        const colNode = matrixNodes[d.col];
        if (!selectedNodeId) { onNodeClick(rowNode); return; }
        if (rowNode.id === selectedNodeId) onNodeClick(colNode);
        else if (colNode.id === selectedNodeId) onNodeClick(rowNode);
        else onNodeClick(rowNode);
      })
      .append('title')
      .text(d => `${matrixNodes[d.row].name} ↔ ${matrixNodes[d.col].name}: ${d.weight}`);

    chart.selectAll('text.row-label').data(matrixNodes).join('text')
      .attr('class', 'row-label')
      .attr('x', -6).attr('y', (_d, i) => i * cellSize + cellSize * 0.68)
      .attr('text-anchor', 'end').attr('font-size', 9)
      .attr('fill', d => d.id === selectedNodeId ? '#1d4ed8' : '#64748b')
      .attr('font-weight', d => d.id === selectedNodeId ? 700 : 400)
      .text(d => d.name.length > 15 ? `${d.name.slice(0, 15)}…` : d.name)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => { event.stopPropagation(); onNodeClick(d); });

    chart.selectAll('text.col-label').data(matrixNodes).join('text')
      .attr('class', 'col-label')
      .attr('x', (_d, i) => i * cellSize + cellSize * 0.35)
      .attr('y', -6)
      .attr('text-anchor', 'start')
      .attr('transform', (_d, i) => `rotate(-55, ${i * cellSize + cellSize * 0.35}, -6)`)
      .attr('font-size', 9)
      .attr('fill', d => d.id === selectedNodeId ? '#1d4ed8' : '#64748b')
      .attr('font-weight', d => d.id === selectedNodeId ? 700 : 400)
      .text(d => d.name.length > 15 ? `${d.name.slice(0, 15)}…` : d.name)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => { event.stopPropagation(); onNodeClick(d); });



    svg.on('click', () => {
      onNodeClick(null);
    });
  }, [edges, metric, nodes, onNodeClick, selectedNodeId]);

  return <svg ref={svgRef} className="h-full w-full" />;
}
