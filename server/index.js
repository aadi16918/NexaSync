
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// =====================================
// ENVIRONMENT CONFIGURATION
// =====================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env")
});

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================
// CORS CONFIGURATION
// =====================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json());

// =====================================
// POSTGRESQL CONFIGURATION
// =====================================

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

// =====================================
// BREVO SMTP CONFIGURATION
// =====================================

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },

  tls: {
    minVersion: "TLSv1.2"
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000
});

// IMPORTANT:
// Do not set rejectUnauthorized: false.
// Keep SSL certificate verification enabled.

// =====================================
// HTML ESCAPE FUNCTION
// =====================================

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// =====================================
// HEALTH CHECK API
// =====================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "NexaSync backend is running"
  });
});

// =====================================
// DATABASE CHECK API
// =====================================

app.get("/api/db-check", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database"
    );

    res.json({
      success: true,
      message: "PostgreSQL connected successfully",
      database: result.rows[0].database
    });

  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// =====================================
// EMAIL CHECK API
// =====================================

app.get("/api/email-check", async (req, res) => {
  try {
    const required = [
      "EMAIL_HOST",
      "EMAIL_USER",
      "EMAIL_PASS",
      "EMAIL_FROM"
    ];

    const missing = required.filter(
      key => !process.env[key]
    );

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing email configuration",
        missing
      });
    }

    await transporter.verify();

    res.json({
      success: true,
      message: "Brevo SMTP connected successfully"
    });

  } catch (error) {
    console.error("SMTP error:", error);

    res.status(500).json({
      success: false,
      message: "SMTP connection failed",
      error: error.message
    });
  }
});

// =====================================
// SEND TEAM INVITATION API
// =====================================

app.post("/api/invitations", async (req, res) => {

  const {
    workspaceId,
    workspaceName,
    name,
    email,
    role,
    invitedBy
  } = req.body;

  try {

    // Validate required fields

    if (
      !workspaceId ||
      !workspaceName?.trim() ||
      !name?.trim() ||
      !email?.trim() ||
      !invitedBy?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required details."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address."
      });
    }

    // Validate role

    const allowedRoles = [
      "Team Member",
      "Project Manager",
      "Administrator"
    ];

    const selectedRole = role || "Team Member";

    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member role."
      });
    }

    // Check existing pending invitation

    const existingInvitation = await pool.query(
      `SELECT id
       FROM public.invitations
       WHERE workspace_id = $1
       AND LOWER(email) = $2
       AND status = 'pending'
       AND expires_at > NOW()`,
      [String(workspaceId), normalizedEmail]
    );

    if (existingInvitation.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An invitation is already pending for this email."
      });
    }

    // Check existing member

    const existingMember = await pool.query(
      `SELECT id
       FROM public.workspace_members
       WHERE workspace_id = $1
       AND LOWER(email) = $2`,
      [String(workspaceId), normalizedEmail]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This person is already a workspace member."
      });
    }

    // Generate secure invitation token

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Invitation expires after 48 hours

    const expiresAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    );

    // Generate invitation link

    const clientUrl = (
      process.env.CLIENT_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    const invitationLink =
      `${clientUrl}/?invite=${encodeURIComponent(token)}`;

    // Save invitation in PostgreSQL

    await pool.query(
      `INSERT INTO public.invitations
       (
         workspace_id,
         workspace_name,
         name,
         email,
         role,
         invited_by,
         token_hash,
         status,
         expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
      [
        String(workspaceId),
        workspaceName.trim(),
        name.trim(),
        normalizedEmail,
        selectedRole,
        invitedBy.trim(),
        tokenHash,
        expiresAt
      ]
    );

    // Send invitation email

    try {

      const mailInfo = await transporter.sendMail({

        from: `"NexaSync" <${process.env.EMAIL_FROM}>`,

        to: normalizedEmail,

        subject: `You're invited to join ${workspaceName} on NexaSync`,

        text: `Hello ${name},

${invitedBy} has invited you to join ${workspaceName} on NexaSync.

Your assigned role: ${selectedRole}

Accept your invitation using this link:

${invitationLink}

This invitation expires in 48 hours.

NexaSync Team`,

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:600px;
            margin:auto;
            padding:30px;
            color:#18243a;
            border:1px solid #e5e5e5;
            border-radius:10px;
          ">

            <h1 style="color:#18243a;">
              NexaSync<span style="color:#D7B56D;">.</span>
            </h1>

            <h2>You're invited!</h2>

            <p>Hello ${escapeHtml(name)},</p>

            <p>
              <strong>${escapeHtml(invitedBy)}</strong>
              has invited you to join
              <strong>${escapeHtml(workspaceName)}</strong>
              on NexaSync.
            </p>

            <p>
              Your assigned role:
              <strong>${escapeHtml(selectedRole)}</strong>
            </p>

            <a
              href="${escapeHtml(invitationLink)}"
              style="
                display:inline-block;
                background:#D7B56D;
                color:#18243a;
                padding:14px 25px;
                text-decoration:none;
                border-radius:6px;
                font-weight:bold;
              "
            >
              Accept Invitation
            </a>

            <p style="margin-top:25px;">
              This invitation expires in 48 hours.
            </p>

            <p>
              If you weren't expecting this invitation,
              you can safely ignore this email.
            </p>

            <hr>

            <p style="font-size:12px;color:#777;">
              NexaSync Team Collaboration Platform
            </p>

          </div>
        `
      });

      console.log(
        "Invitation email sent:",
        mailInfo.messageId
      );

    } catch (mailError) {

      // Remove pending invitation if email fails

      await pool.query(
        `DELETE FROM public.invitations
         WHERE token_hash = $1`,
        [tokenHash]
      );

      throw mailError;
    }

    return res.status(201).json({
      success: true,
      message: "Invitation email sent successfully.",
      email: normalizedEmail,
      role: selectedRole
    });

  } catch (error) {

    console.error("Invitation error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to send invitation."
    });
  }
});

// =====================================
// DELETE / REMOVE TEAM MEMBER API
// =====================================

app.delete("/api/members", async (req, res) => {

  const { workspaceId, email } = req.body;

  if (!workspaceId || !email?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Workspace ID and email are required."
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  let client;

  try {

    client = await pool.connect();

    await client.query("BEGIN");

    // Remove active workspace member

    const memberResult = await client.query(
      `DELETE FROM public.workspace_members
       WHERE workspace_id = $1
       AND LOWER(email) = $2
       RETURNING id`,
      [String(workspaceId), normalizedEmail]
    );

    // Revoke pending invitation

    const invitationResult = await client.query(
      `UPDATE public.invitations
       SET status = 'revoked'
       WHERE workspace_id = $1
       AND LOWER(email) = $2
       AND status = 'pending'
       RETURNING id`,
      [String(workspaceId), normalizedEmail]
    );

    if (
      memberResult.rowCount === 0 &&
      invitationResult.rowCount === 0
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Member or invitation not found."
      });
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Member removed successfully.",
      removedMembers: memberResult.rowCount,
      revokedInvitations: invitationResult.rowCount
    });

  } catch (error) {

    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Delete member error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove member."
    });

  } finally {

    if (client) {
      client.release();
    }
  }
});

// =====================================
// SERVER START
// =====================================

app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("NexaSync Backend Started");
  console.log(`Server running on port ${PORT}`);
  console.log("--------------------------------");
});
