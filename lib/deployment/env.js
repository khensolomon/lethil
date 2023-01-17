import { config } from "../lethil.js";
import { executeChildProcess } from "./execute.js";

/**
 * Purely for deployment from local/workspace
 * @example
 * scp source user@host:target
 * scp <env_file> <config.SSH_USER>@<config.SSH_HOST>:<config.APP_ROOT>/
 * scp ~/OneDrive/env/dev/example/web/.env user@host:/var/www/example/
 * @param {string} env_file - which .env is need to transfer
 * @example ~/OneDrive/env/dev/example/web/.env
 * @returns {string}
 */
export function buildCommandLine(env_file) {
  return `scp ${env_file} ${config.SSH_USER}@${config.SSH_HOST}:${config.APP_ROOT}/`;
}

/**
 * Purely for deployment from local/workspace, which
 * transfer provided `env_file` argument of `.env` file to production using scp <s>
 * used by `node run environment`
 * @example
 * scp <env_file> <config.SSH_USER>@<config.SSH_HOST>:<config.APP_ROOT>/
 * node run environment
 * npm run deployment:environment
 * @param {string} env_file - which .env is need to transfe
 * @example ~/OneDrive/env/dev/example/web/.env
 */
export async function transfer(env_file) {
  const scp = buildCommandLine(env_file);
  return executeChildProcess(scp);
}
