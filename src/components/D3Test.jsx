import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const D3Test = () => {
  const svgRef = useRef();

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Simple test
    svg.attr("width", 400).attr("height", 300);

    svg
      .append("circle")
      .attr("cx", 200)
      .attr("cy", 150)
      .attr("r", 50)
      .attr("fill", "red");

    svg
      .append("text")
      .attr("x", 200)
      .attr("y", 150)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .text("D3 Works!");

    console.log("D3 test rendered");
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-white mb-4">D3 Test</h2>
      <svg ref={svgRef} className="border border-white"></svg>
    </div>
  );
};

export default D3Test;
