import pytest

from app.validation import (
    InvalidGitHubURL,
    RepositoryReference,
    parse_github_url,
    validate_repository_parts,
)

@pytest.mark.parametrize(
    ("url", "owner", "repo"),
    [
        ("https://github.com/psf/requests", "psf", "requests"),
        ("https://github.com/psf/requests/", "psf", "requests"),
        ("https://github.com/psf/requests.git", "psf", "requests"),
        ("https://github.com/psf/requests.git/", "psf", "requests"),
        ("  https://github.com/psf/requests  ", "psf", "requests"),
        ("https://GITHUB.COM/psf/requests", "psf", "requests"),
        (
            "https://github.com/my-team/my_repo.v1",
            "my-team",
            "my_repo.v1",
        ),
    ],
)
def test_parse_valid_github_url(url, owner, repo):
    assert parse_github_url(url) == RepositoryReference(
        owner=owner,
        repo=repo,
    )

@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        "not a url",
        "github.com/psf/requests",
        "http://github.com/psf/requests",
        "https://gitlab.com/psf/requests",
        "https://github.com.evil.example/psf/requests",
        "https://github.com@evil.example/psf/requests",
        "https://user:password@github.com/psf/requests",
        "https://github.com:443/psf/requests",
        "https://github.com",
        "https://github.com/psf",
        "https://github.com/psf/",
        "https://github.com//requests",
        "https://github.com/psf/requests//",
        "https://github.com/psf/requests/tree/main",
        "https://github.com/psf/requests/issues",
        "https://github.com/psf/requests?tab=readme",
        "https://github.com/psf/requests#readme",
        "https://github.com/-owner/repo",
        "https://github.com/owner-/repo",
        "https://github.com/my--team/repo",
        "https://github.com/my_team/repo",
        "https://github.com/owner/my repo",
        "https://github.com/owner/my%20repo",
        "https://github.com/owner/.",
        "https://github.com/owner/..",
        "https://github.com/owner/.git",
        "https://[github.com/owner/repo",
    ],
)
def test_reject_invalid_github_url(url):
    with pytest.raises(InvalidGitHubURL):
        parse_github_url(url)

def test_accept_maximum_name_lengths():
    owner = "a" * 39
    repo = "b" * 100

    result = parse_github_url(
        f"https://github.com/{owner}/{repo}"
    )

    assert result.owner == owner
    assert result.repo == repo

@pytest.mark.parametrize(
    ("owner", "repo"),
    [
        ("a" * 40, "repo"),
        ("owner", "b" * 101),
        ("", "repo"),
        ("owner", ""),
        ("owner/other", "repo"),
        ("owner", "repo/other"),
    ],
)
def test_reject_invalid_repository_parts(owner, repo):
    with pytest.raises(InvalidGitHubURL):
        validate_repository_parts(owner, repo)