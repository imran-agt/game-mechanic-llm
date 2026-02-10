const path = require("path");
const fs = require("fs");

// Helper to determine base path for compiled executable or development
const getBasePath = () => {
  // Check if running as Bun compiled executable
  // The most reliable way is to check if process.execPath points to our .exe file
  const isCompiledExe = process.execPath.toLowerCase().includes('gamemechanic-server.exe');

  // Also check for malformed __dirname (Bun compiled on Windows)
  const isMalformedPath = process.platform === 'win32' &&
                         __dirname.startsWith('\\') &&
                         !__dirname.match(/^[A-Z]:\\/i);

  if (isCompiledExe || isMalformedPath || !fs.existsSync(__dirname)) {
    // Use the directory containing the executable
    const execDir = path.dirname(process.execPath);
    console.log(`[Config] Running as compiled executable from: ${execDir}`);
    return execDir;
  }

  // Normal execution - use __dirname
  console.log(`[Config] Running in development mode from: ${__dirname}`);
  return __dirname;
};

const basePath = getBasePath();
const isCompiled = basePath !== __dirname;

// CRITICAL: Set NODE_ENV for compiled executables BEFORE loading .env
// This prevents .env from overriding it (dotenv.config() doesn't override existing vars by default)
if (isCompiled) {
  process.env.NODE_ENV = 'production';
  console.log('[Config] Pre-set NODE_ENV to production for compiled executable');
}

// Load environment variables from the correct location
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(basePath, `.env.${process.env.NODE_ENV}`) });
} else {
  const envPath = path.join(basePath, '.env');
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }
}

// Verify NODE_ENV is still production for compiled executables
if (isCompiled && process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'production';
}

// Fix DATABASE_URL if it's a relative path
// Prisma resolves relative paths from its client location, not from cwd
// So we need to convert relative paths to absolute paths
if (process.env.DATABASE_URL) {
  const dbUrl = process.env.DATABASE_URL;

  // Check if it's a SQLite file URL with relative path
  if (dbUrl.startsWith('file:./') || dbUrl.startsWith('file:../')) {
    // Extract the relative path
    const relativePath = dbUrl.substring(5); // Remove 'file:'

    // Convert to absolute path based on basePath
    const absolutePath = path.resolve(basePath, relativePath);

    // Update the DATABASE_URL with absolute path
    process.env.DATABASE_URL = `file:${absolutePath}`;

    console.log(`[Config] Converted relative DATABASE_URL to absolute path`);
    console.log(`[Config] Database location: ${absolutePath}`);

    // Ensure the directory exists
    const dbDir = path.dirname(absolutePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`[Config] Created database directory: ${dbDir}`);
    }
  } else if (dbUrl.startsWith('file:')) {
    // Already absolute or using special syntax
    console.log(`[Config] Using DATABASE_URL: ${dbUrl}`);
  }
}

require("./utils/logger")();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { reqBody } = require("./utils/http");
const { systemEndpoints } = require("./endpoints/system");
const { workspaceEndpoints } = require("./endpoints/workspaces");
const { chatEndpoints } = require("./endpoints/chat");
const { embeddedEndpoints } = require("./endpoints/embed");
const { embedManagementEndpoints } = require("./endpoints/embedManagement");
const { getVectorDbClass } = require("./utils/helpers");
const { adminEndpoints } = require("./endpoints/admin");
const { inviteEndpoints } = require("./endpoints/invite");
const { utilEndpoints } = require("./endpoints/utils");
const { developerEndpoints } = require("./endpoints/api");
const { extensionEndpoints } = require("./endpoints/extensions");
const { bootHTTP, bootSSL } = require("./utils/boot");
const { workspaceThreadEndpoints } = require("./endpoints/workspaceThreads");
const { documentEndpoints } = require("./endpoints/document");
const { agentWebsocket } = require("./endpoints/agentWebsocket");
const { experimentalEndpoints } = require("./endpoints/experimental");
const { browserExtensionEndpoints } = require("./endpoints/browserExtension");
const { communityHubEndpoints } = require("./endpoints/communityHub");
const { agentFlowEndpoints } = require("./endpoints/agentFlows");
const { mcpServersEndpoints } = require("./endpoints/mcpServers");
const { mobileEndpoints } = require("./endpoints/mobile");
const { httpLogger } = require("./middleware/httpLogger");
const app = express();
const apiRouter = express.Router();
const FILE_LIMIT = "3GB";

// Only log HTTP requests in development mode and if the ENABLE_HTTP_LOGGER environment variable is set to true
if (
  process.env.NODE_ENV === "development" &&
  !!process.env.ENABLE_HTTP_LOGGER
) {
  app.use(
    httpLogger({
      enableTimestamps: !!process.env.ENABLE_HTTP_LOGGER_TIMESTAMPS,
    })
  );
}
app.use(cors({ origin: true }));
app.use(bodyParser.text({ limit: FILE_LIMIT }));
app.use(bodyParser.json({ limit: FILE_LIMIT }));
app.use(
  bodyParser.urlencoded({
    limit: FILE_LIMIT,
    extended: true,
  })
);

