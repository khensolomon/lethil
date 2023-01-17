import child_process from "child_process";
import util from "util";

/**
 * Purely for deployment from local/workspace, which
 * executed to do shell command
 * @example
 * scp source user@host:target
 * scp ~/<source>/.env ${config.SSH_USER}@${config.SSH_HOST}:/var/www/<target>/
 * @param {string} command
 */
export async function executeChildProcess(command) {
  child_process.exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(error);
    }
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.warn(stderr);
    }
  });
  return "Executing";
}

/**
 * Purely for deployment from local/workspace, which
 * executed to do shell command
 * @example
 * scp source user@host:target
 * @param {string} command
 */
export async function executeWithPromisify(command) {
  const exec = util.promisify(child_process.exec);
  const { stdout, stderr } = await exec(command);
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.warn(stderr);
  }
}
