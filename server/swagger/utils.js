const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

// Helper to determine base path for compiled executable or development
const getSwaggerPath = () => {
  // Check if running as Bun compiled executable
  // In compiled mode on Windows, __dirname may be malformed (missing drive letter)
  // e.g., "\workspaces\..." instead of "D:\workspaces\..."
  const isMalformedPath = process.platform === 'win32' &&
                         __dirname.startsWith('\\') &&
                         !__dirname.match(/^[A-Z]:\\/i);

  if (isMalformedPath || !fs.existsSync(__dirname)) {
    // Use the directory containing the executable
    return path.join(path.dirname(process.execPath), 'swagger');
  }

  // Normal execution - use __dirname
  return __dirname;
};

function faviconUrl() {
  return process.env.NODE_ENV === "production" ?
    '/public/favicon.png' :
    'http://localhost:3000/public/favicon.png'
}

function useSwagger(app) {
  const swaggerPath = getSwaggerPath();
  app.use('/api/docs', swaggerUi.serve);
  const options = {
    customCss: [
      fs.readFileSync(path.join(swaggerPath, 'index.css')),
      fs.readFileSync(path.join(swaggerPath, 'dark-swagger.css'))
    ].join('\n\n\n'),
    customSiteTitle: 'AnythingLLM Developer API Documentation',
    customfavIcon: faviconUrl(),
  }

  if (process.env.NODE_ENV === "production") {
    const swaggerDocument = require(path.join(swaggerPath, 'openapi.json'));
    app.get('/api/docs', swaggerUi.setup(
      swaggerDocument,
      {
        ...options,
        customJsStr: 'window.SWAGGER_DOCS_ENV = "production";\n\n' + fs.readFileSync(path.join(swaggerPath, 'index.js'), 'utf8'),
      },
    ));
  } else {
    // we regenerate the html page only in development mode to ensure it is up-to-date when the code is hot-reloaded.
    app.get(
      "/api/docs",
      async (_, response) => {
        // #swagger.ignore = true
        const swaggerDocument = require(path.join(swaggerPath, 'openapi.json'));
        return response.send(
          swaggerUi.generateHTML(
            swaggerDocument,
            {
              ...options,
              customJsStr: 'window.SWAGGER_DOCS_ENV = "development";\n\n' + fs.readFileSync(path.join(swaggerPath, 'index.js'), 'utf8'),
            }
          )
        );
      }
    );
  }
}

module.exports = { faviconUrl, useSwagger }