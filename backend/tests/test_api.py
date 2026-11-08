from datetime import datetime, timezone
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

import app.main as api
from app.github import (
    CommitHistory,
    CommitInfo,
    GitHubAccessError,
    GitHubAPIError,
    GitHubNetworkError,
    GitHubRateLimitError,
    RepositoryNotFoundError,
)


@pytest.fixture(autouse=True)
def block_external_requests(monkeypatch):
    async def blocked_send(*args, **kwargs):
        raise AssertionError(
            "API-тесты не должны отправлять внешние запросы."
        )

    monkeypatch.setattr(
        httpx.AsyncClient,
        "send",
        blocked_send,
    )


@pytest.fixture
def github_mocks(monkeypatch):
    repository = AsyncMock(
        return_value={
            "owner": {"login": "dev"},
            "name": "demo",
            "full_name": "dev/demo",
            "description": "Synthetic test repository",
            "stargazers_count": 12,
            "html_url": "https://github.com/dev/demo",
            "default_branch": "main",
            "private": False,
            "unused_secret": "must-not-be-returned",
        }
    )

    commits = AsyncMock(
        return_value=CommitHistory(
            commits=[
                CommitInfo(
                    sha="a" * 40,
                    message="fix: example",
                    committed_at=datetime(
                        2026, 1, 10, tzinfo=timezone.utc,
                    ),
                ),
                CommitInfo(
                    sha="b" * 40,
                    message="feat: example",
                    committed_at=datetime(
                        2026, 1, 11, tzinfo=timezone.utc,
                    ),
                ),
            ],
            truncated=False,
        )
    )

    monkeypatch.setattr(api, "get_repository", repository)
    monkeypatch.setattr(api, "get_commits", commits)

    return repository, commits


@pytest.fixture
def client(github_mocks):
    with TestClient(api.app) as test_client:
        yield test_client


def test_health(client, github_mocks):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "version": "0.1.0",
    }

    repository, commits = github_mocks
    repository.assert_not_awaited()
    commits.assert_not_awaited()


def test_valid_garden(client, github_mocks):
    response = client.get("/api/garden/dev/demo")

    assert response.status_code == 200

    data = response.json()
    metadata = data["repository"]
    garden = data["garden"]

    assert metadata == {
        "owner": "dev",
        "name": "demo",
        "full_name": "dev/demo",
        "description": "Synthetic test repository",
        "stars": 12,
        "html_url": "https://github.com/dev/demo",
        "default_branch": "main",
    }

    assert garden["repository"] == "dev/demo"
    assert garden["total_analyzed_commits"] == 2
    assert garden["active_months"] == 1
    assert garden["bug_fix_count"] == 1
    assert garden["truncated"] is False
    assert garden["plant_display_limit"] == 12
    assert garden["flower_display_limit"] == 12
    assert len(garden["plants"]) == 1
    assert len(garden["flowers"]) == 1

    plant = garden["plants"][0]
    assert plant["month"] == "2026-01"
    assert plant["commit_count"] == 2
    assert plant["stage"] == "seedling"
    assert isinstance(plant["x"], int)
    assert isinstance(plant["y"], int)

    assert "must-not-be-returned" not in response.text

    repository, commits = github_mocks
    repository.assert_awaited_once_with("dev", "demo")
    commits.assert_awaited_once_with("dev", "demo")


@pytest.mark.parametrize(
    "path",
    [
        "/api/garden/bad_owner/demo",
        "/api/garden/dev/bad%20repo",
        "/api/garden/-dev/demo",
    ],
)
def test_invalid_identifier(client, github_mocks, path):
    response = client.get(path)

    assert response.status_code == 422

    repository, commits = github_mocks
    repository.assert_not_awaited()
    commits.assert_not_awaited()


def test_empty_repository(client, github_mocks):
    _, commits = github_mocks
    commits.return_value = CommitHistory(
        commits=[],
        truncated=False,
    )

    response = client.get("/api/garden/dev/demo")

    assert response.status_code == 200

    garden = response.json()["garden"]

    assert garden["total_analyzed_commits"] == 0
    assert garden["active_months"] == 0
    assert garden["bug_fix_count"] == 0
    assert garden["plants"] == []
    assert garden["flowers"] == []
    assert garden["truncated"] is False


def test_truncated_history(client, github_mocks):
    _, commits = github_mocks
    original = commits.return_value

    commits.return_value = CommitHistory(
        commits=original.commits,
        truncated=True,
    )

    response = client.get("/api/garden/dev/demo")

    assert response.status_code == 200
    assert response.json()["garden"]["truncated"] is True
    assert response.json()["garden"]["total_analyzed_commits"] == 2


@pytest.mark.parametrize("failing_step", [0, 1])
@pytest.mark.parametrize(
    ("error_type", "expected_status"),
    [
        (RepositoryNotFoundError, 404),
        (GitHubRateLimitError, 429),
        (GitHubAPIError, 502),
        (GitHubAccessError, 502),
        (GitHubNetworkError, 503),
    ],
)
def test_github_errors(
    client,
    github_mocks,
    failing_step,
    error_type,
    expected_status,
):
    github_mocks[failing_step].side_effect = error_type(
        "internal-secret-must-not-leak"
    )

    response = client.get("/api/garden/dev/demo")

    assert response.status_code == expected_status
    assert set(response.json()) == {"detail"}
    assert "internal-secret-must-not-leak" not in response.text

    if failing_step == 0:
        github_mocks[1].assert_not_awaited()


def test_malformed_metadata(client, github_mocks):
    repository, commits = github_mocks
    repository.return_value = {"name": "demo"}

    response = client.get("/api/garden/dev/demo")

    assert response.status_code == 502
    commits.assert_not_awaited()


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
)
def test_allowed_cors_origin(client, origin):
    response = client.options(
        "/api/garden/dev/demo",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_other_cors_origin_is_not_allowed(client):
    response = client.options(
        "/api/garden/dev/demo",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_openapi_documentation(client):
    response = client.get("/openapi.json")

    assert response.status_code == 200

    document = response.json()

    assert document["info"]["title"] == "CodeGarden API"
    assert document["info"]["version"] == "0.1.0"
    assert "/api/health" in document["paths"]
    assert "/api/garden/{owner}/{repo}" in document["paths"]
    assert client.get("/docs").status_code == 200