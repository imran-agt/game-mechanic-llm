const path = require("path");
const fs = require("fs");

// Helper to determine base path for compiled executable or development
const getBasePath = () => {
  // Check if running as Bun compiled executable
  const isCompiledExe = process.execPath.toLowerCase().includes('gamemechanic-collector.exe');
  const isMalformedPath = process.platform === 'win32' &&
                         __dirname.startsWith('\\') &&
                         !__dirname.match(/^[A-Z]:\\/i);

  if (isCompiledExe || isMalformedPath || !fs.existsSync(__dirname)) {
    const exeDir = path.dirname(process.execPath);
    return exeDir;
  }
  return __dirname;
};

const basePath = getBasePath();

// Load environment variables from the correct location
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
} else {
  const envPath = path.join(basePath, '.env');
  require("dotenv").config({ path: envPath });
}

require("./utils/logger")();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { ACCEPTED_MIMES, WATCH_DIRECTORY } = require("./utils/constants");
const { reqBody } = require("./utils/http");
const { processSingleFile } = require("./processSingleFile");
const { processLink, getLinkText } = require("./processLink");
const { wipeCollectorStorage } = require("./utils/files");
const extensions = require("./extensions");
const { processRawText } = require("./processRawText");
const { verifyPayloadIntegrity } = require("./middleware/verifyIntegrity");
const { httpLogger } = require("./middleware/httpLogger");
const app = express();
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
app.use(
  bodyParser.text({ limit: FILE_LIMIT }),
  bodyParser.json({ limit: FILE_LIMIT }),
  bodyParser.urlencoded({
    limit: FILE_LIMIT,
    extended: true,
  })
);

app.post(
  "/process",
  [verifyPayloadIntegrity],
  async function (request, response) {
    const { filename, options = {}, metadata = {} } = reqBody(request);
    try {
      const targetFilename = path
        .normalize(filename)
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const {
        success,
        reason,
        documents = [],
      } = await processSingleFile(targetFilename, options, metadata);
      response
        .status(200)
        .json({ filename: targetFilename, success, reason, documents });
    } catch (e) {
      console.error(`[Collector] Error processing file "${filename}":`, e);
      response.status(200).json({
        filename: filename,
        success: false,
        reason: `A processing error occurred: ${e.message}`,
        documents: [],
      });
    }
    return;
  }
);

app.post(
  "/parse",
  [verifyPayloadIntegrity],
  async function (request, response) {
    const { filename, options = {} } = reqBody(request);
    try {
      const targetFilename = path
        .normalize(filename)
        .replace(/^(\.\.(\/|\\|$))+/, "");
      const {
        success,
        reason,
        documents = [],
      } = await processSingleFile(targetFilename, {
        ...options,
        parseOnly: true,
      });
      response
        .status(200)
        .json({ filename: targetFilename, success, reason, documents });
    } catch (e) {
      console.error(`[Collector] Error parsing file "${filename}":`, e);
      response.status(200).json({
        filename: filename,
        success: false,
        reason: `A parsing error occurred: ${e.message}`,
        documents: [],
      });
    }
    return;
  }
);

app.post(
  "/process-link",
  [verifyPayloadIntegrity],
  async function (request, response) {
    const { link, scraperHeaders = {}, metadata = {} } = reqBody(request);
    try {
      const {
        success,
        reason,
        documents = [],
      } = await processLink(link, scraperHeaders, metadata);
      response.status(200).json({ url: link, success, reason, documents });
    } catch (e) {
      console.error(`[Collector] Error processing link "${link}":`, e);
      response.status(200).json({
        url: link,
        success: false,
        reason: `A link processing error occurred: ${e.message}`,
        documents: [],
      });
    }
    return;
  }
);

app.post(
  "/util/get-link",
  [verifyPayloadIntegrity],
  async function (request, response) {
    const { link, captureAs = "text" } = reqBody(request);
    try {
      const { success, content = null } = await getLinkText(link, captureAs);
      response.status(200).json({ url: link, success, content });
    } catch (e) {
      console.error(e);
      response.status(200).json({
        url: link,
        success: false,
        content: null,
      });
    }
    return;
  }
);

app.post(
  "/process-raw-text",
  [verifyPayloadIntegrity],
  async function (request, response) {
    const { textContent, metadata } = reqBody(request);
    try {
      const {
        success,
        reason,
        documents = [],
      } = await processRawText(textContent, metadata);
      response
        .status(200)
        .json({ filename: metadata.title, success, reason, documents });
    } catch (e) {
      console.error(`[Collector] Error processing raw text "${metadata?.title}":`, e);
      response.status(200).json({
        filename: metadata?.title || "Unknown-doc.txt",
        success: false,
        reason: `A raw text processing error occurred: ${e.message}`,
        documents: [],
      });
    }
    return;
  }
);

extensions(app);

app.get("/accepts", function (_, response) {
  response.status(200).json(ACCEPTED_MIMES);
});

app.all("*", function (_, response) {
  response.sendStatus(200);
});

const PORT = process.env.COLLECTOR_PORT || 8888;
app
  .listen(PORT, async () => {
    await wipeCollectorStorage();
    console.log(`[Collector] Document processor app listening on port ${PORT}`);
    console.log(`[Collector] Using hotdir from constants: ${WATCH_DIRECTORY}`);
  })
  .on("error", function (_) {
    process.once("SIGUSR2", function () {
      process.kill(process.pid, "SIGUSR2");
    });
    process.on("SIGINT", function () {
      process.kill(process.pid, "SIGINT");
    });
  });
