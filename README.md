# ThinkNet - Collaborative Mind Mapping Application

ThinkNet is a real-time collaborative mind mapping application built with React, Vite, Node.js, Express, Socket.io, and MongoDB. It allows users to create, share, and collaborate on mind maps in real-time.

## Features

- 🧠 Interactive mind mapping with D3.js visualization
- 👥 Real-time collaboration with Socket.io
- 💬 Node-based commenting system
- 🔐 User authentication and authorization
- 🔒 Public/private mind map settings
- 👨‍💼 Collaborator management
- 💾 Auto-save functionality
- 📤 Export to PNG
- 🎨 Beautiful, modern UI with Tailwind CSS

## Tech Stack

### Frontend

- React 19
- Vite
- D3.js for visualization
- Socket.io client for real-time features
- Lucide React for icons
- Tailwind CSS for styling

### Backend

- Node.js
- Express.js
- Socket.io for real-time communication
- MongoDB with Mongoose
- JWT for authentication
- bcryptjs for password hashing

## Prerequisites

Before running this application, make sure you have:

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Git

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/saideep-priyadarshan/thinknet.git
   cd thinknet
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   - Copy `.env.example` to `.env`, or create a `.env` file
   - Update the environment variables in `.env`:
     ```env
     PORT=5000
     NODE_ENV=development
     MONGODB_URI=mongodb://localhost:27017/thinknet
     JWT_SECRET=your_jwt_key_here
     CLIENT_URL=http://localhost:5173
     VITE_API_BASE_URL=http://localhost:5000/api
     VITE_SOCKET_URL=http://localhost:5000
     ```

4. Make sure MongoDB is running:
   - If using local MongoDB: `mongod`
   - If using MongoDB Atlas: Update the `MONGODB_URI` in `.env`

## Running the Application

### Development Mode

To run both frontend and backend simultaneously:

```bash
npm run dev:full
```

This will start:

- Backend server on `http://localhost:5000`
- Frontend development server on `http://localhost:5173`

### Run Frontend Only

```bash
npm run dev
```

### Run Backend Only

```bash
npm run dev:backend
```

## Usage

1. **Registration/Login**: Create an account or log in with existing credentials
2. **Dashboard**: View all your mind maps and those shared with you
3. **Create Mind Map**: Click "New Mind Map" to create a new mind map
4. **Collaborate**:
   - Click on a node to select it
   - Double-click to edit node text
   - Use the toolbar to add child nodes, delete nodes, or add comments
   - Invite collaborators using the "Invite" button
5. **Real-time Collaboration**: See other users' cursors and changes in real-time
6. **Save & Export**: Auto-save is enabled, or manually save and export as PNG

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Mind Maps

- `GET /api/mindmaps` - Get all accessible mind maps
- `GET /api/mindmaps/:id` - Get specific mind map
- `POST /api/mindmaps` - Create new mind map
- `PUT /api/mindmaps/:id` - Update mind map
- `DELETE /api/mindmaps/:id` - Delete mind map

### Comments

- `POST /api/mindmaps/:id/comments/:nodeId` - Add comment to node

### Collaborators

- `POST /api/mindmaps/:id/collaborators` - Add collaborator

## Socket.io Events

### Client to Server

- `join_mindmap` - Join a mind map room
- `node_update` - Update node data
- `cursor_move` - Update cursor position

### Server to Client

- `mindmap_updated` - Mind map data updated
- `node_updated` - Specific node updated
- `comment_added` - New comment added
- `user_joined` - User joined the mind map
- `user_left` - User left the mind map
- `cursor_moved` - User moved cursor

## Project Structure

```
src/
├── components/
│   ├── Login.jsx              # Authentication component
│   └── MindMapDashboard.jsx   # Dashboard for mind map management
├── contexts/
│   └── AuthContext.jsx       # Authentication context
├── services/
│   ├── api.js                # API service layer
│   └── socket.js             # Socket.io service
├── App.jsx                   # Main app component
├── thinknet-mindmap.jsx      # Mind map visualization component
├── thinknet-backend.js       # Backend server
└── main.jsx                  # App entry point
```

