const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api/", limiter);

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/thinknet")
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection failed:", error.message);
    console.log(
      "⚠️  Server will continue without database. Please start MongoDB for full functionality."
    );
  });

const db = mongoose.connection;
db.on("error", (error) => {
  console.error("MongoDB connection error:", error.message);
});
db.on("disconnected", () => {
  console.log("❌ MongoDB disconnected");
});
db.on("reconnected", () => {
  console.log("✅ MongoDB reconnected");
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const NodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  text: { type: String, required: true },
  level: { type: Number, default: 0 },
  color: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const LinkSchema = new mongoose.Schema({
  source: { type: String, required: true },
  target: { type: String, required: true },
});

const CommentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  author: { type: String, required: true },
  authorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const MindMapSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  nodes: [NodeSchema],
  links: [LinkSchema],
  comments: { type: Map, of: [CommentSchema] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  collaborators: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      permission: {
        type: String,
        enum: ["read", "write", "admin"],
        default: "read",
      },
    },
  ],
  isPublic: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

const User = mongoose.model("User", UserSchema);
const MindMap = mongoose.model("MindMap", MindMapSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback_secret",
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    }
  );
};

const socketAuth = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback_secret",
    (err, user) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      socket.userId = user.id;
      socket.username = user.username;
      next();
    }
  );
};

