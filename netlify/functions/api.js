const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

const authenticateToken = (authHeader) => {
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new Error("Access token required");
  }

  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || process.env.VITE_JWT_SECRET
    );
  } catch (err) {
    throw new Error("Invalid token");
  }
};

const createResponse = (statusCode, body, headers = {}) => {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return createResponse(200, {});
  }

  let path = event.path.replace("/.netlify/functions/api", "");

  if (path.startsWith("/api")) {
    path = path.replace("/api", "");
  }

  const method = event.httpMethod;

  try {
    await connectToDatabase();

    if (path === "/health" && method === "GET") {
      return createResponse(200, {
        status: "OK",
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "/auth/register" && method === "POST") {
      const { username, email, password } = JSON.parse(event.body || "{}");

      if (!username || !email || !password) {
        return createResponse(400, { error: "All fields are required" });
      }

      if (password.length < 6) {
        return createResponse(400, {
          error: "Password must be at least 6 characters",
        });
      }

      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        return createResponse(400, { error: "User already exists" });
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
        process.env.JWT_SECRET || process.env.VITE_JWT_SECRET,
        { expiresIn: "7d" }
      );

      return createResponse(201, {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      });
    }

    if (path === "/auth/login" && method === "POST") {
      const { email, password } = JSON.parse(event.body || "{}");

      if (!email || !password) {
        return createResponse(400, {
          error: "Email and password are required",
        });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return createResponse(400, { error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return createResponse(400, { error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET || process.env.VITE_JWT_SECRET,
        { expiresIn: "7d" }
      );

      return createResponse(200, {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      });
    }

    if (path === "/mindmaps" && method === "GET") {
      const authUser = authenticateToken(event.headers.authorization);

      const mindmaps = await MindMap.find({
        $or: [
          { owner: authUser.id },
          { "collaborators.user": authUser.id },
          { isPublic: true },
        ],
      })
        .populate("owner", "username avatar")
        .populate("collaborators.user", "username avatar")
        .sort({ updatedAt: -1 });

      return createResponse(200, { mindmaps });
    }

    if (path === "/mindmaps" && method === "POST") {
      const authUser = authenticateToken(event.headers.authorization);
      const { title, description, isPublic, tags } = JSON.parse(
        event.body || "{}"
      );

      if (!title) {
        return createResponse(400, { error: "Title is required" });
      }

      const mindmap = new MindMap({
        title,
        description: description || "",
        nodes: [],
        links: [],
        comments: new Map(),
        owner: authUser.id,
        isPublic: isPublic || false,
        tags: tags || [],
        lastModifiedBy: authUser.id,
      });

      await mindmap.save();
      await mindmap.populate("owner", "username avatar");

      return createResponse(201, mindmap);
    }

    if (path.match(/^\/mindmaps\/[a-f\d]{24}$/) && method === "GET") {
      const authUser = authenticateToken(event.headers.authorization);
      const mindmapId = path.split("/")[2];

      const mindmap = await MindMap.findById(mindmapId)
        .populate("owner", "username avatar")
        .populate("collaborators.user", "username avatar");

      if (!mindmap) {
        return createResponse(404, { error: "Mind map not found" });
      }

      const hasAccess =
        mindmap.owner._id.toString() === authUser.id ||
        mindmap.collaborators.some(
          (c) => c.user._id.toString() === authUser.id
        ) ||
        mindmap.isPublic;

      if (!hasAccess) {
        return createResponse(403, { error: "Access denied" });
      }

      return createResponse(200, mindmap);
    }

    if (path.match(/^\/mindmaps\/[a-f\d]{24}$/) && method === "PUT") {
      const authUser = authenticateToken(event.headers.authorization);
      const mindmapId = path.split("/")[2];
      const { nodes, links, title, description, isPublic, tags } = JSON.parse(
        event.body || "{}"
      );

      const mindmap = await MindMap.findById(mindmapId);

      if (!mindmap) {
        return createResponse(404, { error: "Mind map not found" });
      }

      const hasWriteAccess =
        mindmap.owner.toString() === authUser.id ||
        mindmap.collaborators.some(
          (c) =>
            c.user.toString() === authUser.id &&
            (c.permission === "write" || c.permission === "admin")
        );

      if (!hasWriteAccess) {
        return createResponse(403, { error: "Write access denied" });
      }

      if (nodes !== undefined) mindmap.nodes = nodes;
      if (links !== undefined) mindmap.links = links;
      if (title !== undefined) mindmap.title = title;
      if (description !== undefined) mindmap.description = description;
      if (isPublic !== undefined) mindmap.isPublic = isPublic;
      if (tags !== undefined) mindmap.tags = tags;

      mindmap.updatedAt = new Date();
      mindmap.lastModifiedBy = authUser.id;

      await mindmap.save();
      await mindmap.populate("owner", "username avatar");
      await mindmap.populate("collaborators.user", "username avatar");

      return createResponse(200, mindmap);
    }

    if (path.match(/^\/mindmaps\/[a-f\d]{24}$/) && method === "DELETE") {
      const authUser = authenticateToken(event.headers.authorization);
      const mindmapId = path.split("/")[2];

      const mindmap = await MindMap.findById(mindmapId);

      if (!mindmap) {
        return createResponse(404, { error: "Mind map not found" });
      }

      if (mindmap.owner.toString() !== authUser.id) {
        return createResponse(403, { error: "Only owner can delete mind map" });
      }

      await MindMap.findByIdAndDelete(mindmapId);
      return createResponse(200, { message: "Mind map deleted successfully" });
    }

    return createResponse(404, { error: "Route not found" });
  } catch (error) {
    console.error("API Error:", error);

    if (
      error.message === "Access token required" ||
      error.message === "Invalid token"
    ) {
      return createResponse(401, { error: error.message });
    }

    return createResponse(500, { error: "Server error" });
  }
};
