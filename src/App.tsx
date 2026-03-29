import { useEffect, useMemo, useRef, useState } from 'react';
import { AdjacencyMatrixChart } from './components/AdjacencyMatrixChart';
import { useDashboardData } from './hooks/useDashboardData';
import { AuthorEgoGraph } from './components/AuthorEgoGraph';
import { AuthorScatterChart } from './components/AuthorScatterChart';
import { Maximize2Icon, Minimize2Icon, FileText, TrendingUp, Link2, XCircle } from 'lucide-react';
import { NetworkGraph } from './components/NetworkGraph';
import { SpecialtyChordChart } from './components/SpecialtyChordChart';
import { TimelineChart } from './components/TimelineChart';
import { SpecialtiesChart } from './components/SpecialtiesChart';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from './components/ui/card';
import { Input } from './components/ui/input';
import { ScrollArea } from './components/ui/scroll-area';
import { Node } from './lib/data';

const METRIC_OPTIONS = [
  { key: 'paper_count', label: 'Papers' },
  { key: 'citations', label: 'Citations' },
  { key: 'degree', label: 'Connections' },
] as const;

type Metric = (typeof METRIC_OPTIONS)[number]['key'];

const SPECIALTY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1',
];

function parseSpecialities(specialities: string) {
  return specialities.split(';').map(s => s.trim()).filter(Boolean);
}

function getEdgeNodeId(value: string | Node) {
  return typeof value === 'string' ? value : value.id;
}

