"""Enforce minimum coverage for financially critical modules."""

import argparse
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TypedDict


MINIMUM_COVERAGE = {
    "models/saldo_model.py": 90.0,
    "services/financeiro_service.py": 90.0,
}
GATED_COVERAGE_PACKAGES = (
    "controllers",
    "models",
    "services",
    "utils",
    "middlewares",
)
REPORT_ONLY_COVERAGE_PACKAGES = ("routes", "database")
MINIMUM_AGGREGATE_COVERAGE = 90.0


class CoverageSummary(TypedDict):
    num_statements: int
    covered_lines: int


class CoverageMetrics(TypedDict):
    summary: CoverageSummary


def coverage_for_packages(
    files: Mapping[str, CoverageMetrics], packages: Sequence[str]
) -> tuple[int, int, set[str]]:
    package_names = set(packages)
    statements = 0
    covered_lines = 0
    found_packages = set()
    for path, metrics in files.items():
        package = path.replace("\\", "/").split("/", 1)[0]
        if package not in package_names:
            continue
        summary = metrics["summary"]
        statements += summary["num_statements"]
        covered_lines += summary["covered_lines"]
        found_packages.add(package)
    return covered_lines, statements, found_packages


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path, help="Coverage JSON report path")
    report_path = parser.parse_args().report
    with report_path.open(encoding="utf-8") as report_file:
        report = json.load(report_file)

    files = report.get("files", {})
    failures = []
    covered, statements, found_packages = coverage_for_packages(
        files, GATED_COVERAGE_PACKAGES
    )
    for package in sorted(set(GATED_COVERAGE_PACKAGES) - found_packages):
        failures.append(f"{package}: missing from coverage report")
    aggregate_coverage = 100.0 * covered / statements if statements else 0.0
    print(
        "Gated package aggregate: "
        f"{aggregate_coverage:.2f}% "
        f"(minimum {MINIMUM_AGGREGATE_COVERAGE:.2f}%)"
    )
    if aggregate_coverage < MINIMUM_AGGREGATE_COVERAGE:
        failures.append(
            "gated package aggregate: "
            f"{aggregate_coverage:.2f}% is below "
            f"{MINIMUM_AGGREGATE_COVERAGE:.2f}%"
        )

    for package in REPORT_ONLY_COVERAGE_PACKAGES:
        package_covered, package_statements, package_found = coverage_for_packages(
            files, (package,)
        )
        if package not in package_found:
            failures.append(f"{package}: missing from coverage report")
            continue
        package_coverage = (
            100.0 * package_covered / package_statements
            if package_statements
            else 0.0
        )
        print(f"{package}: {package_coverage:.2f}% (report only; no minimum)")

    for module, minimum in MINIMUM_COVERAGE.items():
        metrics = files.get(module)
        if metrics is None:
            failures.append(f"{module}: missing from coverage report")
            continue
        covered = float(metrics["summary"]["percent_covered"])
        print(f"{module}: {covered:.2f}% (minimum {minimum:.2f}%)")
        if covered < minimum:
            failures.append(
                f"{module}: {covered:.2f}% is below {minimum:.2f}%"
            )

    if failures:
        parser.exit(1, "\n".join(failures) + "\n")


if __name__ == "__main__":
    main()
