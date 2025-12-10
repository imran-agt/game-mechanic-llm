const path = require("path");
const fs = require("fs");
const {
  WATCH_DIRECTORY,
  SUPPORTED_FILETYPE_CONVERTERS,
} = require("../utils/constants");
const {
  trashFile,
  isTextType,
  normalizePath,
  isWithin,
} = require("../utils/files");
const RESERVED_FILES = ["__HOTDIR__.md"];

// Pre-import all converters for Bun compiled executable compatibility
const asTxt = require("./convert/asTxt.js");
const asPDF = require("./convert/asPDF/index.js");
const asDocx = require("./convert/asDocx.js");
const asOfficeMime = require("./convert/asOfficeMime.js");
const asXlsx = require("./convert/asXlsx.js");
const asMbox = require("./convert/asMbox.js");
const asEPub = require("./convert/asEPub.js");
const asAudio = require("./convert/asAudio.js");
const asImage = require("./convert/asImage.js");

// Map file extensions to pre-imported converters
const CONVERTER_MAP = {
  ".txt": asTxt,
  ".md": asTxt,
  ".org": asTxt,
  ".adoc": asTxt,
  ".rst": asTxt,
  ".csv": asTxt,
  ".json": asTxt,
  ".html": asTxt,
  ".pdf": asPDF,
  ".docx": asDocx,
  ".pptx": asOfficeMime,
  ".odt": asOfficeMime,
  ".odp": asOfficeMime,
  ".xlsx": asXlsx,
  ".mbox": asMbox,
  ".epub": asEPub,
  ".mp3": asAudio,
  ".wav": asAudio,
  ".mp4": asAudio,
  ".mpeg": asAudio,
  ".png": asImage,
  ".jpg": asImage,
  ".jpeg": asImage,
  ".webp": asImage,
};

/**
 * Process a single file and return the documents
 * @param {string} targetFilename - The filename to process
 * @param {Object} options - The options for the file processing
 * @param {boolean} options.parseOnly - If true, the file will not be saved as a document even when `writeToServerDocuments` is called in the handler. Must be explicitly set to true to use.
 * @param {Object} metadata - The metadata for the file processing
 * @returns {Promise<{success: boolean, reason: string, documents: Object[]}>} - The documents from the file processing
 */
async function processSingleFile(targetFilename, options = {}, metadata = {}) {
  const fullFilePath = path.resolve(
    WATCH_DIRECTORY,
    normalizePath(targetFilename)
  );
  if (!isWithin(path.resolve(WATCH_DIRECTORY), fullFilePath))
    return {
      success: false,
      reason: "Filename is a not a valid path to process.",
      documents: [],
    };

  if (RESERVED_FILES.includes(targetFilename))
    return {
      success: false,
      reason: "Filename is a reserved filename and cannot be processed.",
      documents: [],
    };
  if (!fs.existsSync(fullFilePath))
    return {
      success: false,
      reason: "File does not exist in upload directory.",
      documents: [],
    };

  const fileExtension = path.extname(fullFilePath).toLowerCase();
  if (fullFilePath.includes(".") && !fileExtension) {
    return {
      success: false,
      reason: `No file extension found. This file cannot be processed.`,
      documents: [],
    };
  }

  let processFileAs = fileExtension;
  if (!CONVERTER_MAP.hasOwnProperty(fileExtension)) {
    if (isTextType(fullFilePath)) {
      console.log(
        `\x1b[33m[Collector]\x1b[0m The provided filetype of ${fileExtension} does not have a preset and will be processed as .txt.`
      );
      processFileAs = ".txt";
    } else {
      trashFile(fullFilePath);
      return {
        success: false,
        reason: `File extension ${fileExtension} not supported for parsing and cannot be assumed as text file type.`,
        documents: [],
      };
    }
  }

  const FileTypeProcessor = CONVERTER_MAP[processFileAs];
  return await FileTypeProcessor({
    fullFilePath,
    filename: targetFilename,
    options,
    metadata,
  });
}

module.exports = {
  processSingleFile,
};
