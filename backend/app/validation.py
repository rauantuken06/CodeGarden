import re
from dataclasses import dataclass
from urllib.parse import urlsplit


OWNER_PATTERN = re.compile(
    r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*"
)
REPO_PATTERN = re.compile(r"[A-Za-z0-9._-]+")


class InvalidGitHubURL(ValueError):
    """Ссылка не соответствует ожидаемому формату GitHub."""


@dataclass(frozen=True)
class RepositoryReference:
    owner: str
    repo: str


def validate_repository_parts(owner: str, repo: str) -> None:
    """Проверяет владельца и имя репозитория без сетевых запросов."""
    if (
        len(owner) > 39
        or OWNER_PATTERN.fullmatch(owner) is None
    ):
        raise InvalidGitHubURL(
            "Некорректное имя владельца GitHub."
        )

    if (
        len(repo) > 100
        or REPO_PATTERN.fullmatch(repo) is None
        or repo in {".", ".."}
    ):
        raise InvalidGitHubURL(
            "Некорректное название репозитория GitHub."
        )


def parse_github_url(value: str) -> RepositoryReference:
    """Разбирает HTTPS-ссылку на корень GitHub-репозитория."""
    value = value.strip()

    if not value:
        raise InvalidGitHubURL("Введите ссылку на GitHub-репозиторий.")

    try:
        parsed = urlsplit(value)
    except ValueError as error:
        raise InvalidGitHubURL("Некорректная ссылка GitHub.") from error

    if (
        parsed.scheme.lower() != "https"
        or parsed.netloc.lower() != "github.com"
    ):
        raise InvalidGitHubURL(
            "Используйте ссылку вида https://github.com/owner/repo."
        )

    if parsed.query or parsed.fragment:
        raise InvalidGitHubURL(
            "Ссылка не должна содержать параметры или якорь."
        )

    # Разрешаем один завершающий слеш.
    path = parsed.path.removesuffix("/")
    parts = path.split("/")

    if len(parts) != 3 or parts[0] != "":
        raise InvalidGitHubURL(
            "Укажите ссылку на репозиторий, а не на файл или раздел."
        )

    owner, repo = parts[1], parts[2]

    # Поддерживаем ссылки, скопированные для git clone.
    repo = repo.removesuffix(".git")

    validate_repository_parts(owner, repo)

    return RepositoryReference(owner=owner, repo=repo)