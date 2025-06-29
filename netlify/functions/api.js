const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const serverless = require("serverless-http");

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/", limiter);

// MongoDB connection with connection pooling
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const connection = await mongoose.connect(
      process.env.MONGODB_URI || process.env.VITE_MONGODB_URI,
      {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    );

    cachedDb = connection;
    console.log("✅ Connected to MongoDB successfully");
    return connection;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    throw error;
  }
}

// Schemas
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

// Models
const User = mongoose.model("User", UserSchema);
const MindMap = mongoose.model("MindMap", MindMapSchema);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || process.env.VITE_JWT_SECRET,
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    }
  );
};

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Auth Routes
app.post("/auth/register", async (req, res) => {
  try {
    await connectToDatabase();

    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || process.env.VITE_JWT_SECRET,
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

app.post("/auth/login", async (req, res) => {
  try {
    await connectToDatabase();

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || process.env.VITE_JWT_SECRET,
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

// Mind Map Routes
app.get("/mindmaps", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();

    const mindmaps = await MindMap.find({
      $or: [
        { owner: req.user.id },
        { "collaborators.user": req.user.id },
        { isPublic: true },
      ],
    })
      .populate("owner", "username avatar")
      .populate("collaborators.user", "username avatar")
      .sort({ updatedAt: -1 });

    res.json(mindmaps);
  } catch (error) {
    console.error("Fetch mindmaps error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/mindmaps", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();

    const { title, description, isPublic, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const mindmap = new MindMap({
      title,
      description: description || "",
      nodes: [],
      links: [],
      comments: new Map(),
      owner: req.user.id,
      isPublic: isPublic || false,
      tags: tags || [],
      lastModifiedBy: req.user.id,
    });

    await mindmap.save();
    await mindmap.populate("owner", "username avatar");

    res.status(201).json(mindmap);
  } catch (error) {
    console.error("Create mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/mindmaps/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();

    const mindmap = await MindMap.findById(req.params.id)
      .populate("owner", "username avatar")
      .populate("collaborators.user", "username avatar");

    if (!mindmap) {
      return res.status(404).json({ error: "Mind map not found" });
    }

    // Check permissions
    const hasAccess =
      mindmap.owner._id.toString() === req.user.id ||
      mindmap.collaborators.some(
        (c) => c.user._id.toString() === req.user.id
      ) ||
      mindmap.isPublic;

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(mindmap);
  } catch (error) {
    console.error("Fetch mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/mindmaps/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();

    const { nodes, links, title, description, isPublic, tags } = req.body;

    const mindmap = await MindMap.findById(req.params.id);

    if (!mindmap) {
      return res.status(404).json({ error: "Mind map not found" });
    }

    // Check permissions
    const hasWriteAccess =
      mindmap.owner.toString() === req.user.id ||
      mindmap.collaborators.some(
        (c) =>
          c.user.toString() === req.user.id &&
          (c.permission === "write" || c.permission === "admin")
      );

    if (!hasWriteAccess) {
      return res.status(403).json({ error: "Write access denied" });
    }

    // Update fields
    if (nodes !== undefined) mindmap.nodes = nodes;
    if (links !== undefined) mindmap.links = links;
    if (title !== undefined) mindmap.title = title;
    if (description !== undefined) mindmap.description = description;
    if (isPublic !== undefined) mindmap.isPublic = isPublic;
    if (tags !== undefined) mindmap.tags = tags;

    mindmap.updatedAt = new Date();
    mindmap.lastModifiedBy = req.user.id;

    await mindmap.save();
    await mindmap.populate("owner", "username avatar");
    await mindmap.populate("collaborators.user", "username avatar");

    res.json(mindmap);
  } catch (error) {
    console.error("Update mindmap error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/mindmaps/:id", authenticateToken, async (req, res) => {
  try {
    await connectToDatabase();

    const mindmap = await MindMap.findById(req.params.id);

    if (!mindmap) {
      return res.status(404).json({ error: "Mind map not found" });
    }

    // Only owner can delete
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

// Comments Routes
app.post(
  "/mindmaps/:id/comments/:nodeId",
  authenticateToken,
  async (req, res) => {
    try {
      await connectToDatabase();

      const { text } = req.body;
      const { id: mindmapId, nodeId } = req.params;

      if (!text || text.trim() === "") {
        return res.status(400).json({ error: "Comment text is required" });
      }

      const mindmap = await MindMap.findById(mindmapId);

      if (!mindmap) {
        return res.status(404).json({ error: "Mind map not found" });
      }

      // Check permissions
      const hasAccess =
        mindmap.owner.toString() === req.user.id ||
        mindmap.collaborators.some((c) => c.user.toString() === req.user.id) ||
        mindmap.isPublic;

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const user = await User.findById(req.user.id);
      const comment = {
        id: Date.now().toString(),
        text: text.trim(),
        author: user.username,
        authorId: req.user.id,
        timestamp: new Date(),
      };

      if (!mindmap.comments.has(nodeId)) {
        mindmap.comments.set(nodeId, []);
      }

      const nodeComments = mindmap.comments.get(nodeId);
      nodeComments.push(comment);
      mindmap.comments.set(nodeId, nodeComments);

      mindmap.updatedAt = new Date();
      await mindmap.save();

      res.status(201).json(comment);
    } catch (error) {
      console.error("Add comment error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.get(
  "/mindmaps/:id/comments/:nodeId",
  authenticateToken,
  async (req, res) => {
    try {
      await connectToDatabase();

      const { id: mindmapId, nodeId } = req.params;

      const mindmap = await MindMap.findById(mindmapId);

      if (!mindmap) {
        return res.status(404).json({ error: "Mind map not found" });
      }

      // Check permissions
      const hasAccess =
        mindmap.owner.toString() === req.user.id ||
        mindmap.collaborators.some((c) => c.user.toString() === req.user.id) ||
        mindmap.isPublic;

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      const comments = mindmap.comments.get(nodeId) || [];
      res.json(comments);
    } catch (error) {
      console.error("Fetch comments error:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Export the serverless function
module.exports.handler = serverless(app);
