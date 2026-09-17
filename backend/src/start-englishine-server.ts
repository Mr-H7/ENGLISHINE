import { isAbsolute } from 'node:path';
import { buildApp } from './create-app.js';
import { env } from './config/env.js';

export async function startEnglishineServer(): Promise<void> {
  const app = await buildApp();
  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    app.log.info({ signal }, 'Graceful shutdown started');

    try {
      await app.close();
      app.log.info('Graceful shutdown completed');
      process.exitCode = 0;
    } catch (error) {
      app.log.error({ err: error }, 'Graceful shutdown failed');
      process.exitCode = 1;
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  process.on('unhandledRejection', (error) => {
    app.log.fatal({ err: error }, 'Unhandled promise rejection');
    void shutdown('SIGTERM');
  });

  process.on('uncaughtException', (error) => {
    app.log.fatal({ err: error }, 'Uncaught exception');
    void shutdown('SIGTERM');
  });

  if (env.NODE_ENV === 'production' && !env.TRUST_PROXY) {
    app.log.warn(
      'TRUST_PROXY is false. Set TRUST_PROXY=true when this process sits behind a reverse proxy so client IPs, rate limits, and HTTPS cookie handling are correct.',
    );
  }
  if (
    env.NODE_ENV === 'production' &&
    env.STORAGE_DRIVER === 'local' &&
    !isAbsolute(env.UPLOAD_DIR)
  ) {
    app.log.warn(
      { uploadDir: env.UPLOAD_DIR },
      'UPLOAD_DIR is relative. Point it at an absolute path on a persistent volume so videos and PDFs survive restarts and redeploys.',
    );
  }
  if (env.NODE_ENV === 'production') {
    app.log.info({ storageDriver: env.STORAGE_DRIVER }, 'Media storage driver selected');
  }

  const port = Number.parseInt(process.env.PORT ?? String(env.PORT), 10);
  const host = process.env.VERCEL === '1' ? '0.0.0.0' : env.HOST;

  try {
    await app.listen({ host, port });
    app.log.info({ host, port }, 'Englishine API is listening');
  } catch (error) {
    app.log.fatal({ err: error }, 'Failed to start Englishine API');
    process.exitCode = 1;
  }
}
