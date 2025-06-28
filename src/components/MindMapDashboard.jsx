import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Clock,
  Users,
  Lock,
  Unlock,
  Trash2,
  Edit3,
} from "lucide-react";
import { mindMapAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const MindMapDashboard = ({ onSelectMindMap, onCreateNew }) => {
  const { user, logout } = useAuth();
  const [mindMaps, setMindMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [filterBy, setFilterBy] = useState("all");
  const [editingMindMapId, setEditingMindMapId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    loadMindMaps();
  }, [searchTerm, filterBy]);

  const loadMindMaps = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;

      const response = await mindMapAPI.getAll(params);
      let maps = response.data.mindmaps;

      // Apply filters
      if (filterBy === "owned") {
        maps = maps.filter((map) => map.owner._id === user.id);
      } else if (filterBy === "shared") {
        maps = maps.filter(
          (map) =>
            map.collaborators.some((c) => c.user._id === user.id) ||
            (map.isPublic && map.owner._id !== user.id)
        );
      }

      setMindMaps(maps);
    } catch (error) {
      console.error("Failed to load mind maps:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMindMap = async (mindMapId, event) => {
    // Prevent card click event from firing
    event.stopPropagation();

    if (
      !confirm(
        "Are you sure you want to delete this mind map? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await mindMapAPI.delete(mindMapId);
      // Reload the mind maps list
      loadMindMaps();
    } catch (error) {
      console.error("Failed to delete mind map:", error);
      alert("Failed to delete mind map. Please try again.");
    }
  };

  const startEditingTitle = (mindMap, event) => {
    event.stopPropagation();
    setEditingMindMapId(mindMap._id);
    setEditingTitle(mindMap.title);
  };

  const cancelEditingTitle = (event) => {
    if (event) event.stopPropagation();
    setEditingMindMapId(null);
    setEditingTitle("");
  };

  const saveTitle = async (mindMapId, event) => {
    if (event) event.stopPropagation();

    if (!editingTitle.trim()) {
      alert("Title cannot be empty");
      return;
    }

    try {
      await mindMapAPI.update(mindMapId, { title: editingTitle.trim() });
      // Update the local state
      setMindMaps((prevMaps) =>
        prevMaps.map((map) =>
          map._id === mindMapId ? { ...map, title: editingTitle.trim() } : map
        )
      );
      setEditingMindMapId(null);
      setEditingTitle("");
    } catch (error) {
      console.error("Failed to update title:", error);
      alert("Failed to update title. Please try again.");
    }
  };

  const handleTitleKeyPress = (mindMapId, event) => {
    if (event.key === "Enter") {
      saveTitle(mindMapId, event);
    } else if (event.key === "Escape") {
      cancelEditingTitle(event);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const MindMapCard = ({ mindMap }) => (
    <div
      onClick={() => onSelectMindMap(mindMap._id)}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-xl p-6 hover:border-purple-500 transition-all cursor-pointer group relative"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 pr-2">
          {editingMindMapId === mindMap._id ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => handleTitleKeyPress(mindMap._id, e)}
                onBlur={(e) => saveTitle(mindMap._id, e)}
                className="text-white font-semibold text-lg bg-transparent border border-gray-400 rounded px-2 py-1 focus:border-purple-500 focus:outline-none w-full"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h3 className="text-white font-semibold text-lg group-hover:text-purple-300 transition-colors line-clamp-2 flex-1">
                {mindMap.title}
              </h3>
              {mindMap.owner._id === user.id && (
                <button
                  onClick={(e) => startEditingTitle(mindMap, e)}
                  className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit Title"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {mindMap.isPublic ? (
            <Unlock className="w-4 h-4 text-green-400" />
          ) : (
            <Lock className="w-4 h-4 text-red-400" />
          )}
        </div>
      </div>

      {mindMap.description && (
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {mindMap.description}
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs">
              {mindMap.owner.username[0].toUpperCase()}
            </div>
            <span>{mindMap.owner.username}</span>
          </div>
          {mindMap.collaborators.length > 0 && (
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{mindMap.collaborators.length}</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>{formatDate(mindMap.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {mindMap.nodes.length} nodes
        </div>
        {mindMap.tags && mindMap.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mindMap.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {mindMap.tags.length > 3 && (
              <span className="text-xs text-gray-400">
                +{mindMap.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete button - only show for mind maps owned by current user */}
      {mindMap.owner._id === user.id && (
        <button
          onClick={(e) => deleteMindMap(mindMap._id, e)}
          className="absolute bottom-3 right-3 p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete Mind Map"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const MindMapListItem = ({ mindMap }) => (
    <div
      onClick={() => onSelectMindMap(mindMap._id)}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-4 hover:border-purple-500 transition-all cursor-pointer group flex items-center justify-between"
    >
      <div className="flex items-center space-x-4 flex-1">
        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-semibold">
          {mindMap.title[0].toUpperCase()}
        </div>
        <div className="flex-1">
          {editingMindMapId === mindMap._id ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => handleTitleKeyPress(mindMap._id, e)}
                onBlur={(e) => saveTitle(mindMap._id, e)}
                className="text-white font-medium bg-transparent border border-gray-400 rounded px-2 py-1 focus:border-purple-500 focus:outline-none flex-1"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <h3 className="text-white font-medium group-hover:text-purple-300 transition-colors flex-1">
                {mindMap.title}
              </h3>
              {mindMap.owner._id === user.id && (
                <button
                  onClick={(e) => startEditingTitle(mindMap, e)}
                  className="p-1 hover:bg-white/10 text-gray-400 hover:text-white rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Edit Title"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
            <span>{mindMap.owner.username}</span>
            <span>{mindMap.nodes.length} nodes</span>
            <span>{formatDate(mindMap.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {mindMap.collaborators.length > 0 && (
          <div className="flex items-center space-x-1 text-gray-400">
            <Users className="w-4 h-4" />
            <span className="text-sm">{mindMap.collaborators.length}</span>
          </div>
        )}
        {mindMap.isPublic ? (
          <Unlock className="w-4 h-4 text-green-400" />
        ) : (
          <Lock className="w-4 h-4 text-red-400" />
        )}
        {/* Delete button - only show for mind maps owned by current user */}
        {mindMap.owner._id === user.id && (
          <button
            onClick={(e) => deleteMindMap(mindMap._id, e)}
            className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Mind Map"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-white">ThinkNet</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, {user.username}</span>
              <button
                onClick={logout}
                className="text-gray-300 hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search mind maps..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Maps</option>
              <option value="owned">My Maps</option>
              <option value="shared">Shared with Me</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center border border-gray-600 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${
                  viewMode === "grid"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white"
                } transition-colors`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${
                  viewMode === "list"
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-white"
                } transition-colors`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onCreateNew}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Mind Map</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : mindMaps.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 mb-4">
              {searchTerm
                ? "No mind maps found matching your search."
                : "No mind maps yet."}
            </div>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Your First Mind Map</span>
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            }
          >
            {mindMaps.map((mindMap) =>
              viewMode === "grid" ? (
                <MindMapCard key={mindMap._id} mindMap={mindMap} />
              ) : (
                <MindMapListItem key={mindMap._id} mindMap={mindMap} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapDashboard;
