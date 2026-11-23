const { classifyAuditResult } = require("./audit-dependencies");

function auditReport(counts, vulnerabilities = {}) {
  return {
    status: 0,
    stdout: JSON.stringify({
      metadata: { vulnerabilities: counts },
      vulnerabilities,
    }),
    stderr: "",
  };
}

test("passes clean audit reports", () => {
  expect(
    classifyAuditResult(
      auditReport({ low: 0, moderate: 0, high: 0, critical: 0 })
    )
  ).toEqual({
    kind: "clean",
    counts: { low: 0, moderate: 0, high: 0, critical: 0 },
  });
});

test("reports low and moderate findings without treating them as blocking", () => {
  expect(
    classifyAuditResult(
      auditReport({ low: 1, moderate: 2, high: 0, critical: 0 })
    )
  ).toMatchObject({
    kind: "clean",
    counts: { low: 1, moderate: 2 },
  });
});

test("fails specifically for high or critical vulnerabilities", () => {
  expect(
    classifyAuditResult({
      ...auditReport(
        { low: 0, moderate: 0, high: 1, critical: 0 },
        { "affected-package": { severity: "high" } }
      ),
      status: 1,
    })
  ).toEqual({
    kind: "vulnerabilities",
    critical: 0,
    high: 1,
    packages: [{ name: "affected-package", severity: "high" }],
  });
});

test("classifies registry errors separately from vulnerabilities", () => {
  expect(
    classifyAuditResult({
      status: 1,
      stdout: JSON.stringify({
        error: {
          code: "ENOAUDIT",
          summary: "The audit endpoint is unavailable.",
        },
      }),
      stderr: "",
    })
  ).toEqual({
    kind: "registry",
    code: "ENOAUDIT",
    message: "The audit endpoint is unavailable.",
  });

  expect(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: "request failed with ECONNRESET",
    })
  ).toMatchObject({ kind: "registry", code: "ECONNRESET" });
});

test("reports malformed or unrelated audit failures as execution errors", () => {
  expect(
    classifyAuditResult({
      status: 1,
      stdout: "",
      stderr: "npm exited unexpectedly",
    })
  ).toMatchObject({ kind: "error" });
});
