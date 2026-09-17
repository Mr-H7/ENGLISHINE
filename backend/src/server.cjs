'use strict';

/**
 * Vercel Fastify copies the selected entry to /var/task/server.js.
 * Node then loads that file as CommonJS (the backend package.json
 * "type":"module" is not the nearest package.json in the Lambda).
 *
 * This CJS boundary is legal as CommonJS. Fastify 5 and Prisma 7 stay
 * ESM in the sibling .mjs bundle and are loaded with import().
 */
import('./englishine-app.mjs')
  .then((mod) => mod.startEnglishineServer())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
