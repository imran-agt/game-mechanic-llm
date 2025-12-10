const path = require("path");
const fs = require("fs");

// Helper to determine base path for compiled executable or development
const getBasePath = () => {
  // Check if running as Bun compiled executable
  const isCompiledExe = process.execPath.toLowerCase().includes('gamemechanic-collector.exe');

  // Also check for malformed __dirname (Bun compiled on Windows)
  const isMalformedPath = process.platform === 'win32' &&
                         __dirname.startsWith('\\') &&
                         !__dirname.match(/^[A-Z]:\\/i);

  if (isCompiledExe || isMalformedPath || !fs.existsSync(__dirname)) {
    // Use the directory containing the executable
    const execDir = path.dirname(process.execPath);
    console.log(`[Collector] Running as compiled executable from: ${execDir}`);
    return execDir;
  }

  // Normal execution - use __dirname
  console.log(`[Collector] Running in development mode from: ${__dirname}`);
  return path.resolve(__dirname, "..");
};

const basePath = getBasePath();

// Allow COLLECTOR_HOTDIR to be configured via environment variable
// Falls back to ./hotdir in the collector directory
const WATCH_DIRECTORY = process.env.COLLECTOR_HOTDIR
  ? path.resolve(process.env.COLLECTOR_HOTDIR)
  : path.resolve(basePath, "hotdir");

console.log(`[Collector] Watch directory (hotdir): ${WATCH_DIRECTORY}`);

const ACCEPTED_MIMES = {
  "text/plain": [".txt", ".md", ".org", ".adoc", ".rst"],
  "text/html": [".html"],
  "text/csv": [".csv"],
  "application/json": [".json"],
  // TODO: Create asDoc.js that works for standard MS Word files.
  // "application/msword": [".doc"],

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],

  "application/vnd.oasis.opendocument.text": [".odt"],
  "application/vnd.oasis.opendocument.presentation": [".odp"],

  "application/pdf": [".pdf"],
  "application/mbox": [".mbox"],

  "audio/wav": [".wav"],
  "audio/mpeg": [".mp3"],

  "video/mp4": [".mp4"],
  "video/mpeg": [".mpeg"],
  "application/epub+zip": [".epub"],
  "image/png": [".png"],
  "image/jpeg": [".jpg"],
  "image/jpg": [".jpg"],
  "image/webp": [".webp"],
};

const SUPPORTED_FILETYPE_CONVERTERS = {
  ".txt": "./convert/asTxt.js",
  ".md": "./convert/asTxt.js",
  ".org": "./convert/asTxt.js",
  ".adoc": "./convert/asTxt.js",
  ".rst": "./convert/asTxt.js",
  ".csv": "./convert/asTxt.js",
  ".json": "./convert/asTxt.js",

  ".html": "./convert/asTxt.js",
  ".pdf": "./convert/asPDF/index.js",

  ".docx": "./convert/asDocx.js",
  // TODO: Create asDoc.js that works for standard MS Word files.
  // ".doc": "./convert/asDoc.js",

  ".pptx": "./convert/asOfficeMime.js",

  ".odt": "./convert/asOfficeMime.js",
  ".odp": "./convert/asOfficeMime.js",

  ".xlsx": "./convert/asXlsx.js",

  ".mbox": "./convert/asMbox.js",

  ".epub": "./convert/asEPub.js",

  ".mp3": "./convert/asAudio.js",
  ".wav": "./convert/asAudio.js",
  ".mp4": "./convert/asAudio.js",
  ".mpeg": "./convert/asAudio.js",

  ".png": "./convert/asImage.js",
  ".jpg": "./convert/asImage.js",
  ".jpeg": "./convert/asImage.js",
  ".webp": "./convert/asImage.js",
};

module.exports = {
  SUPPORTED_FILETYPE_CONVERTERS,
  WATCH_DIRECTORY,
  ACCEPTED_MIMES,
};