function App() {
  const { data, loading, error } = useDashboardData();
  const [metric, setMetric] = useState<Metric>('paper_count');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredCoauthorId, setHoveredCoauthorId] = useState<string | null>(null);
  const [hoveredPaperId, setHoveredPaperId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [hoveredPaperAuthorIds, setHoveredPaperAuthorIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isNetworkFullscreen, setIsNetworkFullscreen] = useState(false);
  const networkCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFullScreenChange = () => {
      setIsNetworkFullscreen(document.fullscreenElement === networkCardRef.current);
    };

    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  const toggleNetworkFullscreen = async () => {
    const card = networkCardRef.current;
    if (!card) return;

    try {
      if (document.fullscreenElement === card) {
        await document.exitFullscreen();
      } else {
        await card.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen toggle failed', error);
    }
  };

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return data.nodes.find(n => n.id === selectedNodeId) || null;
  }, [data, selectedNodeId]);

  const papersById = useMemo(() => {
    if (!data) return new Map<string, { year: number | null }>();
    return new Map(data.papers.map(p => [p.paper_id, { year: p.year }]));
  }, [data]);

  const authorsByYear = useMemo(() => {
    if (!data) return new Map<number, Set<string>>();
    const map = new Map<number, Set<string>>();
    for (const link of data.links) {
      const year = papersById.get(link.paper_id)?.year;
      if (!year) continue;
      if (!map.has(year)) map.set(year, new Set());
      map.get(year)?.add(link.author_id);
    }
    return map;
  }, [data, papersById]);

  const allPapers = useMemo(() => {
    if (!data) return [];
    return data.papers
      .filter(p => (selectedYear ? p.year === selectedYear : true))
      .sort((a, b) => (b.cited_by || 0) - (a.cited_by || 0));
  }, [data, selectedYear]);

  const authorPapers = useMemo(() => {
    if (!data || !selectedNodeId) return [];
    const paperIds = new Set(data.links.filter(l => l.author_id === selectedNodeId).map(l => l.paper_id));
    return data.papers
      .filter(p => paperIds.has(p.paper_id))
      .filter(p => (selectedYear ? p.year === selectedYear : true))
      .sort((a, b) => (b.cited_by || 0) - (a.cited_by || 0));
  }, [data, selectedNodeId, selectedYear]);

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    let n = data.nodes;
    // Hard filter only by year
    if (selectedYear) {
      const visible = authorsByYear.get(selectedYear) || new Set();
      n = n.filter(x => visible.has(x.id));
    }
    return n;
  }, [data, selectedYear, authorsByYear]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    const visibleIds = new Set(filteredNodes.map(n => n.id));
    return data.edges.filter(e => visibleIds.has(getEdgeNodeId(e.source)) && visibleIds.has(getEdgeNodeId(e.target)));
  }, [data, filteredNodes]);

  const paperAuthorMap = useMemo(() => {
    if (!data) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const link of data.links) {
      if (!map.has(link.paper_id)) map.set(link.paper_id, []);
      map.get(link.paper_id)!.push(link.author_id);
    }
    return map;
  }, [data]);

  const selectedNodeCoauthors = useMemo(() => {
    if (!data || !selectedNodeId) return [];
    const nodeById = new Map(data.nodes.map(n => [n.id, n]));
    return data.edges
      .map(edge => {
        const source = getEdgeNodeId(edge.source);
        const target = getEdgeNodeId(edge.target);
        if (source !== selectedNodeId && target !== selectedNodeId) return null;
        const otherId = source === selectedNodeId ? target : source;
        const otherNode = nodeById.get(otherId);
        if (!otherNode) return null;
        return { node: otherNode, weight: edge.weight };
      })
      .filter((item): item is { node: Node; weight: number } => Boolean(item))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 16);
  }, [data, selectedNodeId]);

  const hoveredCoauthor = useMemo(() => {
    if (!data || !hoveredCoauthorId) return null;
    return data.nodes.find(n => n.id === hoveredCoauthorId) || null;
  }, [data, hoveredCoauthorId]);

  const hoveredAuthorIsDifferent = Boolean(
    selectedNodeId && hoveredCoauthorId && selectedNodeId !== hoveredCoauthorId
  );

  const selectedCoauthoredPapers = useMemo(() => {
    if (!data || !selectedNodeId || !hoveredCoauthorId || selectedNodeId === hoveredCoauthorId) return [];

    const selectedPapers = new Set(
      data.links.filter(l => l.author_id === selectedNodeId).map(l => l.paper_id)
    );

    const sharedPapers = new Set(
      data.links
        .filter(l => l.author_id === hoveredCoauthorId && selectedPapers.has(l.paper_id))
        .map(l => l.paper_id)
    );

    return data.papers
      .filter(p => sharedPapers.has(p.paper_id))
      .filter(p => (selectedYear ? p.year === selectedYear : true))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [data, selectedNodeId, hoveredCoauthorId, selectedYear]);

  const hoveredAuthorPapers = useMemo(() => {
    if (!data || !hoveredCoauthorId) return [];
    const paperIds = new Set(data.links.filter(l => l.author_id === hoveredCoauthorId).map(l => l.paper_id));
    return data.papers
      .filter(p => paperIds.has(p.paper_id))
      .filter(p => (selectedYear ? p.year === selectedYear : true))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [data, hoveredCoauthorId, selectedYear]);

  const paperMode = hoveredAuthorIsDifferent
    ? 'Co-authored'
    : hoveredCoauthor
      ? 'Author'
      : selectedNode
        ? 'Author'
        : 'All';

  const displayedPapers = hoveredAuthorIsDifferent
    ? selectedCoauthoredPapers
    : hoveredCoauthor
      ? hoveredAuthorPapers
      : selectedNode
        ? authorPapers
        : allPapers;

  const globalStats = useMemo(() => {
    if (!data) return null;
    const scopedPapers = selectedYear
      ? data.papers.filter(p => p.year === selectedYear)
      : data.papers;
    return {
      authors: filteredNodes.length,
      links: filteredEdges.length,
      papers: scopedPapers.length,
      totalCitations: filteredNodes.reduce((sum, node) => sum + node.citations, 0),
    };
  }, [data, filteredNodes, filteredEdges, selectedYear]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">Failed to load data: {error.message}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading network data…</p>
        </div>
      </div>
    );
  }

  const metricLabel = METRIC_OPTIONS.find(m => m.key === metric)!.label.toLowerCase();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b bg-card px-6 py-4">
        <div className="max-w-[1920px] mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Co-Authorship Network
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Explore collaboration patterns, specialties, and publication dynamics
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Authors" value={globalStats?.authors ?? 0} />
            <span className="h-4 w-px bg-border hidden sm:block" />
            <Stat label="Co-author links" value={globalStats?.links ?? 0} />
            <span className="h-4 w-px bg-border hidden sm:block" />
            <Stat label="Papers" value={globalStats?.papers ?? 0} />
            <span className="h-4 w-px bg-border hidden sm:block" />
            <Stat label="Citations" value={(globalStats?.totalCitations ?? 0).toLocaleString()} />
          </div>
        </div>
      </header>

      <div className="max-w-[1920px] mx-auto p-4 lg:p-6 h-[calc(100vh-106px)] min-h-[calc(100vh-106px)]">
        <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start h-full">
          {/* ── Left sidebar ── */}
          <aside className="flex flex-col gap-4 h-full min-h-0 overflow-hidden">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search author or specialty…"
                    className="h-9 text-sm pr-8"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Author detail */}
            <Card className="h-[280px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {selectedNode ? selectedNode.name : 'Author Detail'}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full overflow-hidden">
                {selectedNode ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                        Photo
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Papers</div>
                        <div className="text-lg font-semibold tabular-nums">{selectedNode.paper_count}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat label="Citations" value={selectedNode.citations} />
                      <MiniStat label="Degree" value={selectedNode.degree ?? 0} />
                      <MiniStat label="Specialties" value={parseSpecialities(selectedNode.specialities).length} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parseSpecialities(selectedNode.specialities).slice(0, 6).map(spec => (
                        <Badge
                          key={spec}
                          variant="secondary"
                          className="text-[11px] font-normal"
                        >
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground border border-dashed rounded-md">
                    Select an author from the graph
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Papers list (global / selected author / co-authored) */}
            <Card className="flex-1 min-h-0 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">Papers</CardTitle>
                  <span className="rounded-full px-2 py-1 text-[10px] font-semibold bg-accent/30 text-accent-foreground">
                    {paperMode}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="h-full min-h-0 overflow-hidden">
                <ScrollArea className="h-full min-h-0 overflow-auto">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {hoveredAuthorIsDifferent && hoveredCoauthor
                        ? `Co-authored papers with ${hoveredCoauthor.name} ${selectedYear ? `in ${selectedYear}` : '(all years)'}`
                        : hoveredCoauthor
                          ? `Papers by ${hoveredCoauthor.name} ${selectedYear ? `in ${selectedYear}` : '(all years)'}`
                          : selectedNode
                            ? `Papers by ${selectedNode.name} ${selectedYear ? `in ${selectedYear}` : '(all years)'}`
                            : `All papers ${selectedYear ? `in ${selectedYear}` : '(all years)'}`}
                      · {displayedPapers.length}
                    </p>
                    {displayedPapers.map(p => {
                      const paperAuthors = paperAuthorMap.get(p.paper_id) || [];
                      const isHovered = hoveredPaperId === p.paper_id;
                      const isSelected = selectedPaperId === p.paper_id;

                      return (
                        <div
                          key={p.paper_id}
                          className={`p-2.5 rounded-md transition-colors cursor-pointer ${isSelected ? 'bg-primary/20' : ''} ${isHovered ? 'bg-primary/10' : ''}`}
                          onMouseEnter={() => {
                            setHoveredPaperId(p.paper_id);
                            setHoveredPaperAuthorIds(paperAuthors);
                          }}
                          onMouseLeave={() => {
                            setHoveredPaperId(null);
                            setHoveredPaperAuthorIds([]);
                          }}
                          onClick={() => {
                            setSelectedPaperId(p.paper_id);
                            if (paperAuthors.length > 0) {
                              setSelectedNodeId(paperAuthors[0]);
                            }
                          }}
                        >
                          <p className="text-sm leading-snug line-clamp-2">{p.title}</p>
                          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                            <span>{p.year || 'Unknown'}</span>
                            <span>{p.cited_by} cit.</span>
                          </div>
                        </div>
                      );
                    })}
                    {!displayedPapers.length && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        No papers available.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          {/* ── Main content ── */}
          <div className="flex flex-col gap-5">
            {/* Top Row: Network graph & Specialty Chord */}
            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <Card ref={networkCardRef} className={isNetworkFullscreen ? 'h-full' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-1">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        Collaboration Network
                        {selectedYear && (
                          <span className="text-muted-foreground font-normal ml-2">· {selectedYear}</span>
                        )}
                      </CardTitle>
                      {/* <span className="text-[11px] text-muted-foreground">
                        {filteredNodes.length} authors · {filteredEdges.length} links
                      </span> */}
                    </div>
                    <CardAction>
                      <button
                        onClick={toggleNetworkFullscreen}
                        title={isNetworkFullscreen ? 'Exit full page' : 'Full page'}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition"
                      >
                        {isNetworkFullscreen ? (
                          <Minimize2Icon className="size-4" />
                        ) : (
                          <Maximize2Icon className="size-4" />
                        )}
                      </button>
                    </CardAction>
                  </div>
                </CardHeader>
                <div className="flex flex-wrap items-center justify-between  px-4  text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Node size:</span>
                    {METRIC_OPTIONS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setMetric(m.key)}
                        title={`Use ${m.label}`}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${
                          metric === m.key
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {m.key === 'paper_count' && <FileText className="size-3" />}
                        {m.key === 'citations' && <TrendingUp className="size-3" />}
                        {m.key === 'degree' && <Link2 className="size-3" />}
                        <span className="sm:inline hidden">{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedYear(null);
                      setSearch('');
                      setSelectedNodeId(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/50 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5 transition"
                    title="Clear all filters"
                  >
                    <XCircle className="size-3" />
                    <span className="sm:inline hidden">Clear</span>
                  </button>
                </div>
                {/* <div className="px-4 pt-2 text-[11px] text-muted-foreground">
                  Color = dominant specialty. Size = {metricLabel}. Click a year on the timeline to filter. Click a node to inspect.
                </div> */}
                <CardContent className={isNetworkFullscreen ? 'h-full' : 'h-[540px]'}>
                  <NetworkGraph
                    nodes={filteredNodes}
                    edges={filteredEdges}
                    metric={metric}
                    selectedNodeId={selectedNodeId}
                    hoveredNodeIds={hoveredPaperAuthorIds}
                    searchQuery={search}
                    onNodeClick={node => {
                      setSelectedNodeId(node?.id || null);
                      setHoveredCoauthorId(null);
                      setSelectedPaperId(null);
                    }}
                    onNodeHover={node => setHoveredCoauthorId(node?.id || null)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Specialty Collaborations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="h-[540px]">
                  <SpecialtyChordChart
                    nodes={filteredNodes}
                    edges={filteredEdges}
                    selectedNodeId={selectedNodeId}
                    onSpecialtyClick={specialty => setSearch(specialty)}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Publication Timeline</CardTitle>
                  <span className="text-[11px] text-muted-foreground">Click a year to filter the network</span>
                </div>
              </CardHeader>
              <CardContent className="h-[220px]">
                <TimelineChart
                  papers={data.papers}
                  selectedYear={selectedYear}
                  onYearSelect={setSelectedYear}
                />
              </CardContent>
            </Card>

            {/* Bottom row: three charts */}
            <div className="grid gap-5 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Specialty Landscape</CardTitle>
                </CardHeader>
                <CardContent className="h-[340px]">
                  <SpecialtiesChart
                    nodes={filteredNodes}
                    selectedSpecialty={search}
                    onSpecialtyClick={specialty => setSearch(specialty)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Papers vs Citations</CardTitle>
                </CardHeader>
                <CardContent className="h-[340px]">
                  <AuthorScatterChart
                    nodes={filteredNodes}
                    selectedNodeId={selectedNodeId}
                    onNodeClick={node => {
                      setSelectedNodeId(node?.id || null);
                      setHoveredCoauthorId(null);
                    }}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Adjacency Matrix
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="h-[340px]">
                  <AdjacencyMatrixChart
                    nodes={filteredNodes}
                    edges={filteredEdges}
                    metric={metric}
                    selectedNodeId={selectedNodeId}
                    onNodeClick={node => {
                      setSelectedNodeId(node?.id || null);
                      setHoveredCoauthorId(null);
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default App;