if (!!process.env.ENABLE_HTTPS) {
  bootSSL(app, process.env.SERVER_PORT || 3001);
} else {
  require("@mintplex-labs/express-ws").default(app); // load WebSockets in non-SSL mode.
}

app.use("/api", apiRouter);
systemEndpoints(apiRouter);
extensionEndpoints(apiRouter);
workspaceEndpoints(apiRouter);
workspaceThreadEndpoints(apiRouter);
chatEndpoints(apiRouter);
adminEndpoints(apiRouter);
inviteEndpoints(apiRouter);
embedManagementEndpoints(apiRouter);
utilEndpoints(apiRouter);
documentEndpoints(apiRouter);
agentWebsocket(apiRouter);
experimentalEndpoints(apiRouter);
developerEndpoints(app, apiRouter);
communityHubEndpoints(apiRouter);
agentFlowEndpoints(apiRouter);
mcpServersEndpoints(apiRouter);
mobileEndpoints(apiRouter);

// Externally facing embedder endpoints
embeddedEndpoints(apiRouter);

// Externally facing browser extension endpoints
browserExtensionEndpoints(apiRouter);

// FINAL CHECK: Force NODE_ENV to production for compiled executables
// This is the last line of defense before frontend serving decision
if (isCompiled) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Frontend Setup] CRITICAL: NODE_ENV is', process.env.NODE_ENV, 'but should be production for compiled executable!');
  }
  process.env.NODE_ENV = 'production';
  console.log('[Frontend Setup] Final force-set NODE_ENV to production for compiled executable');
}

// Diagnostic logging for frontend serving
console.log('[Frontend Setup] NODE_ENV:', process.env.NODE_ENV);
console.log('[Frontend Setup] isCompiled:', isCompiled);
console.log('[Frontend Setup] basePath:', basePath);
console.log('[Frontend Setup] public directory:', path.resolve(basePath, 'public'));
console.log('[Frontend Setup] Will serve frontend:', isCompiled || process.env.NODE_ENV !== 'development');


// Serve frontend for compiled executables OR when NODE_ENV is not development
// We check isCompiled first because process.env may be read-only in Bun compiled executables
if (isCompiled || process.env.NODE_ENV !== "development") {
  const { MetaGenerator } = require("./utils/boot/MetaGenerator");
  const IndexPage = new MetaGenerator();
  console.log('[Frontend Setup] MetaGenerator initialized - frontend will be served');
  console.log('[Frontend Setup] Static files path:', path.resolve(basePath, 'public'));


  app.use(
    express.static(path.resolve(basePath, "public"), {
      extensions: ["js"],
      setHeaders: (res) => {
        // Disable I-framing of entire site UI
        res.removeHeader("X-Powered-By");
        res.setHeader("X-Frame-Options", "DENY");
      },
    })
  );

  app.use("/", function (_, response) {
    IndexPage.generate(response);
    return;
  });

  app.get("/robots.txt", function (_, response) {
    response.type("text/plain");
    response.send("User-agent: *\nDisallow: /").end();
  });
} else {
  // Debug route for development connections to vectorDBs
  apiRouter.post("/v/:command", async (request, response) => {
    try {
      const VectorDb = getVectorDbClass();
      const { command } = request.params;
      if (!Object.getOwnPropertyNames(VectorDb).includes(command)) {
        response.status(500).json({
          message: "invalid interface command",
          commands: Object.getOwnPropertyNames(VectorDb),
        });
        return;
      }

      try {
        const body = reqBody(request);
        const resBody = await VectorDb[command](body);
        response.status(200).json({ ...resBody });
      } catch (e) {
        // console.error(e)
        console.error(JSON.stringify(e));
        response.status(500).json({ error: e.message });
      }
      return;
    } catch (e) {
      console.error(e.message, e);
      response.sendStatus(500).end();
    }
  });
}

app.all("*", function (_, response) {
  response.sendStatus(404);
});

// In non-https mode we need to boot at the end since the server has not yet
// started and is `.listen`ing.
// Only start the server if this is the main entry point AND not running as a background worker
// Background workers set IS_WORKER_PROCESS to prevent starting the HTTP server
const shouldStartServer =
  require.main === module &&
  !process.env.IS_WORKER_PROCESS &&
  !process.send; // process.send is defined in child processes spawned by Node/Bun

if (shouldStartServer) {
  console.log('[Server] Starting HTTP server on port', process.env.SERVER_PORT || 3001);
  if (!process.env.ENABLE_HTTPS) bootHTTP(app, process.env.SERVER_PORT || 3001);
} else {
  console.log('[Server] Skipping server start (running as worker or child process)');
}
