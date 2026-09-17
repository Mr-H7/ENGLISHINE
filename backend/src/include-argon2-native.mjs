import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argon2Dir = join(dirname(fileURLToPath(import.meta.url)), 'runtime-deps/node_modules/argon2');

// node-gyp-build loads these via readdir, which Vercel NFT does not trace.
readFileSync(join(argon2Dir, 'prebuilds/linux-x64/argon2.glibc.node'));
readFileSync(join(argon2Dir, 'prebuilds/linux-x64/argon2.musl.node'));
