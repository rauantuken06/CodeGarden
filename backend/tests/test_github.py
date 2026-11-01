import asyncio

import httpx
import pytest

from app.github import (
    GitHubAccessError,
    GitHubAPIError,
    GitHubNetworkError,
    GitHubRateLimitError,
    RepositoryNotFoundError,
    get_repository,
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