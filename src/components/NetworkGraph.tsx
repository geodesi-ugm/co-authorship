import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Node, Edge } from '../lib/data';

const SPECIALTY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1',
];

interface NetworkGraphProps {
  nodes: Node[];
  edges: Edge[];
  metric: 'paper_count' | 'citations' | 'degree';
  selectedNodeId: string | null;
  hoveredNodeIds?: string[];
  searchQuery?: string;
  onNodeClick: (node: Node | null) => void;
  onNodeHover?: (node: Node | null) => void;
}

export function NetworkGraph({ nodes, edges, metric, selectedNodeId, hoveredNodeIds, searchQuery, onNodeClick, onNodeHover }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // Helper to parse specialties
    const parseSpec = (s: string) => s.split(';').map(x => x.trim()).filter(Boolean);

    // Calculate specialty counts for color scale
    const specialtyCounts = new Map<string, number>();
    for (const n of nodes) {
      const top = parseSpec(n.specialities)[0];
      if (top) specialtyCounts.set(top, (specialtyCounts.get(top) || 0) + 1);
    }
    const topSpecialities = Array.from(specialtyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([s]) => s);

    const getNodeColor = (node: Node) => {
      const top = parseSpec(node.specialities)[0];
      if (top && topSpecialities.includes(top)) {
        const index = topSpecialities.indexOf(top);
        return SPECIALTY_COLORS[index % SPECIALTY_COLORS.length];
      }
      return '#94a3b8';
    };

    // Prepare elements for Cytoscape
    const cyNodes = nodes.map(n => ({
      data: {
        id: n.id,
        name: n.name,
        label: n.name.length > 20 ? `${n.name.slice(0, 18)}…` : n.name,
        color: getNodeColor(n),
        metricValue: n[metric] || 0,
        ...n
      }
    }));

    const cyEdges = edges.map(e => ({
      data: {
        id: `e-${typeof e.source === 'string' ? e.source : e.source.id}-${typeof e.target === 'string' ? e.target : e.target.id}`,
        source: typeof e.source === 'string' ? e.source : e.source.id,
        target: typeof e.target === 'string' ? e.target : e.target.id,
        weight: e.weight
      }
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'width': (ele: any) => {
              const val = ele.data('metricValue');
              return 8 + Math.sqrt(val) * 4;
            },
            'height': (ele: any) => {
              const val = ele.data('metricValue');
              return 8 + Math.sqrt(val) * 4;
            },
            'font-size': '10px',
            'color': '#334155',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'border-width': 1.5,
            'border-color': '#ffffff',
            'text-outline-color': '#ffffff',
            'text-outline-width': 1.5,
            'text-wrap': 'ellipsis',
            'text-max-width': '80px',
            'z-index': 10,
            'transition-property': 'background-color, border-width, border-color, opacity, width, height',
            'transition-duration': 250,
          } as any
        },
        {
          selector: 'edge',
          style: {
            // Increased thickness scale so connectivity is visually more pronounced.
            'width': (ele: any) => 2 + Math.sqrt(ele.data('weight')) * 2.5,
            'line-color': '#cbd5e1',
            'curve-style': 'bezier',
            'control-point-step-size': 20,
            'opacity': 0.45,
            'overlay-opacity': 0,
            'z-index': 1,
            'transition-property': 'line-color, opacity, width',
            'transition-duration': 250,
            // Hide edge labels by default; they are shown for highlighted/selected node neighborhoods.
            'label': '',
            'font-size': '8px',
            'text-rotation': 'autorotate',
            'text-margin-y': -4,
            'text-background-color': '#f8fafc',
            'text-background-opacity': 0.7,
            'text-background-padding': 2,
            'text-border-color': '#cbd5e1',
            'text-border-width': 1,
            'text-border-opacity': 0.8,
          } as any
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3.5,
            'border-color': '#3b82f6',
            'background-color': '#1d4ed8',
            'z-index': 100,
          } as any
        },
        {
          selector: '.highlighted',
          style: {
            'opacity': 1,
            'line-color': '#3b82f6',
            'width': (ele: any) => 2 + Math.sqrt(ele.data('weight')) * 1.5,
            'z-index': 50,
            'label': 'data(weight)',
            'font-size': '9px',
            'text-rotation': 'autorotate',
            'text-margin-y': -4,
            'text-background-color': '#f8fafc',
            'text-background-opacity': 0.9,
            'text-background-padding': 2,
            'text-border-color': '#3b82f6',
            'text-border-width': 1,
            'text-border-opacity': 1,
          } as any
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.08,
          } as any
        },
        {
          selector: '.hover-highlight',
          style: {
            'border-width': 3,
            'border-color': '#64748b',
            'z-index': 200,
            'opacity': 1,
          } as any
        },
        {
          selector: '.hover-faded',
          style: {
            'opacity': 0.15,
          } as any
        },
        {
          selector: '.external-hover',
          style: {
            'border-width': 3,
            'border-color': '#f59e0b',
            'background-color': '#fcd34d',
            'opacity': 1,
            'z-index': 150,
          } as any
        },
        {
          selector: '.external-faded',
          style: {
            'opacity': 0.2,
          } as any
        },
        {
          selector: 'node.hover',
          style: {
            'border-width': 3,
            'border-color': '#64748b',
          } as any
        }
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 180, // larger bone length for more separation
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 40,
        randomize: true,
        componentSpacing: 180,
        nodeRepulsion: 1250000,
        edgeElasticity: 120,
        nestingFactor: 5,
        gravity: 0.75,
        numIter: 1200,
        initialTemp: 220,
        coolingFactor: 0.94,
        minTemp: 0.8,
        // positive x- and y-spacing bias by increasing springLength and elasticity
        // cytoscape cose doesn't have direct horizontal-only bias, but this encourages wider spread
      } as any
    });

    cyRef.current = cy;

    const handleResize = () => {
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onNodeClick(node.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onNodeClick(null);
      }
    });

    // Hover interactions
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.addClass('hover');
      if (onNodeHover) {
        onNodeHover(node.data() as Node);
      }

      // If something is selected, we don't want hover to completely override it
      // but rather "sub-highlight" within the current context or provide temporary focus
      const neighborhood = node.neighborhood().add(node);
      
      cy.elements().removeClass('hover-highlight').removeClass('hover-faded');
      cy.elements().not(neighborhood).addClass('hover-faded');
      neighborhood.addClass('hover-highlight');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      node.removeClass('hover');
      cy.elements().removeClass('hover-highlight').removeClass('hover-faded');
      if (onNodeHover) {
        onNodeHover(null);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [edges, metric, nodes]); // removed searchQuery and selectedNodeId to avoid re-layout

  const restoreHighlights = (cy: cytoscape.Core, selectedId: string | null, query?: string) => {
    cy.elements().removeClass('faded').removeClass('highlighted');
    
    let highlightSet = cy.collection();

    if (query && query.trim().length > 0) {
      const q = query.toLowerCase();
      const matches = cy.nodes().filter(n => 
        n.data('name').toLowerCase().includes(q) || 
        (n.data('specialities') && n.data('specialities').toLowerCase().includes(q))
      );
      highlightSet = highlightSet.add(matches).add(matches.neighborhood());
    }

    if (selectedId) {
      const selectedNode = cy.getElementById(selectedId);
      if (selectedNode.length > 0) {
        highlightSet = highlightSet.add(selectedNode).add(selectedNode.neighborhood());
        cy.nodes().unselect();
        selectedNode.select();
      }
    }

    if (highlightSet.length > 0) {
      cy.elements().not(highlightSet).addClass('faded');
      highlightSet.addClass('highlighted');
    }
  };

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Restore persistent highlights first
    restoreHighlights(cy, selectedNodeId, searchQuery);

    // SMARTER ZOOM:
    // 1. If we have a SELECTED node, only zoom/center if it's new or not in view
    if (selectedNodeId) {
      const selectedNode = cy.getElementById(selectedNodeId);
      if (selectedNode.length > 0) {
        // Only center if we need to focus
        cy.animate({
          center: { eles: selectedNode },
          zoom: Math.max(cy.zoom(), 1.2),
          duration: 600,
          easing: 'ease-in-out-cubic'
        });
      }
    } 
    // 2. If we have a SEARCH query, only auto-fit/zoom when the query changes significantly
    else if (searchQuery && searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      const matches = cy.nodes().filter(n => 
        n.data('name').toLowerCase().includes(q)
      );
      if (matches.length === 1) {
        cy.animate({
          center: { eles: matches },
          zoom: 1.5,
          duration: 600,
          easing: 'ease-in-out-cubic'
        });
      } else if (matches.length > 0) {
        cy.animate({
          fit: { eles: matches, padding: 80 },
          duration: 600,
          easing: 'ease-in-out-cubic'
        });
      }
    } 
    // 3. Only return to full view if explicitly cleared
    else if (!selectedNodeId && (!searchQuery || searchQuery.trim().length === 0)) {
      cy.animate({
        fit: { 
          eles: cy.elements(),
          padding: 40 
        },
        duration: 600,
        easing: 'ease-in-out-cubic'
      });
    }
  }, [selectedNodeId, searchQuery]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass('external-hover').removeClass('external-faded');
    if (hoveredNodeIds && hoveredNodeIds.length > 0) {
      const hovered = cy.nodes().filter(n => hoveredNodeIds.includes(n.id()));
      const neighborhood = hovered.neighborhood().add(hovered);
      cy.elements().not(neighborhood).addClass('external-faded');
      hovered.addClass('external-hover');
    } else {
      cy.elements().removeClass('external-faded');
    }
  }, [hoveredNodeIds]);

  return (
    <div className="w-full h-full relative rounded-md overflow-hidden border border-border bg-muted/30">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