io.use(socketAuth);

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/mindmaps", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", tags = "" } = req.query;
    const userId = req.user.id;

    const query = {
      $or: [
        { owner: userId },
        { "collaborators.user": userId },
        { isPublic: true },
      ],
    };

    if (search) {
      query.$and = [
        query.$or ? { $or: query.$or } : {},
        {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      query.tags = { $in: tagArray };
    }

    const mindmaps = await MindMap.find(query)
      .populate("owner", "username email avatar")
      .populate("collaborators.user", "username email avatar")
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MindMap.countDocuments(query);

    res.json({
      mindmaps,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get mindmaps error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/mindmaps/:id", authenticateToken, async (req, res) => {
  try {
    const mindmap = await MindMap.findById(req.params.id)
      .populate("owner", "username email avatar")
      .populate("collaborators.user", "username email avatar");

    if (!mindmap) {
      return res.status(404).json({ error: "Mind map not found" });
    }

    const userId = req.user.id;
    const hasAccess =
      mindmap.owner._id.toString() === userId ||
      mindmap.collaborators.some((c) => c.user._id.toString() === userId) ||
      mindmap.isPublic;

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(mindmap);
  } catch (error) {
    console.error("Get mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/mindmaps", authenticateToken, async (req, res) => {
  try {
    const { title, description, nodes, links, isPublic, tags } = req.body;

    if (!title || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: "Title and nodes are required" });
    }

    const processedNodes = nodes.map((node) => ({
      ...node,
      createdBy: req.user.username,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const mindmap = new MindMap({
      title,
      description: description || "",
      nodes: processedNodes,
      links: links || [],
      comments: new Map(),
      owner: req.user.id,
      isPublic: isPublic || false,
      tags: tags || [],
      lastModifiedBy: req.user.id,
    });

    await mindmap.save();
    await mindmap.populate("owner", "username email avatar");

    res.status(201).json(mindmap);
  } catch (error) {
    console.error("Create mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/mindmaps/:id", authenticateToken, async (req, res) => {
  try {
    const mindmap = await MindMap.findById(req.params.id);

    if (!mindmap) {
      return res.status(404).json({ error: "Mind map not found" });
    }

    const userId = req.user.id;
    const canEdit =
      mindmap.owner.toString() === userId ||
      mindmap.collaborators.some(
        (c) =>
          c.user.toString() === userId &&
          ["write", "admin"].includes(c.permission)
      );

    if (!canEdit) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const { title, description, nodes, links, isPublic, tags } = req.body;

    if (title) mindmap.title = title;
    if (description !== undefined) mindmap.description = description;
    if (nodes) {
      const processedNodes = nodes.map((node) => ({
        ...node,
        createdBy: node.createdBy || req.user.username,
        createdAt: node.createdAt || new Date(),
        updatedAt: new Date(),
      }));
      mindmap.nodes = processedNodes;
    }
    if (links) mindmap.links = links;
    if (isPublic !== undefined) mindmap.isPublic = isPublic;
    if (tags) mindmap.tags = tags;

    mindmap.updatedAt = Date.now();
    mindmap.lastModifiedBy = userId;

    await mindmap.save();
    await mindmap.populate("owner", "username email avatar");
    await mindmap.populate("collaborators.user", "username email avatar");

    io.to(`mindmap:${req.params.id}`).emit("mindmap_updated", mindmap);

    res.json(mindmap);
  } catch (error) {
    console.error("Update mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/mindmaps/:id", authenticateToken, async (req, res) => {
  try {
    const mindmap = await MindMap.findById(req.params.id);

    if (!mindmap) {
      return res.status(404).json({ error: "Mind map not found" });
    }

    if (mindmap.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only owner can delete mind map" });
    }

    await MindMap.findByIdAndDelete(req.params.id);

    res.json({ message: "Mind map deleted successfully" });
  } catch (error) {
    console.error("Delete mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post(
  "/api/mindmaps/:id/comments/:nodeId",
  authenticateToken,
  async (req, res) => {
    try {
      const { text } = req.body;
      const { id: mindmapId, nodeId } = req.params;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Comment text is required" });
      }

      const mindmap = await MindMap.findById(mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mind map not found" });
      }

      const userId = req.user.id;
      const hasAccess =
        mindmap.owner.toString() === userId ||
        mindmap.collaborators.some((c) => c.user.toString() === userId) ||
        mindmap.isPublic;

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const comment = {
        id: Date.now().toString(),
        text: text.trim(),
        author: req.user.username,
        authorId: userId,
        timestamp: new Date(),
      };

      if (!mindmap.comments.has(nodeId)) {
        mindmap.comments.set(nodeId, []);
      }

      const nodeComments = mindmap.comments.get(nodeId);
      nodeComments.push(comment);
      mindmap.comments.set(nodeId, nodeComments);

      mindmap.updatedAt = Date.now();
      await mindmap.save();

      io.to(`mindmap:${mindmapId}`).emit("comment_added", {
        nodeId,
        comment,
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Add comment error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.post(
  "/api/mindmaps/:id/collaborators",
  authenticateToken,
  async (req, res) => {
    try {
      const { username, permission = "read" } = req.body;
      const mindmapId = req.params.id;

      const mindmap = await MindMap.findById(mindmapId);
      if (!mindmap) {
        return res.status(404).json({ error: "Mind map not found" });
      }

      if (mindmap.owner.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ error: "Only owner can add collaborators" });
      }

      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingCollaborator = mindmap.collaborators.find(
        (c) => c.user.toString() === user._id.toString()
      );

      if (existingCollaborator) {
        return res
          .status(400)
          .json({ error: "User is already a collaborator" });
      }

      mindmap.collaborators.push({
        user: user._id,
        permission,
      });

      await mindmap.save();
      await mindmap.populate("collaborators.user", "username email avatar");

      res.json(mindmap.collaborators);
    } catch (error) {
      console.error("Add collaborator error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log(`User ${socket.username} connected`);

  socket.on("join_mindmap", async (mindmapId) => {
    try {
      const mindmap = await MindMap.findById(mindmapId);
      if (!mindmap) {
        socket.emit("error", "Mind map not found");
        return;
      }

      const hasAccess =
        mindmap.owner.toString() === socket.userId ||
        mindmap.collaborators.some(
          (c) => c.user.toString() === socket.userId
        ) ||
        mindmap.isPublic;

      if (!hasAccess) {
        socket.emit("error", "Access denied");
        return;
      }

      socket.join(`mindmap:${mindmapId}`);
      socket.currentMindmap = mindmapId;

      if (!activeUsers.has(mindmapId)) {
        activeUsers.set(mindmapId, new Set());
      }
      activeUsers.get(mindmapId).add({
        id: socket.userId,
        username: socket.username,
      });

      socket.to(`mindmap:${mindmapId}`).emit("user_joined", {
        id: socket.userId,
        username: socket.username,
      });

      const users = Array.from(activeUsers.get(mindmapId));
      socket.emit("active_users", users);
    } catch (error) {
      console.error("Join mindmap error:", error);
      socket.emit("error", "Server error");
    }
  });

  socket.on("node_update", async (data) => {
    if (!socket.currentMindmap) return;

    try {
      const { nodeId, updates } = data;

      socket.to(`mindmap:${socket.currentMindmap}`).emit("node_updated", {
        nodeId,
        updates,
        updatedBy: socket.username,
      });

      const mindmap = await MindMap.findById(socket.currentMindmap);
      if (mindmap) {
        const nodeIndex = mindmap.nodes.findIndex((n) => n.id === nodeId);
        if (nodeIndex !== -1) {
          Object.assign(mindmap.nodes[nodeIndex], updates);
          mindmap.updatedAt = Date.now();
          mindmap.lastModifiedBy = socket.userId;
          await mindmap.save();
        }
      }
    } catch (error) {
      console.error("Node update error:", error);
    }
  });

  socket.on("cursor_move", (data) => {
    if (!socket.currentMindmap) return;

    socket.to(`mindmap:${socket.currentMindmap}`).emit("cursor_moved", {
      userId: socket.userId,
      username: socket.username,
      x: data.x,
      y: data.y,
    });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.username} disconnected`);

    if (socket.currentMindmap) {
      const mindmapUsers = activeUsers.get(socket.currentMindmap);
      if (mindmapUsers) {
        mindmapUsers.delete({
          id: socket.userId,
          username: socket.username,
        });

        if (mindmapUsers.size === 0) {
          activeUsers.delete(socket.currentMindmap);
        } else {
          socket.to(`mindmap:${socket.currentMindmap}`).emit("user_left", {
            id: socket.userId,
            username: socket.username,
          });
        }
      }
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

