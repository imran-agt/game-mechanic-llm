const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

// npx prisma introspect
// npx prisma generate
// npx prisma migrate dev --name init -> ensures that db is in sync with schema
// npx prisma migrate reset -> resets the db

const logLevels = ["error", "info", "warn"]; // add "query" to debug query logs

let prisma;
try {
  prisma = new PrismaClient({
    log: logLevels,
    errorFormat: "pretty",
  });

  // Test connection and provide helpful error messages
  prisma.$connect().catch((error) => {
    console.error("\n❌ Failed to connect to database!");
    console.error("Error:", error.message);

    if (error.message.includes("unable to open database file")) {
      console.error("\n🔍 Troubleshooting:");
      console.error("1. Check if DATABASE_URL is set correctly in .env file");
      console.error("2. Ensure the database directory exists and has write permissions");
      console.error("3. If using Windows, make sure the path is absolute (not relative)");

      const dbUrl = process.env.DATABASE_URL || "not set";
      console.error(`\nCurrent DATABASE_URL: ${dbUrl}`);

      if (dbUrl.startsWith("file:")) {
        const dbPath = dbUrl.substring(5);
        const dbDir = path.dirname(dbPath);
        console.error(`\nDatabase directory: ${dbDir}`);
        console.error(`Directory exists: ${fs.existsSync(dbDir)}`);

        if (fs.existsSync(dbDir)) {
          console.error(`Directory is writable: ${fs.accessSync(dbDir, fs.constants.W_OK) === undefined}`);
        }
      }

      console.error("\n💡 Solution: Run setup.bat to create a proper .env configuration");
    }

    // Don't exit immediately - let the app try to continue
    // Some routes might still work, and this gives better error visibility
  });
} catch (error) {
  console.error("\n❌ Failed to initialize Prisma Client!");
  console.error("Error:", error.message);
  console.error("\n💡 Solution: Run setup.bat to configure the database");

  // Create a minimal prisma object to prevent crashes
  prisma = {
    $connect: async () => { throw new Error("Database not initialized"); },
    $disconnect: async () => {},
  };
}

module.exports = prisma;
