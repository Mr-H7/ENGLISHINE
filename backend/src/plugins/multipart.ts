import multipart from '@fastify/multipart';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

export const multipartPlugin = fp(
  async (app) => {
    await app.register(multipart, {
      attachFieldsToBody: false,
      limits: {
        fieldNameSize: 100,
        fieldSize: 1_048_576,
        fields: 20,
        files: env.UPLOAD_MAX_FILES,
        fileSize: env.UPLOAD_MAX_FILE_BYTES,
        headerPairs: 100,
      },
    });
  },
  { name: 'multipart' },
);
