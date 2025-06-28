import { useState, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import {
  Download,
  Share2,
  Lock,
  Unlock,
  MessageCircle,
  Plus,
  Trash2,
  Edit3,
  Users,
  Save,
  ArrowLeft,
  UserPlus,
} from "lucide-react";
import { mindMapAPI } from "./services/api";
import socketService from "./services/socket";
import { useAuth } from "./contexts/AuthContext";

const ThinkNet = ({ mindMapId, onBack, initialData = null }) => {
  const { user } = useAuth();
  const svgRef = useRef();
  const containerRef = useRef();
  const [mindMap, setMindMap] = useState(null);
  const [nodes, setNodes] = useState([
    {
      id: "root",
      x: 400,
      y: 300,
      text: "Central Idea",
      level: 0,
      color: "#6366f1",
    },
  ]);
  const [links, setLinks] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [comments, setComments] = useState({});
  const [showComments, setShowComments] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [collaborators, setCollaborators] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);
  const [loading, setLoading] = useState(false); // Change to false by default for new mind maps
  const [saving, setSaving] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [newCollaboratorUsername, setNewCollaboratorUsername] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState("");

  // Auto-save timer
  const saveTimeoutRef = useRef();
  const hasUnsavedChanges = useRef(false);

  const colorPalette = [
    "#6366f1",
    "#ec4899",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
  ];

  const simulation = useRef();

  // Define event handlers outside useEffect so they're stable
  const handleNodeClick = useCallback((event, d) => {
    event.stopPropagation();
    setSelectedNode(d);
    setShowComments((prev) => (prev === d.id ? null : d.id));
  }, []);

  const handleNodeDoubleClick = useCallback((event, d) => {
    event.stopPropagation();
    setSelectedNode(d);
    setIsEditing(true);
    setEditText(d.text);
  }, []);

  // Initialize D3 visualization once
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) {
      return;
    }

    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width || 800;
    const height = containerRect.height || 600;

    const svg = d3.select(svgRef.current);

    // Set SVG dimensions
    svg.attr("width", width).attr("height", height);

    // Create gradient definitions only once
    const defs = svg.append("defs");
    colorPalette.forEach((color, i) => {
      const gradient = defs
        .append("radialGradient")
        .attr("id", `gradient-${i}`)
        .attr("cx", "30%")
        .attr("cy", "30%");

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.color(color).brighter(0.5));

      gradient.append("stop").attr("offset", "100%").attr("stop-color", color);
    });

    // Create main container group
    svg.append("g").attr("class", "main-container");

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        svg.select(".main-container").attr("transform", event.transform);
      });

    svg.call(zoom);

    // Handle container clicks to deselect nodes
    svg.on("click", () => {
      setSelectedNode(null);
      setShowComments(null);
    });
  }, []); // Run only once

  // Update D3 visualization when data changes
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) {
      return;
    }

    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width || 800;
    const height = containerRect.height || 600;

    const svg = d3.select(svgRef.current);
    const container = svg.select(".main-container");

    // Clear previous data elements
    container.selectAll(".links").remove();
    container.selectAll(".nodes").remove();

    // Create force simulation
    simulation.current = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Create links
    const linkGroup = container.append("g").attr("class", "links");
    const link = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#374151")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.6);

    // Create nodes
    const nodeGroup = container.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Add circles for nodes
    node
      .append("circle")
      .attr("r", (d) => 20 + d.level * 5)
      .attr("fill", (d) => {
        const colorIndex = colorPalette.indexOf(d.color);
        return colorIndex >= 0 ? `url(#gradient-${colorIndex})` : d.color;
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 3)
      .style("filter", "drop-shadow(0 4px 8px rgba(0,0,0,0.2))")
      .on("click", handleNodeClick)
      .on("dblclick", handleNodeDoubleClick);

    // Add text labels
    node
      .append("text")
      .text((d) => d.text)
      .attr("text-anchor", "middle")
      .attr("dy", "0.3em")
      .attr("fill", "#ffffff")
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.5)");

    // Add comment indicators
    node
      .filter((d) => comments[d.id] && comments[d.id].length > 0)
      .append("circle")
      .attr("r", 6)
      .attr("cx", 15)
      .attr("cy", -15)
      .attr("fill", "#ef4444")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2);

    // Drag behavior functions
    function dragstarted(event, d) {
      if (!event.active) simulation.current.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      setDraggedNode(d);
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.current.alphaTarget(0);
      d.fx = null;
      d.fy = null;
      setDraggedNode(null);
    }

    // Add drag behavior
    const drag = d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);

    node.call(drag);

    // Update positions on simulation tick
    simulation.current.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Clean up on unmount
    return () => {
      if (simulation.current) {
        simulation.current.stop();
      }
    };
  }, [nodes, links, comments]);

  // Load mind map data
  useEffect(() => {
    const loadMindMap = async () => {
      if (mindMapId) {
        try {
          setLoading(true);
          const response = await mindMapAPI.getById(mindMapId);
          const mindMapData = response.data;

          setMindMap(mindMapData);

          // Ensure nodes have proper positioning and clean data for D3
          const loadedNodes = mindMapData.nodes || [];
          if (loadedNodes.length === 0) {
            // If no nodes, use default
            setNodes([
              {
                id: "root",
                x: 400,
                y: 300,
                text: "Central Idea",
                level: 0,
                color: "#6366f1",
              },
            ]);
          } else {
            // Clean loaded nodes to only include fields D3.js expects
            const cleanedNodes = loadedNodes.map((node) => ({
              id: node.id,
              x: node.x,
              y: node.y,
              text: node.text,
              level: node.level,
              color: node.color,
              // Remove database fields like _id, createdBy, createdAt, updatedAt
            }));
            setNodes(cleanedNodes);
          }

          // Clean links to ensure they only have source and target IDs
          const loadedLinks = mindMapData.links || [];
          const cleanedLinks = loadedLinks.map((link) => ({
            source:
              typeof link.source === "object" ? link.source.id : link.source,
            target:
              typeof link.target === "object" ? link.target.id : link.target,
          }));
          setLinks(cleanedLinks);
          setIsPrivate(!mindMapData.isPublic);

          // Convert comments Map to object
          const commentsObj = {};
          if (mindMapData.comments) {
            for (const [nodeId, nodeComments] of Object.entries(
              mindMapData.comments
            )) {
              commentsObj[nodeId] = nodeComments;
            }
          }
          setComments(commentsObj);

          setCollaborators(mindMapData.collaborators || []);

          // Join the mindmap room for real-time collaboration
          socketService.joinMindMap(mindMapId);
        } catch (error) {
          console.error("Failed to load mind map:", error);
        } finally {
          setLoading(false);
        }
      } else {
        // For new mind maps, just use the default state
        if (initialData) {
          setNodes(initialData.nodes || nodes);
          setLinks(initialData.links || links);
        }
        // No need to setLoading(false) since it's already false by default
      }
    };

    loadMindMap();
  }, [mindMapId]);

  // Socket event listeners
  useEffect(() => {
    const handleNodeUpdated = ({ nodeId, updates, updatedBy }) => {
      if (updatedBy !== user.username) {
        setNodes((prev) =>
          prev.map((node) =>
            node.id === nodeId ? { ...node, ...updates } : node
          )
        );
      }
    };

    const handleCommentAdded = ({ nodeId, comment }) => {
      setComments((prev) => ({
        ...prev,
        [nodeId]: [...(prev[nodeId] || []), comment],
      }));
    };

    const handleActiveUsers = (users) => {
      setActiveUsers(users);
    };

    const handleUserJoined = (user) => {
      setActiveUsers((prev) => [...prev.filter((u) => u.id !== user.id), user]);
    };

    const handleUserLeft = (user) => {
      setActiveUsers((prev) => prev.filter((u) => u.id !== user.id));
    };

    socketService.onNodeUpdated(handleNodeUpdated);
    socketService.onCommentAdded(handleCommentAdded);
    socketService.onActiveUsers(handleActiveUsers);
    socketService.onUserJoined(handleUserJoined);
    socketService.onUserLeft(handleUserLeft);

    return () => {
      socketService.removeAllListeners();
    };
  }, [user.username]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save functionality
  const scheduleAutoSave = useCallback(() => {
    hasUnsavedChanges.current = true;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges.current && mindMapId) {
        await saveMindMap();
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  }, [mindMapId]);

  const saveMindMap = useCallback(async () => {
    // Allow saving for new mind maps (when both mindMap and mindMapId are null)
    // Only return early if we have no nodes to save
    if (nodes.length === 0) return;

    try {
      setSaving(true);

      // Clean nodes and links for database storage
      const cleanNodes = nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        text: node.text,
        level: node.level,
        color: node.color,
        // Remove D3-added properties like index, vx, vy, fx, fy
      }));

      const cleanLinks = links.map((link) => ({
        source: typeof link.source === "object" ? link.source.id : link.source,
        target: typeof link.target === "object" ? link.target.id : link.target,
      }));

      const mindMapData = {
        title: mindMap?.title || "Untitled Mind Map",
        description: mindMap?.description || "",
        nodes: cleanNodes,
        links: cleanLinks,
        isPublic: !isPrivate,
        comments,
      };

      if (mindMapId) {
        await mindMapAPI.update(mindMapId, mindMapData);
      } else {
        const response = await mindMapAPI.create(mindMapData);
        setMindMap(response.data);
        // Note: mindMapId prop can't be updated from here since it's passed from parent
        console.log("Mind map created:", response.data);
      }

      hasUnsavedChanges.current = false;
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to save mind map:", error);
      // Show user-friendly error message
      alert(
        "Failed to save mind map. Please check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }, [mindMap, mindMapId, nodes, links, isPrivate, comments]);

  const deleteMindMap = useCallback(async () => {
    if (!mindMapId) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this mind map? This action cannot be undone."
    );

    if (!confirmDelete) return;

    try {
      // Clear any pending auto-save to prevent save attempts after deletion
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Mark as no unsaved changes to prevent any save attempts
      hasUnsavedChanges.current = false;

      await mindMapAPI.delete(mindMapId);
      // Navigate back to dashboard after successful deletion
      onBack();
    } catch (error) {
      console.error("Failed to delete mind map:", error);
      alert("Failed to delete mind map. Please try again.");
    }
  }, [mindMapId, onBack]);

  const startEditingTitle = useCallback(() => {
    setEditTitleText(mindMap?.title || "New Mind Map");
    setIsEditingTitle(true);
  }, [mindMap?.title]);

  const cancelEditingTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditTitleText("");
  }, []);

  const saveTitle = useCallback(async () => {
    if (!editTitleText.trim()) {
      alert("Title cannot be empty");
      return;
    }

    try {
      // Update local state immediately for better UX
      setMindMap((prev) =>
        prev ? { ...prev, title: editTitleText.trim() } : null
      );
      setIsEditingTitle(false);

      // Schedule auto-save to save the title change
      scheduleAutoSave();
    } catch (error) {
      console.error("Failed to update title:", error);
      alert("Failed to update title. Please try again.");
    }
  }, [editTitleText, scheduleAutoSave]);

  const handleTitleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter") {
        saveTitle();
      } else if (e.key === "Escape") {
        cancelEditingTitle();
      }
    },
    [saveTitle, cancelEditingTitle]
  );

  // Trigger auto-save when data changes
  useEffect(() => {
    if (!loading) {
      scheduleAutoSave();
    }
  }, [nodes, links, isPrivate, scheduleAutoSave, loading]);

  const addNode = useCallback(() => {
    if (!selectedNode) return;

    const newNode = {
      id: `node-${Date.now()}`,
      x: selectedNode.x + Math.random() * 100 - 50,
      y: selectedNode.y + Math.random() * 100 - 50,
      text: "New Idea",
      level: selectedNode.level + 1,
      color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
    };

    const newLink = {
      source: selectedNode.id,
      target: newNode.id,
    };

    setNodes((prev) => [...prev, newNode]);
    setLinks((prev) => [...prev, newLink]);
    setSelectedNode(newNode);

    // Emit update to other users
    socketService.updateNode(newNode.id, newNode);
  }, [selectedNode, colorPalette]);

  const deleteNode = useCallback(() => {
    if (!selectedNode || selectedNode.id === "root") return;

    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setLinks((prev) =>
      prev.filter(
        (l) => l.source !== selectedNode.id && l.target !== selectedNode.id
      )
    );
    setSelectedNode(null);
  }, [selectedNode]);

  const saveEdit = useCallback(() => {
    if (!selectedNode) return;

    const updatedNodes = nodes.map((n) =>
      n.id === selectedNode.id ? { ...n, text: editText } : n
    );

    setNodes(updatedNodes);
    setIsEditing(false);
    setEditText("");

    // Emit update to other users
    socketService.updateNode(selectedNode.id, { text: editText });
  }, [selectedNode, editText, nodes]);
  const addComment = useCallback(async () => {
    if (!selectedNode || !newComment.trim()) return;

    try {
      // For new mind maps (no mindMapId), handle comments locally
      if (!mindMapId) {
        const comment = {
          id: Date.now(),
          text: newComment.trim(),
          author: user.username,
          timestamp: new Date().toLocaleTimeString(),
        };

        setComments((prev) => ({
          ...prev,
          [selectedNode.id]: [...(prev[selectedNode.id] || []), comment],
        }));
        setNewComment("");

        // Mark as having unsaved changes to encourage saving
        hasUnsavedChanges.current = true;
        scheduleAutoSave();
        return;
      }

      // For existing mind maps with valid ID, use API
      const response = await mindMapAPI.addComment(mindMapId, selectedNode.id, {
        text: newComment.trim(),
      });

      const comment = response.data;
      setComments((prev) => ({
        ...prev,
        [selectedNode.id]: [...(prev[selectedNode.id] || []), comment],
      }));
      setNewComment("");
    } catch (error) {
      console.error("Failed to add comment:", error);
      // Fallback to local comment if API fails
      const comment = {
        id: Date.now(),
        text: newComment.trim(),
        author: user.username,
        timestamp: new Date().toLocaleTimeString(),
      };
      setComments((prev) => ({
        ...prev,
        [selectedNode.id]: [...(prev[selectedNode.id] || []), comment],
      }));
      setNewComment("");
    }
  }, [selectedNode, newComment, mindMapId, user.username, scheduleAutoSave]);

  const addCollaborator = useCallback(async () => {
    if (!newCollaboratorUsername.trim()) return;

    try {
      // If this is a new mind map (no mindMapId), save it first
      if (!mindMapId) {
        alert("Please save the mind map first before adding collaborators.");
        return;
      }

      const response = await mindMapAPI.addCollaborator(mindMapId, {
        username: newCollaboratorUsername.trim(),
        permission: "write",
      });

      setCollaborators(response.data);
      setNewCollaboratorUsername("");
      setShowCollaboratorModal(false);
    } catch (error) {
      console.error("Failed to add collaborator:", error);
      alert(
        "Failed to add collaborator. Please check the username and try again."
      );
    }
  }, [newCollaboratorUsername, mindMapId]);

  const exportAsPNG = useCallback(() => {
    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const link = document.createElement("a");
      link.download = "mindmap.png";
      link.href = canvas.toDataURL();
      link.click();
    };

    img.src =
      "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(source)));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading mind map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2">
                {isEditingTitle ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      onKeyDown={handleTitleKeyPress}
                      onBlur={saveTitle}
                      className="text-2xl font-bold bg-transparent text-white border border-gray-400 rounded px-2 py-1 focus:border-purple-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={saveTitle}
                      className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                      title="Save Title"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditingTitle}
                      className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                      title="Cancel Edit"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold text-white">
                      {mindMap?.title || "New Mind Map"}
                    </h1>
                    {mindMap &&
                      mindMap.owner &&
                      mindMap.owner._id === user?.id && (
                        <button
                          onClick={startEditingTitle}
                          className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors"
                          title="Edit Title"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Users className="w-4 h-4" />
                <span>{activeUsers.length} online</span>
                {saving && <span className="text-yellow-400">Saving...</span>}
                {lastSaved && !saving && (
                  <span className="text-green-400">
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  isPrivate
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    : "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                }`}
              >
                {isPrivate ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span>{isPrivate ? "Private" : "Public"}</span>
              </button>

              <button
                onClick={() => setShowCollaboratorModal(true)}
                className="flex items-center space-x-2 px-3 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite</span>
              </button>

              <button
                onClick={exportAsPNG}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>

              <button
                onClick={saveMindMap}
                disabled={saving}
                className="flex items-center space-x-2 px-3 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>

              {/* Delete button - only show for saved mind maps owned by current user */}
              {mindMapId &&
                mindMap &&
                mindMap.owner &&
                mindMap.owner._id === user?.id && (
                  <button
                    onClick={deleteMindMap}
                    className="flex items-center space-x-2 px-3 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                    title="Delete Mind Map"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Main Canvas */}
        <div className="flex-1 relative" ref={containerRef}>
          <svg ref={svgRef} className="w-full h-full bg-transparent" />

          {/* Floating Toolbar */}
          {selectedNode && (
            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: selectedNode.color }}
                />
                <span className="text-white text-sm font-medium">
                  {selectedNode.text}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={addNode}
                  className="p-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                  title="Add Child Node"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditText(selectedNode.text);
                  }}
                  className="p-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                  title="Edit Node"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() =>
                    setShowComments(
                      showComments === selectedNode.id ? null : selectedNode.id
                    )
                  }
                  className="p-2 bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-colors relative"
                  title="Comments"
                >
                  <MessageCircle className="w-4 h-4" />
                  {comments[selectedNode.id] &&
                    comments[selectedNode.id].length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                        {comments[selectedNode.id].length}
                      </span>
                    )}
                </button>

                {selectedNode.id !== "root" && (
                  <button
                    onClick={deleteNode}
                    className="p-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                    title="Delete Node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Collaborator Modal */}
          {showCollaboratorModal && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-600 max-w-md w-full mx-4">
                <h3 className="text-white text-lg font-medium mb-4">
                  Add Collaborator
                </h3>
                <input
                  type="text"
                  value={newCollaboratorUsername}
                  onChange={(e) => setNewCollaboratorUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none mb-4"
                  placeholder="Enter username..."
                  onKeyPress={(e) => e.key === "Enter" && addCollaborator()}
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => setShowCollaboratorModal(false)}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addCollaborator}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {isEditing && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-600 max-w-md w-full mx-4">
                <h3 className="text-white text-lg font-medium mb-4">
                  Edit Node
                </h3>
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter node text..."
                  onKeyPress={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-3 mt-4">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Title Edit Modal */}
          {isEditingTitle && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-600 max-w-md w-full mx-4">
                <h3 className="text-white text-lg font-medium mb-4">
                  Edit Mind Map Title
                </h3>
                <input
                  type="text"
                  value={editTitleText}
                  onChange={(e) => setEditTitleText(e.target.value)}
                  onKeyPress={handleTitleKeyPress}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter mind map title..."
                  autoFocus
                />
                <div className="flex items-center justify-end space-x-3 mt-4">
                  <button
                    onClick={cancelEditingTitle}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTitle}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Title</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Comments Panel */}
        {showComments && (
          <div className="w-80 bg-black/20 backdrop-blur-sm border-l border-white/10 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Comments</h3>
              <button
                onClick={() => setShowComments(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments[showComments]?.map((comment) => (
                <div key={comment.id} className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-blue-300 text-sm font-medium">
                      {comment.author}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {comment.timestamp}
                    </span>
                  </div>
                  <p className="text-gray-200 text-sm">{comment.text}</p>
                </div>
              )) || (
                <p className="text-gray-400 text-sm text-center py-4">
                  No comments yet
                </p>
              )}
            </div>

            <div className="flex space-x-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                onKeyPress={(e) => e.key === "Enter" && addComment()}
              />
              <button
                onClick={addComment}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg p-3 text-white text-sm max-w-xs">
        <p className="font-medium mb-2">Quick Guide:</p>
        <ul className="space-y-1 text-xs text-gray-300">
          <li>• Click to select nodes</li>
          <li>• Double-click to edit</li>
          <li>• Drag to reposition</li>
          <li>• Use toolbar for actions</li>
          <li>• Zoom with mouse wheel</li>
        </ul>
      </div>
    </div>
  );
};

export default ThinkNet;

