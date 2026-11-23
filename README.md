# NexaSync

A responsive React + Vite dashboard prototype for the NexaSync collaboration platform.

## Run locally
1. Install Node.js (LTS).
2. Extract this folder and open it in VS Code.
3. Open a terminal in this folder.
4. Run `npm install`
5. Run `npm run dev`
6. Open the local URL printed by Vite (usually http://localhost:5173).

## Included screens
- Overview dashboard with project progress, team activity and task summary
- Projects overview
- My Tasks with search, status filters, and task status cycling
- Messages UI with local demo message sending
- Activity timeline
- Create-task modal

## Important implementation note
This is a frontend prototype using local in-memory demo data. It does not yet connect to your Node.js API, PostgreSQL, Redis, Kafka, or Socket.IO server. The UI is structured so you can connect those services next.

## Suggested backend integration
- REST API: authentication, workspaces, projects, tasks, notifications
- Socket.IO/WebSocket: chat, online presence, task updates
- Kafka: asynchronous domain events between backend services
- Redis: cache and online-presence state
- PostgreSQL: persistent users, workspaces, projects, tasks, messages, notifications, activity records

Use server-side JWT validation and RBAC for every protected action. Never rely only on hiding buttons in the frontend.
