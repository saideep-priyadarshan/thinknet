import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      autoConnect: false,
    });

    this.socket.connect();

    this.socket.on("connect", () => {
      this.isConnected = true;
      console.log("Connected to server");
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
      console.log("Disconnected from server");
    });

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  joinMindMap(mindmapId) {
    if (this.socket) {
      this.socket.emit("join_mindmap", mindmapId);
    }
  }

  updateNode(nodeId, updates) {
    if (this.socket) {
      this.socket.emit("node_update", { nodeId, updates });
    }
  }

  moveCursor(x, y) {
    if (this.socket) {
      this.socket.emit("cursor_move", { x, y });
    }
  }

  onMindMapUpdated(callback) {
    if (this.socket) {
      this.socket.on("mindmap_updated", callback);
    }
  }

  onNodeUpdated(callback) {
    if (this.socket) {
      this.socket.on("node_updated", callback);
    }
  }

  onCommentAdded(callback) {
    if (this.socket) {
      this.socket.on("comment_added", callback);
    }
  }

  onUserJoined(callback) {
    if (this.socket) {
      this.socket.on("user_joined", callback);
    }
  }

  onUserLeft(callback) {
    if (this.socket) {
      this.socket.on("user_left", callback);
    }
  }

  onActiveUsers(callback) {
    if (this.socket) {
      this.socket.on("active_users", callback);
    }
  }

  onCursorMoved(callback) {
    if (this.socket) {
      this.socket.on("cursor_moved", callback);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new SocketService();
