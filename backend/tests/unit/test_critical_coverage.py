from scripts.check_critical_coverage import coverage_for_packages


def test_coverage_for_packages_counts_only_requested_source_packages():
    files = {
        "controllers/auth_controller.py": {
            "summary": {"num_statements": 10, "covered_lines": 9}
        },
        "routes/auth_routes.py": {
            "summary": {"num_statements": 5, "covered_lines": 2}
        },
        "tests/test_auth.py": {
            "summary": {"num_statements": 20, "covered_lines": 20}
        },
    }

    covered, statements, found = coverage_for_packages(
        files, ("controllers", "models")
    )

    assert (covered, statements) == (9, 10)
    assert found == {"controllers"}


def test_coverage_for_packages_normalizes_windows_paths():
    files = {
        "database\\connection.py": {
            "summary": {"num_statements": 4, "covered_lines": 3}
        }
    }

    covered, statements, found = coverage_for_packages(files, ("database",))

    assert (covered, statements) == (3, 4)
    assert found == {"database"}
