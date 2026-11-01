import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from app.github import (
    GitHubAccessError,
    GitHubAPIError,
    GitHubNetworkError,
    GitHubRateLimitError,
    RepositoryNotFoundError,
    get_repository,
    parse_commit,
)
from app.validation import InvalidGitHubURL

@pytest.fixture(autouse=True)
def clear_github_token(monkeypatch):
    # Настоящий токен компьютера не должен влиять на тесты.
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)

def repository_data():
    return {
        "name": "requests",
        "full_name": "psf/requests",
        "private": False,
        "description": "HTTP libarary",
        "stargazers_count": 100,
        "default_branch": "main",
        "html_url": "https://github.com/psf/requests",
    }

def fetch_with_handler(handler):
    transport = httpx.MockTransport(handler)

    return asyncio.run(
        get_repository("psf", "requests", transport=transport)
    )

def test_get_public_repository():
    expected = repository_data()

    def handler(request):
        assert request.method == "GET"
        assert str(request.url) == (
            "https://api.github.com/repos/psf/requests"
        )
        assert request.headers["Accept"] == (
            "application/vnd.github+json"
        )
        assert "Authorization" not in request.headers

        return httpx.Response(200, json=expected)

    assert fetch_with_handler(handler) == expected

def test_uses_optional_token(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")

    def handler(request):
        assert request.headers["Authorization"] == "Bearer test-token"

        return httpx.Response(200, json=repository_data())

    result = fetch_with_handler(handler)

    assert "test-token" not in str(result)

@pytest.mark.parametrize(
    ("status", "headers", "body", "expected_error"),
    [
        (
            404,
            {},
            {"message": "Not Found"},
            RepositoryNotFoundError,
        ),
        (
            401,
            {},
            {"message": "Bad credentials"},
            GitHubAccessError,
        ),
        (
            403,
            {},
            {"message": "Forbidden"},
            GitHubAccessError,
        ),
        (
            403,
            {"x-ratelimit-remaining": "0"},
            {"message": "Forbidden"},
            GitHubRateLimitError,
        ),
        (
            403,
            {"retry-after": "60"},
            {"message": "Forbidden"},
            GitHubRateLimitError,
        ),
        (
            403,
            {},
            {"message": "You have exceeded a secondary rate limit."},
            GitHubRateLimitError,
        ),
        (
            429,
            {},
            {"message": "Too many requests"},
            GitHubRateLimitError,
        ),
        (
            500,
            {},
            {"message": "Internal server error"},
            GitHubAPIError,
        ),
        (
            301,
            {"location": "https://api.github.com/repos/new/name"},
            {},
            GitHubAPIError,
        ),
    ],
)
def test_http_errors(status, headers, body, expected_error):
    def handler(request):
        return httpx.Response(
            status,
            headers=headers,
            json=body,
        )

    with pytest.raises(expected_error):
        fetch_with_handler(handler)


def test_reject_private_repository():
    data = repository_data()
    data["private"] = True

    def handler(request):
        return httpx.Response(200, json=data)

    with pytest.raises(RepositoryNotFoundError):
        fetch_with_handler(handler)


@pytest.mark.parametrize(
    "error_type",
    [httpx.ConnectError, httpx.ReadTimeout],
)
def test_network_errors(error_type):
    def handler(request):
        raise error_type("Connection failed", request=request)

    with pytest.raises(GitHubNetworkError):
        fetch_with_handler(handler)


def test_invalid_json():
    def handler(request):
        return httpx.Response(200, content=b"not json")

    with pytest.raises(GitHubAPIError):
        fetch_with_handler(handler)


@pytest.mark.parametrize(
    "body",
    [
        [],
        {},
        {"name": "requests", "full_name": "psf/requests"},
    ],
)
def test_unexpected_response_data(body):
    def handler(request):
        return httpx.Response(200, json=body)

    with pytest.raises(GitHubAPIError):
        fetch_with_handler(handler)


def test_invalid_owner_does_not_send_request():
    def handler(request):
        pytest.fail("Для неправильного owner запрос отправляться не должен.")

    transport = httpx.MockTransport(handler)

    with pytest.raises(InvalidGitHubURL):
        asyncio.run(
            get_repository(
                "invalid/owner",
                "requests",
                transport=transport,
            )
        )

def make_commit_data(date_string):
    return {
        "sha": "abc123",
        "commit": {
            "message": "fix: correct garden layout",
            "author": {
                "date": "2020-01-01T00:00:00Z",
            },
            "committer": {
                "date": date_string,
            },
        },
    }


@pytest.mark.parametrize(
    ("date_string", "expected"),
    [
        (
            "2026-03-01T01:00:00Z",
            datetime(2026, 3, 1, 1, tzinfo=timezone.utc),
        ),
        (
            "2026-03-01T01:00:00+03:00",
            datetime(2026, 2, 28, 22, tzinfo=timezone.utc),
        ),
        (
            "2026-03-01T01:00:00-05:00",
            datetime(2026, 3, 1, 6, tzinfo=timezone.utc),
        ),
    ],
)
def test_parse_commit_converts_committer_date_to_utc(
    date_string,
    expected,
):
    result = parse_commit(make_commit_data(date_string))

    assert result.sha == "abc123"
    assert result.message == "fix: correct garden layout"
    assert result.committed_at == expected
    assert result.committed_at.tzinfo is timezone.utc


@pytest.mark.parametrize(
    "date_string",
    [
        "not-a-date",
        "2026-03-01T01:00:00",
        "",
        None,
    ],
)
def test_parse_commit_rejects_invalid_date(date_string):
    with pytest.raises(GitHubAPIError):
        parse_commit(make_commit_data(date_string))


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"sha": "abc123"},
        {"sha": "abc123", "commit": None},
        {
            "sha": "abc123",
            "commit": {
                "message": "fix: example",
                "committer": {},
            },
        },
    ],
)
def test_parse_commit_rejects_missing_fields(data):
    with pytest.raises(GitHubAPIError):
        parse_commit(data)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("sha", ""),
        ("sha", None),
        ("message", None),
        ("message", 123),
    ],
)
def test_parse_commit_rejects_invalid_fields(field, value):
    data = make_commit_data("2026-03-01T01:00:00Z")

    if field == "sha":
        data["sha"] = value
    else:
        data["commit"]["message"] = value

    with pytest.raises(GitHubAPIError):
        parse_commit(data)