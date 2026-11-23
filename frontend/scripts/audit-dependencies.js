const { spawnSync } = require("node:child_process");

const NETWORK_ERROR_CODES =
  /\b(EAI_AGAIN|ECONNRESET|ETIMEDOUT|ESOCKETTIMEDOUT|ENOTFOUND|ECONNREFUSED|ECONNABORTED|EHOSTUNREACH|ENETUNREACH|EPIPE|ENOAUDIT)\b/i;

function parseAuditReport(stdout) {
  if (!stdout) {
    return null;
  }
  try {
    return JSON.parse(stdout);
  } catch {
    const firstBrace = stdout.indexOf("{");
    const lastBrace = stdout.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return null;
    }
    try {
      return JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function classifyAuditResult(result) {
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const report = parseAuditReport(stdout);

  if (report && report.error) {
    return {
      kind: "registry",
      code: report.error.code || "AUDIT_ENDPOINT_ERROR",
      message: report.error.summary || "npm audit could not query the registry.",
    };
  }

  const counts = report && report.metadata && report.metadata.vulnerabilities;
  if (counts) {
    const critical = Number(counts.critical || 0);
    const high = Number(counts.high || 0);
    if (critical + high > 0) {
      return {
        kind: "vulnerabilities",
        critical,
        high,
        packages: Object.entries(report.vulnerabilities || {})
          .filter(([, vulnerability]) =>
            ["critical", "high"].includes(vulnerability.severity)
          )
          .map(([name, vulnerability]) => ({
            name,
            severity: vulnerability.severity,
          })),
      };
    }
    if (result.status === 0) {
      return {
        kind: "clean",
        counts: {
          low: Number(counts.low || 0),
          moderate: Number(counts.moderate || 0),
          high,
          critical,
        },
      };
    }
  }

  const details = [result.error && result.error.message, stdout, stderr]
    .filter(Boolean)
    .join("\n");
  if (NETWORK_ERROR_CODES.test(details)) {
    return {
      kind: "registry",
      code: details.match(NETWORK_ERROR_CODES)[0],
      message: "npm audit could not reach the package registry.",
    };
  }

  return {
    kind: "error",
    message:
      details.trim().slice(0, 500) ||
      "npm audit failed without returning a report.",
  };
}

function main() {
  const isWindows = process.platform === "win32";
  const result = spawnSync(
    isWindows ? process.env.ComSpec || "cmd.exe" : "npm",
    isWindows
      ? ["/d", "/s", "/c", "npm audit --audit-level=high --json"]
      : ["audit", "--audit-level=high", "--json"],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    }
  );
  const outcome = classifyAuditResult(result);

  if (outcome.kind === "clean") {
    const { low, moderate, high, critical } = outcome.counts;
    console.log(
      `Dependency audit passed (blocking threshold: high). ` +
        `Findings: ${critical} critical, ${high} high, ${moderate} moderate, ${low} low.`
    );
    if (low + moderate > 0) {
      console.warn(
        "::warning title=Dependency audit findings::Low/moderate findings " +
          "are reported but do not fail this workflow."
      );
    }
    return 0;
  }

  if (outcome.kind === "vulnerabilities") {
    console.error(
      `::error title=Dependency vulnerabilities::Found ${outcome.critical} critical ` +
        `and ${outcome.high} high npm audit finding(s).`
    );
    for (const vulnerability of outcome.packages) {
      console.error(`- ${vulnerability.name}: ${vulnerability.severity}`);
    }
    return 1;
  }

  if (outcome.kind === "registry") {
    console.error(
      `::error title=Dependency audit registry failure::${outcome.code}: ` +
        `${outcome.message} This is an audit/registry failure, not a vulnerability result.`
    );
    return 2;
  }

  console.error(`::error title=Dependency audit failed::${outcome.message}`);
  return 2;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { classifyAuditResult };
