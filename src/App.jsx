
import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users,
  MessageSquare, Bell, Settings, Plus, Search, LogOut,
  Menu, X, Send, Trash2, CheckCircle2,
  Briefcase, Activity, ArrowRight
} from "lucide-react";

const defaults = {
  workspace: null,
  members: [],
  projects: [],
  tasks: [],
  messages: [],
  notifications: [],
  activity: []
};

function readData() {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem("nexasync_data") || "{}")
    };
  } catch {
    return { ...defaults };
  }
}

export default function App() {
  const [data, setData] = useState(readData);
  const [user, setUser] = useState(() => localStorage.getItem("nx_user") || "");
  const [role, setRole] = useState(() => localStorage.getItem("nx_role") || "Project Manager");
  const [logged, setLogged] = useState(() => localStorage.getItem("nx_login") === "true");
  const [page, setPage] = useState("Dashboard");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");

  const [workspaceName, setWorkspaceName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("Team Member");

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [taskName, setTaskName] = useState("");
  const [taskProject, setTaskProject] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDue, setTaskDue] = useState("");
  const [chatText, setChatText] = useState("");
  const [modal, setModal] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    localStorage.setItem("nexasync_data", JSON.stringify(data));
  }, [data]);

  const update = (key, value) => {
    setData(old => ({ ...old, [key]: value }));
  };

  const logActivity = (message) => {
    setData(old => ({
      ...old,
      activity: [
        {
          id: Date.now(),
          message,
          by: user,
          time: new Date().toLocaleString()
        },
        ...old.activity
      ]
    }));
  };

  // LOGIN
  function login(e) {
    e.preventDefault();
    if (!user.trim()) return;

    localStorage.setItem("nx_user", user);
    localStorage.setItem("nx_role", role);
    localStorage.setItem("nx_login", "true");
    setLogged(true);
  }

  // LOGOUT
  function logout() {
    localStorage.removeItem("nx_login");
    setLogged(false);
    setPage("Dashboard");
  }

  // CREATE WORKSPACE
  function createWorkspace(e) {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    const workspace = {
      id: Date.now(),
      name: workspaceName,
      createdBy: user,
      createdAt: new Date().toLocaleDateString()
    };

    setData(old => ({
      ...old,
      workspace,
      members: [{
        id: Date.now(),
        name: user,
        email: "",
        role,
        status: "Online"
      }]
    }));

    setWorkspaceName("");
  }

  // INVITE MEMBER THROUGH BREVO
  async function inviteMember(e) {
    e.preventDefault();

    if (!memberName.trim() || !memberEmail.trim()) {
      alert("Please enter member name and email.");
      return;
    }

    const normalizedEmail = memberEmail.trim().toLowerCase();

    if (data.members.some(
      m => m.email &&
      m.email.toLowerCase() === normalizedEmail
    )) {
      alert("This email is already in the workspace.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            workspaceId: String(data.workspace.id),
            workspaceName: data.workspace.name,
            name: memberName.trim(),
            email: normalizedEmail,
            role: memberRole,
            invitedBy: user
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to send invitation.");
      }

      setData(old => ({
        ...old,
        notifications: [
          {
            id: Date.now(),
            text: `Invitation sent to ${normalizedEmail}.`,
            read: false
          },
          ...old.notifications
        ],
        activity: [
          {
            id: Date.now() + 1,
            message: `Sent an invitation to ${normalizedEmail}`,
            by: user,
            time: new Date().toLocaleString()
          },
          ...old.activity
        ]
      }));

      alert("Invitation email sent successfully!");

      setMemberName("");
      setMemberEmail("");
      setMemberRole("Team Member");
      setModal("");

    } catch (error) {
      console.error("Invitation error:", error);
      alert(error.message);
    }
  }

  // REMOVE MEMBER FROM POSTGRESQL
  async function removeMember(member) {
    if (!member.email) {
      alert("The workspace owner cannot be removed.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${member.name} from this workspace?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/members`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          workspaceId: String(data.workspace.id),
          email: member.email
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to remove member.");
      }

      setData(old => ({
        ...old,
        members: old.members.filter(m =>
          m.email?.toLowerCase() !== member.email.toLowerCase()
        ),
        activity: [
          {
            id: Date.now(),
            message: `Removed ${member.name} from the workspace`,
            by: user,
            time: new Date().toLocaleString()
          },
          ...old.activity
        ]
      }));

      alert(`${member.name} has been removed successfully.`);

    } catch (error) {
      console.error("Remove member error:", error);
      alert(error.message);
    }
  }

  // CREATE PROJECT
  function createProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;

    const project = {
      id: Date.now(),
      name: projectName,
      description: projectDescription,
      progress: 0,
      status: "Active",
      createdBy: user
    };

    update("projects", [project, ...data.projects]);
    logActivity(`Created project ${projectName}`);

    setProjectName("");
    setProjectDescription("");
    setModal("");
  }

  // CREATE TASK
  function createTask(e) {
    e.preventDefault();

    if (!taskName.trim() || !taskProject || !taskAssignee) return;

    const task = {
      id: Date.now(),
      title: taskName,
      project: taskProject,
      assignee: taskAssignee,
      priority: taskPriority,
      due: taskDue,
      status: "Created"
    };

    update("tasks", [task, ...data.tasks]);

    update("notifications", [
      {
        id: Date.now(),
        text: `New task "${taskName}" assigned to ${taskAssignee}.`,
        read: false
      },
      ...data.notifications
    ]);

    logActivity(`Created and assigned task: ${taskName}`);

    setTaskName("");
    setTaskDue("");
    setModal("");
  }

  // CHANGE TASK STATUS
  function changeTask(id, status) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;

    update("tasks", data.tasks.map(t =>
      t.id === id ? { ...t, status } : t
    ));

    logActivity(`Updated "${task.title}" to ${status}`);

    update("notifications", [
      {
        id: Date.now(),
        text: `Task "${task.title}" moved to ${status}.`,
        read: false
      },
      ...data.notifications
    ]);
  }

  // DELETE TASK
  function deleteTask(id) {
    if (!window.confirm("Delete this task?")) return;

    update("tasks", data.tasks.filter(t => t.id !== id));
    logActivity("Deleted a task");
  }

  // DELETE PROJECT
  function deleteProject(id) {
    if (!window.confirm("Delete this project and its tasks?")) return;

    const project = data.projects.find(p => p.id === id);

    update("projects", data.projects.filter(p => p.id !== id));
    update("tasks", data.tasks.filter(t => t.project !== project?.name));

    logActivity(`Deleted project ${project?.name}`);
  }

  // SEND MESSAGE
  function sendMessage(e) {
    e.preventDefault();
    if (!chatText.trim()) return;

    update("messages", [
      ...data.messages,
      {
        id: Date.now(),
        user,
        text: chatText,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      }
    ]);

    logActivity("Sent a workspace message");
    setChatText("");
  }

  // MARK NOTIFICATION READ
  function markRead(id) {
    update("notifications", data.notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  }

  const completed = data.tasks.filter(
    t => t.status === "Completed"
  ).length;

  const progress = data.tasks.length
    ? Math.round(completed / data.tasks.length * 100)
    : 0;

  const filteredTasks = data.tasks.filter(t =>
    `${t.title} ${t.project} ${t.assignee}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Projects", FolderKanban],
    ["Tasks", CheckSquare],
    ["Team", Users],
    ["Messages", MessageSquare],
    ["Notifications", Bell],
    ["Activity", Activity],
    ["Settings", Settings]
  ];

  const button = (text, action) => (
    <button className="gold-button" onClick={action}>
      <Plus size={16} /> {text}
    </button>
  );

  function heading(title, subtitle, action) {
    return (
      <div className="welcome">
        <div>
          <p className="eyebrow">NEXASYNC WORKSPACE</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
    );
  }

  function stat(title, value, description, Icon) {
    return (
      <div className="stat-card">
        <div className="stat-top">
          {title}
          <Icon size={19} />
        </div>
        <h2>{value}</h2>
        <p>{description}</p>
      </div>
    );
  }

  // TASK TABLE
  function taskList(items) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Assignee</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due date</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map(t => (
              <tr key={t.id}>
                <td className="task-name">{t.title}</td>
                <td>{t.project}</td>
                <td>{t.assignee}</td>
                <td>
                  <span className={`priority ${t.priority.toLowerCase()}`}>
                    {t.priority}
                  </span>
                </td>
                <td>
                  <select
                    className="status-select"
                    value={t.status}
                    onChange={e => changeTask(t.id, e.target.value)}
                  >
                    {[
                      "Created",
                      "Assigned",
                      "In Progress",
                      "Completed",
                      "Cancelled"
                    ].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>{t.due || "Not set"}</td>
                <td>
                  <button
                    className="icon-button danger"
                    onClick={() => deleteTask(t.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan="7">
                  <div className="empty-state">
                    <div className="empty-icon">
                      <CheckSquare size={30} />
                    </div>
                    <h3>No tasks yet</h3>
                    <p>
                      Your workspace is ready. Create your first task
                      and start tracking your team's progress.
                    </p>
                    <button
                      className="gold-button"
                      onClick={() => setModal("task")}
                    >
                      <Plus size={16} /> Create Your First Task
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // DASHBOARD
  function dashboard() {
    return (
      <>
        {heading(
          `Welcome back, ${user} ✦`,
          "Here's what's happening across your workspace today.",
          button("Create Task", () => setModal("task"))
        )}

        <div className="stats-grid">
          {stat("Total Projects", data.projects.length, "Workspace projects", FolderKanban)}
          {stat("Total Tasks", data.tasks.length, "Across all projects", CheckSquare)}
          {stat("Completed Tasks", completed, "Successfully finished", CheckCircle2)}
          {stat("Team Members", data.members.length, "Workspace members", Users)}
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Recent Projects</h3>
                <p>Monitor project progress</p>
              </div>
              <button className="text-button" onClick={() => setPage("Projects")}>
                View all
              </button>
            </div>

            {data.projects.length === 0 ? (
              <p className="muted">
                No projects yet. Create your first project.
              </p>
            ) : (
              data.projects.slice(0, 5).map(p => {
                const related = data.tasks.filter(t => t.project === p.name);
                const done = related.filter(t => t.status === "Completed").length;
                const value = related.length
                  ? Math.round(done / related.length * 100)
                  : 0;

                return (
                  <div className="project-row" key={p.id}>
                    <div className="project-icon"><Briefcase /></div>
                    <div className="project-info">
                      <strong>{p.name}</strong>
                      <span>{related.length} tasks</span>
                      <div className="progress-track">
                        <div style={{
                          width: `${value}%`,
                          background: "#D7B56D"
                        }} />
                      </div>
                    </div>
                    <b>{value}%</b>
                  </div>
                );
              })
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Workspace Progress</h3>
                <p>Overall task completion</p>
              </div>
              <Activity />
            </div>

            <div
              className="progress-circle"
              style={{ "--progress": `${progress}%` }}
            >
              <div>
                <strong>{progress}%</strong>
                <span>Completed</span>
              </div>
            </div>

            <p className="muted">
              {completed} completed out of {data.tasks.length} tasks
            </p>
          </section>
        </div>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Tasks</h3>
              <p>Your latest workspace tasks</p>
            </div>
            <button className="text-button" onClick={() => setPage("Tasks")}>
              View all
            </button>
          </div>

          {taskList(data.tasks.slice(0, 5))}
        </section>
      </>
    );
  }

  // PROJECTS PAGE
  function projectsPage() {
    return (
      <>
        {heading(
          "Projects",
          "Create and manage your team's projects.",
          button("New Project", () => setModal("project"))
        )}

        <div className="project-grid">
          {data.projects.map(p => {
            const related = data.tasks.filter(t => t.project === p.name);
            const done = related.filter(t => t.status === "Completed").length;
            const value = related.length
              ? Math.round(done / related.length * 100)
              : 0;

            return (
              <div className="project-card" key={p.id}>
                <div className="project-card-top">
                  <div className="project-icon"><FolderKanban /></div>
                  <span className="active-badge">{p.status}</span>
                </div>

                <h3>{p.name}</h3>
                <p>{p.description || "Project workspace"}</p>

                <div className="progress-track">
                  <div style={{
                    width: `${value}%`,
                    background: "#D7B56D"
                  }} />
                </div>

                <div className="project-card-bottom">
                  <span>Task completion</span>
                  <strong>{value}%</strong>
                </div>

                <button
                  className="outline-button"
                  onClick={() => setPage("Tasks")}
                >
                  View Tasks
                </button>

                <button
                  className="icon-button danger"
                  onClick={() => deleteProject(p.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        {data.projects.length === 0 && (
          <section className="panel empty-state">
            <div className="empty-icon"><FolderKanban size={30} /></div>
            <h3>Your projects start here</h3>
            <p>
              Create your first project, organize your work
              and bring your team together.
            </p>
            <button
              className="gold-button"
              onClick={() => setModal("project")}
            >
              <Plus size={16} /> Create First Project
            </button>
          </section>
        )}
      </>
    );
  }

  // TEAM PAGE WITH REMOVE MEMBER BUTTON
  function teamPage() {
    return (
      <>
        {heading(
          "Team Members",
          "Manage members and workspace roles.",
          button("Invite Member", () => setModal("member"))
        )}

        <section className="panel">
          <div className="team-grid">
            {data.members.map(m => (
              <div className="team-card" key={m.id}>
                <div className="avatar">
                  {m.name.slice(0, 2).toUpperCase()}
                </div>

                <h3>{m.name}</h3>
                <p>{m.email || "Workspace owner"}</p>

                <span className="active-badge">{m.role}</span>
                <p>{m.status}</p>

                {m.email && (
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => removeMember(m)}
                    title={`Remove ${m.name}`}
                  >
                    <Trash2 size={15} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            ))}

            {data.members.length === 0 && (
              <div className="empty-state">
                <Users size={30} />
                <h3>No team members yet</h3>
                <p>Invite members to your workspace.</p>
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  // MESSAGES PAGE
  function messagesPage() {
    return (
      <>
        {heading(
          "Messages",
          "Communicate with your workspace team.",
          null
        )}

        <section className="panel chat-panel">
          <div className="panel-heading">
            <div>
              <h3>General Channel</h3>
              <p>{data.members.length} workspace members</p>
            </div>
          </div>

          <div className="chat-messages">
            {data.messages.map(m => (
              <div className="chat-message" key={m.id}>
                <div className="avatar small-avatar">
                  {m.user.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="message-meta">
                    <strong>{m.user}</strong>
                    <span>{m.time}</span>
                  </div>
                  <div className="message-bubble">{m.text}</div>
                </div>
              </div>
            ))}

            {data.messages.length === 0 && (
              <p className="muted">
                No messages yet. Start the conversation!
              </p>
            )}
          </div>

          <form className="chat-input" onSubmit={sendMessage}>
            <input
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              placeholder="Write a message..."
            />
            <button className="gold-button">
              <Send size={16} /> Send
            </button>
          </form>
        </section>
      </>
    );
  }

  // NOTIFICATIONS PAGE
  function notificationsPage() {
    return (
      <>
        {heading("Notifications", "Updates from your workspace.", null)}

        <section className="panel">
          {data.notifications.map(n => (
            <div className="list-row" key={n.id}>
              <Bell size={19} />
              <div style={{ flex: 1 }}>
                <strong>{n.text}</strong>
                <p>{n.read ? "Read" : "Unread"}</p>
              </div>

              {!n.read && (
                <button
                  className="outline-button"
                  onClick={() => markRead(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}

          {data.notifications.length === 0 && (
            <p className="muted">You're all caught up!</p>
          )}
        </section>
      </>
    );
  }

  // ACTIVITY PAGE
  function activityPage() {
    return (
      <>
        {heading(
          "Activity History",
          "See what your team has been doing.",
          null
        )}

        <section className="panel">
          {data.activity.map(a => (
            <div className="list-row" key={a.id}>
              <Activity size={19} />
              <div style={{ flex: 1 }}>
                <strong>{a.message}</strong>
                <p>By {a.by} · {a.time}</p>
              </div>
            </div>
          ))}

          {data.activity.length === 0 && (
            <p className="muted">No activity recorded yet.</p>
          )}
        </section>
      </>
    );
  }

  // SETTINGS PAGE
  function settingsPage() {
    return (
      <>
        {heading(
          "Settings",
          "Your workspace and account information.",
          null
        )}

        <section className="panel settings-panel">
          <h3>Workspace Details</h3>
          <p>{data.workspace?.name}</p>
          <p className="muted">
            Created by {data.workspace?.createdBy}
          </p>

          <h3 style={{ marginTop: 25 }}>Your Profile</h3>
          <p>{user}</p>
          <p>{role}</p>

          <button className="outline-button" onClick={logout}>
            Log out
          </button>
        </section>
      </>
    );
  }

  const pageComponents = {
    Dashboard: dashboard,
    Projects: projectsPage,

    Tasks: () => (
      <>
        {heading(
          "Task Management",
          "Assign, track and complete work.",
          button("New Task", () => setModal("task"))
        )}

        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
          />
        </div>

        <section className="panel">
          {taskList(filteredTasks)}
        </section>
      </>
    ),

    Team: teamPage,
    Messages: messagesPage,
    Notifications: notificationsPage,
    Activity: activityPage,
    Settings: settingsPage
  };

  // LOGIN SCREEN
  if (!logged) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={login}>
          <div className="brand-mark">N</div>
          <h1>NexaSync<span>.</span></h1>
          <p className="muted">One workspace. One connected team.</p>

          <label>Your name</label>
          <input
            value={user}
            onChange={e => setUser(e.target.value)}
            placeholder="Enter your name"
            required
          />

          <label>Your role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
          >
            <option>Project Manager</option>
            <option>Team Member</option>
            <option>Administrator</option>
          </select>

          <button className="gold-button full-button">
            Continue <ArrowRight size={16} />
          </button>

          <p className="login-note">
            NEXASYNC COLLABORATION PLATFORM
          </p>
        </form>
      </div>
    );
  }

  // CREATE WORKSPACE SCREEN
  if (!data.workspace) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={createWorkspace}>
          <div className="brand-mark">N</div>
          <h1>Create Workspace</h1>
          <p className="muted">
            Start by creating a shared space for your team.
          </p>

          <label>Workspace name</label>
          <input
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            placeholder="e.g. Software Project Team"
            required
          />

          <button className="gold-button full-button">
            Create Workspace <ArrowRight size={16} />
          </button>
        </form>
      </div>
    );
  }

  const Page = pageComponents[page] || dashboard;

  // MAIN APPLICATION
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NexaSync<span>.</span></strong>
            <small>COLLABORATION HUB</small>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <div className="workspace-choice">
          <div className="workspace-icon">N</div>
          <div>
            <strong>{data.workspace.name}</strong>
            <small>{data.members.length} members</small>
          </div>
        </div>

        <div className="nav-label">MENU</div>

        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "selected" : ""}`}
              onClick={() => {
                setPage(name);
                setMenu(false);
              }}
            >
              <Icon size={18} />
              <span>{name}</span>

              {name === "Notifications" &&
                data.notifications.some(n => !n.read) && (
                  <i className="notification-dot" />
                )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-profile">
            <div className="avatar">
              {user.slice(0, 2).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{user}</strong>
              <small>{role}</small>
            </div>

            <button className="icon-button" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span><strong>{page}</strong>
          </div>

          <div className="topbar-right">
            <div className="online-indicator">
              ● Workspace active
            </div>

            <button
              className="icon-button"
              onClick={() => setPage("Notifications")}
            >
              <Bell />
            </button>

            <div className="avatar">
              {user.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="page-content">
          <Page />
        </div>

        <footer>
          NexaSync © 2026 · Connected teams, better work.
        </footer>
      </main>

      {/* MODALS */}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => setModal("")}
        >
          <form
            className="modal"
            onClick={e => e.stopPropagation()}
            onSubmit={
              modal === "task"
                ? createTask
                : modal === "project"
                ? createProject
                : inviteMember
            }
          >
            <div className="modal-heading">
              <div>
                <h3>
                  {modal === "task"
                    ? "Create Task"
                    : modal === "project"
                    ? "Create Project"
                    : "Invite Team Member"}
                </h3>
                <p>Enter the details below.</p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setModal("")}
              >
                <X />
              </button>
            </div>

            {modal === "project" && (
              <>
                <label>Project name</label>
                <input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  required
                  placeholder="Enter project name"
                />

                <label>Description</label>
                <input
                  value={projectDescription}
                  onChange={e => setProjectDescription(e.target.value)}
                  placeholder="Project description"
                />
              </>
            )}

            {modal === "member" && (
              <>
                <label>Member name</label>
                <input
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  required
                  placeholder="Enter full name"
                />

                <label>Email address</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  required
                  placeholder="Enter email"
                />

                <label>Role</label>
                <select
                  value={memberRole}
                  onChange={e => setMemberRole(e.target.value)}
                >
                  <option>Team Member</option>
                  <option>Project Manager</option>
                  <option>Administrator</option>
                </select>
              </>
            )}

            {modal === "task" && (
              <>
                <label>Task title</label>
                <input
                  value={taskName}
                  onChange={e => setTaskName(e.target.value)}
                  required
                  placeholder="What needs to be done?"
                />

                <label>Project</label>
                <select
                  value={taskProject}
                  onChange={e => setTaskProject(e.target.value)}
                  required
                >
                  <option value="">Select project</option>
                  {data.projects.map(p => (
                    <option key={p.id}>{p.name}</option>
                  ))}
                </select>

                <label>Assign to</label>
                <select
                  value={taskAssignee}
                  onChange={e => setTaskAssignee(e.target.value)}
                  required
                >
                  <option value="">Select team member</option>
                  {data.members.map(m => (
                    <option key={m.id}>{m.name}</option>
                  ))}
                </select>

                <label>Priority</label>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>

                <label>Due date</label>
                <input
                  type="date"
                  value={taskDue}
                  onChange={e => setTaskDue(e.target.value)}
                />
              </>
            )}

            <button
              className="gold-button full-button"
              type="submit"
            >
              Save and Continue
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
