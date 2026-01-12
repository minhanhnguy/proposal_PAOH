import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const D3Plot = () => {
    const svgRef = useRef();

    useEffect(() => {
        // Data
        const data = [10, 25, 40, 55, 70, 85, 100];

        // Dimensions
        const width = 400;
        const height = 200;
        const margin = { top: 20, right: 20, bottom: 30, left: 40 };

        // Select SVG
        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .style('background', '#f0f0f0')
            .style('margin-top', '20px')
            .style('overflow', 'visible');

        // Clear previous render
        svg.selectAll('*').remove();

        // Scales
        const xScale = d3.scaleBand()
            .domain(data.map((_, i) => i))
            .range([margin.left, width - margin.right])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data)])
            .nice()
            .range([height - margin.bottom, margin.top]);

        // Bars
        svg.append('g')
            .attr('fill', 'steelblue')
            .selectAll('rect')
            .data(data)
            .join('rect')
            .attr('x', (_, i) => xScale(i))
            .attr('y', d => yScale(d))
            .attr('height', d => yScale(0) - yScale(d))
            .attr('width', xScale.bandwidth());

        // X Axis
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat(i => `Item ${i + 1}`));

        // Y Axis
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(yScale));

    }, []);

    return (
        <div>
            <h2>Simple D3 Bar Chart</h2>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default D3Plot;
