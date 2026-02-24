#!/usr/bin/env node
/**
 * verify-push.js
 * Usage: node verify-push.js <repo_path> <function_name> [branch] [file_glob]
 *
 * Fetches origin and searches all tracked files on the remote branch
 * for the presence of <function_name>. Exits 0 on success, 1 on failure.
 */

const { execSync } = require("child_process");
const path = require("path");

const [, , repoPath, functionName, branch = "main", fileGlob = ""] = process.argv;

if (!repoPath || !functionName) {
    console.error("Usage: node verify-push.js <repo_path> <function_name> [branch] [file_glob]");
    process.exit(2);
}

const absRepo = path.resolve(repoPath);

function run(cmd, opts = {}) {
    return execSync(cmd, { cwd: absRepo, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts });
}

console.log(`\n🔄  Fetching latest from origin (branch: ${branch})...`);
try {
    run(`git fetch origin ${branch}`);
} catch (e) {
    console.error("❌  git fetch failed:\n", e.stderr || e.message);
    process.exit(1);
}

console.log(`🔍  Searching for "${functionName}" in origin/${branch}...\n`);

let grepOutput = "";
try {
    // git grep searches across the remote-tracking ref
    const grepCmd = fileGlob
        ? `git grep -n "${functionName}" origin/${branch} -- "${fileGlob}"`
        : `git grep -n "${functionName}" origin/${branch}`;
    grepOutput = run(grepCmd);
} catch (e) {
    // exit code 1 = no matches, >1 = error
    if (e.status === 1) {
        console.error(
            `❌  VERIFICATION FAILED: "${functionName}" was NOT found in origin/${branch}.\n` +
            `    The push may not have succeeded. Try:\n` +
            `      git -C ${absRepo} push origin ${branch}\n`
        );
        process.exit(1);
    }
    console.error("❌  git grep error:\n", e.stderr || e.message);
    process.exit(1);
}

if (grepOutput.trim()) {
    console.log("✅  VERIFICATION PASSED — function found in remote:\n");
    console.log(grepOutput.trim());
    console.log("\n🎉  Push confirmed successfully.");
    process.exit(0);
} else {
    console.error(`❌  VERIFICATION FAILED: no output for "${functionName}".`);
    process.exit(1);
}
