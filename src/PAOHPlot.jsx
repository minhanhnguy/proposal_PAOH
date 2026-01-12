import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as XLSX from 'xlsx';

const PAOHPlot = () => {
    const svgRef = useRef();
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/proposal_dataset.xlsx');
                const arrayBuffer = await response.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { cellDates: true });
                console.log("First record:", jsonData[0]);
                setData(jsonData);
            } catch (error) {
                console.error("Error loading data:", error);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (!data) return;

        // 1. Process Data
        // Group by proposal_no
        const proposalsMap = d3.group(data, d => d.proposal_no);

        let proposals = Array.from(proposalsMap, ([id, records]) => {
            const firstRecord = records[0];
            // Extract all PIs for this proposal
            const authors = records.map(r => r.PI).filter(Boolean);
            // Remove duplicates if any
            const uniqueAuthors = [...new Set(authors)];

            // Helper to parse date (handle Excel serial numbers)
            const parseDate = (val) => {
                if (val instanceof Date) return val;
                if (typeof val === 'number') {
                    // Excel serial date to JS Date
                    // 25569 is the offset for 1970-01-01
                    return new Date(Math.round((val - 25569) * 86400 * 1000));
                }
                return new Date(val);
            };

            return {
                id,
                date: parseDate(firstRecord.date_submitted),
                title: firstRecord.title,
                authors: uniqueAuthors
            };
        });

        // Sort proposals by date
        proposals.sort((a, b) => a.date - b.date);

        // Resolve date collisions (jitter)
        const dateGroups = new Map();
        proposals.forEach(p => {
            const time = p.date.getTime();
            if (!dateGroups.has(time)) dateGroups.set(time, []);
            dateGroups.get(time).push(p);
        });

        dateGroups.forEach((group) => {
            if (group.length > 1) {
                // Spread them out by 5 days (increased from 3 days)
                const spacing = 86400000 * 5;
                const startOffset = - (group.length - 1) * spacing / 2;
                group.forEach((p, index) => {
                    p.date = new Date(p.date.getTime() + startOffset + index * spacing);
                });
            }
        });

        // Re-sort after jittering
        proposals.sort((a, b) => a.date - b.date);

        // Double Degree Jitter: Iterative collision resolution
        // Ensure a minimum spacing between ALL adjacent proposals, not just identical dates
        const minSpacing = 86400000 * 3; // 3 days minimum spacing
        let iterations = 0;
        let hasCollisions = true;

        // We do a single pass which is usually enough for 1D, but let's do it robustly
        // Actually, a single left-to-right pass is sufficient to satisfy the constraint if we only push forward.
        for (let i = 1; i < proposals.length; i++) {
            const prev = proposals[i - 1];
            const curr = proposals[i];
            const diff = curr.date.getTime() - prev.date.getTime();

            if (diff < minSpacing) {
                // Push current proposal forward
                curr.date = new Date(prev.date.getTime() + minSpacing);
            }
        }

        // Re-sort just in case (though the logic above preserves order)
        proposals.sort((a, b) => a.date - b.date);

        // Extract all unique authors and their start dates
        const authorStartDates = new Map();
        proposals.forEach(p => {
            p.authors.forEach(a => {
                if (!authorStartDates.has(a) || p.date < authorStartDates.get(a)) {
                    authorStartDates.set(a, p.date);
                }
            });
        });

        // Force-directed ordering
        // Initial sort by start date
        const sortedByDate = Array.from(authorStartDates.keys()).sort((a, b) => authorStartDates.get(a) - authorStartDates.get(b));

        const nodes = sortedByDate.map((id, index) => ({
            id,
            initialY: index * 10 // Use index as proxy for initial Y position
        }));
        const links = [];
        proposals.forEach(p => {
            const authors = p.authors;
            for (let i = 0; i < authors.length; i++) {
                for (let j = i + 1; j < authors.length; j++) {
                    links.push({ source: authors[i], target: authors[j] });
                }
            }
        });

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).strength(0.1)) // Weak link strength to allow time structure to dominate
            .force("charge", d3.forceManyBody().strength(-2)) // Weak repulsion
            .force("y", d3.forceY(d => d.initialY).strength(0.5)) // Strong pull to initial time-based position
            .stop();

        // Run simulation manually
        for (let i = 0; i < 300; ++i) simulation.tick();

        // Sort authors based on y-position from simulation
        // We use 'y' (or 'x', since it's 1D, but let's assume 'y' for vertical list)
        // Actually forceCenter(0,0) works in 2D. We want 1D ordering.
        // Let's just use the resulting positions (x or y) to sort.
        // Since we want them "in the middle", the simulation naturally centers them.
        // Sort authors based on y-position from simulation
        nodes.sort((a, b) => a.y - b.y);

        // Identify connected authors
        const connectedAuthors = new Set();
        proposals.forEach(p => {
            if (p.authors.length > 1) {
                p.authors.forEach(a => connectedAuthors.add(a));
            }
        });

        // Separate nodes into connected and solitary
        const connectedNodes = nodes.filter(n => connectedAuthors.has(n.id));
        const solitaryNodes = nodes.filter(n => !connectedAuthors.has(n.id));

        // Concatenate: connected first, then solitary (at the bottom)
        const finalNodes = [...connectedNodes, ...solitaryNodes];

        const authorsList = finalNodes.map(n => n.id);

        // 2. Setup D3
        // 2. Setup D3
        const margin = { top: 30, right: 20, bottom: 20, left: 150 }; // Reduced top margin
        const width = window.innerWidth - 20; // Fit viewport width
        const height = window.innerHeight - 20; // Fit viewport height

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .style('background', 'white');

        svg.selectAll('*').remove();

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        // Use time scale for x-axis (showing months)
        const dateExtent = d3.extent(proposals, p => p.date);
        // Add some padding to the date extent (e.g., 1 month before and after)
        const startDate = new Date(dateExtent[0]);
        startDate.setMonth(startDate.getMonth() - 1);
        const endDate = new Date(dateExtent[1]);
        endDate.setMonth(endDate.getMonth() + 1);

        const xScale = d3.scaleTime()
            .domain([startDate, endDate])
            .range([0, width - margin.left - margin.right]);

        const yScale = d3.scalePoint()
            .domain(authorsList)
            .range([0, height - margin.top - margin.bottom])
            .padding(0.5);

        // 3. Draw Authors (Horizontal Lines from start to end)
        g.selectAll('.author-line')
            .data(authorsList)
            .join('line')
            .attr('class', 'author-line')
            .attr('x1', d => xScale(authorStartDates.get(d)))
            .attr('x2', width - margin.left - margin.right)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', '#ccc') // Gray color
            .attr('stroke-width', 2);

        // Author Labels
        g.selectAll('.author-label')
            .data(authorsList)
            .join('text')
            .attr('class', 'author-label')
            .attr('x', d => xScale(authorStartDates.get(d)) - 10)
            .attr('y', d => yScale(d))
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .style('font-size', '12px') // Slightly larger font
            .text(d => d);

        // 4. Draw Proposals (Vertical Lines connecting authors)
        proposals.forEach((proposal, i) => {
            const x = xScale(proposal.date);
            const proposalAuthors = proposal.authors;

            if (proposalAuthors.length > 1) {
                // Find min and max y for this proposal
                const yPositions = proposalAuthors.map(a => yScale(a));
                const minY = Math.min(...yPositions);
                const maxY = Math.max(...yPositions);

                // Vertical line
                g.append('line')
                    .attr('x1', x)
                    .attr('x2', x)
                    .attr('y1', minY)
                    .attr('y2', maxY)
                    .attr('stroke', 'black')
                    .attr('stroke-width', 1.5)
                    .attr('opacity', 0.6)
                    .append('title') // Tooltip
                    .text(`${proposal.title}\nDate: ${proposal.date.toLocaleDateString()}`);
            }

            // Dots for each author in the proposal
            g.selectAll(`.node-${proposal.id}`)
                .data(proposalAuthors)
                .join('circle')
                .attr('cx', x)
                .attr('cy', d => yScale(d))
                .attr('r', 3)
                .attr('fill', 'white') // White fill
                .attr('stroke', 'black') // Black outline
                .attr('stroke-width', 1.5)
                .append('title') // Tooltip
                .text(`${proposal.title}\nDate: ${proposal.date.toLocaleDateString()}`);
        });

        // X-Axis with month labels
        console.log("Date Extent:", dateExtent);
        const xAxis = d3.axisTop(xScale)
            .tickFormat(d3.timeFormat('%b %Y'))
            .ticks(d3.timeMonth.every(3));

        const xAxisGroup = g.append('g')
            .attr('class', 'x-axis')
            .call(xAxis);

        // Explicit styling for cross-browser compatibility
        xAxisGroup.selectAll('text')
            .style('text-anchor', 'middle')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px')
            .attr('fill', 'black')
            .attr('dy', '-0.5em');

        xAxisGroup.selectAll('line')
            .attr('stroke', 'black');

        xAxisGroup.select('.domain')
            .attr('stroke', 'black');


        // Debug info
    }, [data]);

    return (
        <div style={{ overflow: 'hidden', width: '100%', height: '100vh' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default PAOHPlot;
