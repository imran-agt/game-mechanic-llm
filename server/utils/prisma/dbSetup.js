/**
 * Database auto-initialization for compiled executables.
 *
 * Prisma doesn't auto-migrate. When the server starts with a fresh/empty
 * SQLite database, this module detects the missing tables and creates
 * the full schema so the application can function on first run.
 */

// Each statement is executed individually via prisma.$executeRawUnsafe
const SCHEMA_SQL = [
  // ---- Independent tables (no foreign keys) ----
  `CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "secret" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_secret_key" ON "api_keys"("secret")`,

  `CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_label_key" ON "system_settings"("label")`,

  `CREATE TABLE IF NOT EXISTS "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT,
    "password" TEXT NOT NULL,
    "pfpFilename" TEXT,
    "role" TEXT NOT NULL DEFAULT 'default',
    "suspended" INTEGER NOT NULL DEFAULT 0,
    "seen_recovery_codes" BOOLEAN DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dailyMessageLimit" INTEGER,
    "bio" TEXT DEFAULT ''
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username")`,

  `CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vectorTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openAiTemp" REAL,
    "openAiHistory" INTEGER NOT NULL DEFAULT 20,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openAiPrompt" TEXT,
    "similarityThreshold" REAL DEFAULT 0.25,
    "chatProvider" TEXT,
    "chatModel" TEXT,
    "topN" INTEGER DEFAULT 4,
    "chatMode" TEXT DEFAULT 'chat',
    "pfpFilename" TEXT,
    "agentProvider" TEXT,
    "agentModel" TEXT,
    "queryRefusalResponse" TEXT,
    "vectorSearchMode" TEXT DEFAULT 'default'
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_key" ON "workspaces"("slug")`,

  `CREATE TABLE IF NOT EXISTS "invites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimedBy" INTEGER,
    "workspaceIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "invites_code_key" ON "invites"("code")`,

  `CREATE TABLE IF NOT EXISTS "document_vectors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "docId" TEXT NOT NULL,
    "vectorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "welcome_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "cache_data" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "belongsTo" TEXT,
    "byId" INTEGER,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "event_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event" TEXT NOT NULL,
    "metadata" TEXT,
    "userId" INTEGER,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "event_logs_event_idx" ON "event_logs"("event")`,

  // ---- Tables with foreign keys to users/workspaces ----
  `CREATE TABLE IF NOT EXISTS "workspace_documents" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "docId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "docpath" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "metadata" TEXT,
    "pinned" BOOLEAN DEFAULT false,
    "watched" BOOLEAN DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_documents_docId_key" ON "workspace_documents"("docId")`,

  `CREATE TABLE IF NOT EXISTS "workspace_threads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_threads_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_threads_slug_key" ON "workspace_threads"("slug")`,
  `CREATE INDEX IF NOT EXISTS "workspace_threads_workspace_id_idx" ON "workspace_threads"("workspace_id")`,
  `CREATE INDEX IF NOT EXISTS "workspace_threads_user_id_idx" ON "workspace_threads"("user_id")`,

  `CREATE TABLE IF NOT EXISTS "workspace_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "workspace_id" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "workspace_chats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "include" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "thread_id" INTEGER,
    "api_session_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackScore" BOOLEAN,
    CONSTRAINT "workspace_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "workspace_suggested_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_suggested_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "workspace_suggested_messages_workspaceId_idx" ON "workspace_suggested_messages"("workspaceId")`,

  `CREATE TABLE IF NOT EXISTS "workspace_agent_invocations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER,
    "thread_id" INTEGER,
    "workspace_id" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_agent_invocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_agent_invocations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_agent_invocations_uuid_key" ON "workspace_agent_invocations"("uuid")`,
  `CREATE INDEX IF NOT EXISTS "workspace_agent_invocations_uuid_idx" ON "workspace_agent_invocations"("uuid")`,

  `CREATE TABLE IF NOT EXISTS "embed_configs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "chat_mode" TEXT NOT NULL DEFAULT 'query',
    "allowlist_domains" TEXT,
    "allow_model_override" BOOLEAN NOT NULL DEFAULT false,
    "allow_temperature_override" BOOLEAN NOT NULL DEFAULT false,
    "allow_prompt_override" BOOLEAN NOT NULL DEFAULT false,
    "max_chats_per_day" INTEGER,
    "max_chats_per_session" INTEGER,
    "message_limit" INTEGER DEFAULT 20,
    "workspace_id" INTEGER NOT NULL,
    "createdBy" INTEGER,
    "usersId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "embed_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "embed_configs_usersId_fkey" FOREIGN KEY ("usersId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "embed_configs_uuid_key" ON "embed_configs"("uuid")`,

  `CREATE TABLE IF NOT EXISTS "embed_chats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "include" BOOLEAN NOT NULL DEFAULT true,
    "connection_information" TEXT,
    "embed_id" INTEGER NOT NULL,
    "usersId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "embed_chats_embed_id_fkey" FOREIGN KEY ("embed_id") REFERENCES "embed_configs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "embed_chats_usersId_fkey" FOREIGN KEY ("usersId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "recovery_codes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "code_hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "recovery_codes_user_id_idx" ON "recovery_codes"("user_id")`,

  `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token")`,
  `CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id")`,

  `CREATE TABLE IF NOT EXISTS "slash_command_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "command" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "uid" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "slash_command_presets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "slash_command_presets_uid_command_key" ON "slash_command_presets"("uid", "command")`,

  `CREATE TABLE IF NOT EXISTS "document_sync_queues" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staleAfterMs" INTEGER NOT NULL DEFAULT 604800000,
    "nextSyncAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceDocId" INTEGER NOT NULL,
    CONSTRAINT "document_sync_queues_workspaceDocId_fkey" FOREIGN KEY ("workspaceDocId") REFERENCES "workspace_documents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "document_sync_queues_workspaceDocId_key" ON "document_sync_queues"("workspaceDocId")`,

  `CREATE TABLE IF NOT EXISTS "document_sync_executions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "queueId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_sync_executions_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "document_sync_queues" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "browser_extension_api_keys" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "user_id" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "browser_extension_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "browser_extension_api_keys_key_key" ON "browser_extension_api_keys"("key")`,
  `CREATE INDEX IF NOT EXISTS "browser_extension_api_keys_user_id_idx" ON "browser_extension_api_keys"("user_id")`,

  `CREATE TABLE IF NOT EXISTS "temporary_auth_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "temporary_auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "temporary_auth_tokens_token_key" ON "temporary_auth_tokens"("token")`,
  `CREATE INDEX IF NOT EXISTS "temporary_auth_tokens_token_idx" ON "temporary_auth_tokens"("token")`,
  `CREATE INDEX IF NOT EXISTS "temporary_auth_tokens_userId_idx" ON "temporary_auth_tokens"("userId")`,

  `CREATE TABLE IF NOT EXISTS "system_prompt_variables" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'system',
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_prompt_variables_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "system_prompt_variables_key_key" ON "system_prompt_variables"("key")`,
  `CREATE INDEX IF NOT EXISTS "system_prompt_variables_userId_idx" ON "system_prompt_variables"("userId")`,

  `CREATE TABLE IF NOT EXISTS "prompt_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "modifiedBy" INTEGER,
    "modifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_history_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_history_modifiedBy_fkey" FOREIGN KEY ("modifiedBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "prompt_history_workspaceId_idx" ON "prompt_history"("workspaceId")`,

  `CREATE TABLE IF NOT EXISTS "desktop_mobile_devices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceOs" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "desktop_mobile_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "desktop_mobile_devices_token_key" ON "desktop_mobile_devices"("token")`,
  `CREATE INDEX IF NOT EXISTS "desktop_mobile_devices_userId_idx" ON "desktop_mobile_devices"("userId")`,

  `CREATE TABLE IF NOT EXISTS "workspace_parsed_files" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER,
    "threadId" INTEGER,
    "metadata" TEXT,
    "tokenCountEstimate" INTEGER DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_parsed_files_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_parsed_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workspace_parsed_files_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "workspace_threads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "workspace_parsed_files_filename_key" ON "workspace_parsed_files"("filename")`,
  `CREATE INDEX IF NOT EXISTS "workspace_parsed_files_workspaceId_idx" ON "workspace_parsed_files"("workspaceId")`,
  `CREATE INDEX IF NOT EXISTS "workspace_parsed_files_userId_idx" ON "workspace_parsed_files"("userId")`,

  // ---- Prisma migration tracking table ----
  // Mark schema as initialized so prisma migrate won't try to re-apply
  `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "finished_at" DATETIME,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" DATETIME,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )`,
];

// Default seed data for first run
const SEED_SQL = [
  `INSERT OR IGNORE INTO "system_settings" ("label", "value") VALUES ('multi_user_mode', 'false')`,
  `INSERT OR IGNORE INTO "system_settings" ("label", "value") VALUES ('logo_filename', 'anything-llm.png')`,
];

/**
 * Check if the database schema exists and create it if missing.
 * Called once at server startup before any API requests.
 */
async function ensureDatabaseSetup(prisma) {
  try {
    // Quick check: if system_settings exists, the DB is already initialized
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "system_settings" LIMIT 1`);
    console.log("[DB Setup] Database schema already exists");
    return;
  } catch (_) {
    // Table doesn't exist — need to initialize
    console.log("[DB Setup] Database schema not found, initializing...");
  }

  try {
    // Create all tables
    for (const sql of SCHEMA_SQL) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log(`[DB Setup] Created ${SCHEMA_SQL.length} schema objects`);

    // Seed default data
    for (const sql of SEED_SQL) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log("[DB Setup] Seeded default system settings");

    console.log("[DB Setup] Database initialization complete");
  } catch (error) {
    console.error("[DB Setup] Failed to initialize database:", error.message);
    throw error;
  }
}

module.exports = { ensureDatabaseSetup };
