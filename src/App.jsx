import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./components/Login";
import MindMapDashboard from "./components/MindMapDashboard";
import ThinkNet from "./thinknet-mindmap";
import "./App.css";

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedMindMapId, setSelectedMindMapId] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login
        isLogin={isLoginMode}
        onToggleMode={() => setIsLoginMode(!isLoginMode)}
      />
    );
  }

  const handleSelectMindMap = (mindMapId) => {
    setSelectedMindMapId(mindMapId);
    setCurrentView("mindmap");
  };

  const handleCreateNew = () => {
    setSelectedMindMapId(null);
    setCurrentView("mindmap");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setSelectedMindMapId(null);
  };

  return (
    <>
      {currentView === "dashboard" ? (
        <MindMapDashboard
          onSelectMindMap={handleSelectMindMap}
          onCreateNew={handleCreateNew}
        />
      ) : (
        <ThinkNet
          mindMapId={selectedMindMapId}
          onBack={handleBackToDashboard}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

