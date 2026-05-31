'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize2, Sparkles } from 'lucide-react';

export default function MindMap({ data }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    // Clear previous drawing
    d3.select(svgRef.current).selectAll('*').remove();

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 500;

    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`);

    // Main graph group to handle zoom & pan
    const g = svg.append('g');

    // Setup D3 Zoom
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(Math.round(event.transform.k * 100));
      });

    svg.call(zoomBehavior);

    // Initial position: center of container
    const initialTransform = d3.zoomIdentity.translate(width / 3, height / 2).scale(0.8);
    svg.call(zoomBehavior.transform, initialTransform);

    // Root data node
    const root = d3.hierarchy(data);
    root.x0 = height / 2;
    root.y0 = 0;

    // Toggle children on click
    function click(event, d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }

    // Dynamic tree layout generator
    const treeLayout = d3.tree().nodeSize([45, 180]);

    // Update graph rendering dynamically
    function update(source) {
      const treeData = treeLayout(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      // Normalize depth distance
      nodes.forEach(d => { d.y = d.depth * 180; });

      // ---- NODES ----
      const node = g.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = ++root.id || Math.random()));

      // Enter new nodes
      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .on('click', click)
        .style('cursor', 'pointer');

      // Decorative dots per node
      nodeEnter.append('circle')
        .attr('r', 6)
        .attr('fill', d => {
          if (d.depth === 0) return 'var(--accent, #6c5ce7)';
          return d.children || d._children ? '#a29bfe' : '#74b9ff';
        })
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))');

      // Glassmorphism-style labels
      const labelGroup = nodeEnter.append('g')
        .attr('transform', 'translate(12, -10)');

      labelGroup.append('rect')
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('y', -6)
        .attr('height', 24)
        .attr('fill', d => {
          if (d.depth === 0) return 'rgba(108, 92, 231, 0.9)'; // Deep accent
          return 'rgba(255, 255, 255, 0.06)';
        })
        .attr('stroke', d => {
          if (d.depth === 0) return 'rgba(108, 92, 231, 0.5)';
          return 'rgba(255, 255, 255, 0.15)';
        })
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');

      labelGroup.append('text')
        .attr('dy', '10')
        .attr('dx', '8')
        .attr('fill', '#ffffff')
        .style('font-size', d => d.depth === 0 ? '13px' : '11px')
        .style('font-weight', d => d.depth === 0 ? '600' : '400')
        .style('font-family', 'var(--font-sans, system-ui)')
        .text(d => d.data.name)
        .each(function() {
          // Adjust bounding rect dynamically to fits label text length
          const textWidth = this.getComputedTextLength();
          d3.select(this.parentNode).select('rect')
            .attr('width', textWidth + 16);
        });

      // Node transition to their actual position
      const nodeUpdate = node.merge(nodeEnter).transition()
        .duration(400)
        .attr('transform', d => `translate(${d.y},${d.x})`);

      nodeUpdate.select('circle')
        .attr('fill', d => {
          if (d.depth === 0) return 'var(--accent, #6c5ce7)';
          return d._children ? '#ffeaa7' : '#74b9ff'; // yellow if collapsed
        });

      // Transition exiting nodes to parent's new position
      const nodeExit = node.exit().transition()
        .duration(400)
        .attr('transform', d => `translate(${source.y},${source.x})`)
        .remove();

      // ---- LINKS ----
      const link = g.selectAll('path.link')
        .data(links, d => d.target.id);

      // Enter new links
      const linkEnter = link.enter().insert('path', 'g')
        .attr('class', 'link')
        .attr('d', d => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal(o, o);
        })
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.15)')
        .attr('stroke-width', 1.5);

      // Transition links
      link.merge(linkEnter).transition()
        .duration(400)
        .attr('d', d => diagonal(d.source, d.target));

      // Transition exiting links
      link.exit().transition()
        .duration(400)
        .attr('d', d => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      // Store old positions for transition mapping
      nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Cubic bezier path generator for D3 links
    function diagonal(s, d) {
      return `M ${s.y} ${s.x}
              C ${(s.y + d.y) / 2} ${s.x},
                ${(s.y + d.y) / 2} ${d.x},
                ${d.y} ${d.x}`;
    }

    // Initialize update call
    update(root);

    // Clean up
    return () => {
      svg.on('.zoom', null);
    };
  }, [data]);

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 500;
    const svg = d3.select(svgRef.current);
    
    // Animate returning to initial centered location
    svg.transition().duration(500).call(
      d3.zoom().on('zoom', (event) => {
        d3.select(svgRef.current).select('g').attr('transform', event.transform);
        setZoomLevel(Math.round(event.transform.k * 100));
      }).transform,
      d3.zoomIdentity.translate(width / 3, height / 2).scale(0.8)
    );
  };

  return (
    <div 
      ref={containerRef} 
      style={{
        position: 'relative',
        width: '100%',
        height: '400px',
        background: 'radial-gradient(circle, rgba(20,20,35,0.8) 0%, rgba(10,10,20,1) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '6px 12px',
          fontSize: '11px',
          color: 'var(--text-muted, #b2bec3)',
          fontWeight: '500',
          zIndex: 10
        }}
      >
        <Sparkles size={12} style={{ color: 'var(--accent, #6c5ce7)' }} />
        <span>Click các nút tròn để thu gọn/mở rộng</span>
      </div>

      <svg ref={svgRef} style={{ cursor: 'grab' }}></svg>

      {/* Control panel buttons */}
      <div 
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10
        }}
      >
        <div 
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'rgba(0,0,0,0.4)',
            padding: '4px 8px',
            borderRadius: '4px',
            marginRight: '4px'
          }}
        >
          {zoomLevel}%
        </div>
        
        <button
          onClick={handleResetZoom}
          title="Reset Viewport"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            hover: { background: 'rgba(255,255,255,0.15)' }
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
