import { exec } from "child_process";

async function _getProjectIdByGit() {
  try {
    let resolve: (value: Buffer | string) => void, reject: (err: Error) => void;
    const promise = new Promise<Buffer | string>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    exec(
      `git config --local --get remote.origin.url`,
      {
        timeout: 1000,
        windowsHide: true,
      },
      (error: null | Error, stdout: Buffer | string) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      }
    );

    return String(await promise).trim();
  } catch (_) {
    return null;
  }
}

export async function getRawProjectId(): Promise<string> {
  return (await _getProjectIdByGit()) || process.cwd();
}
