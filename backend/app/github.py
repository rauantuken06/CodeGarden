import os
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app.validation import validate_repository_parts

@dataclass(frozen=True)
class CommitInfo:
    sha: str
    message: str
    committed_at: datetime

@dataclass(frozen=True)
class CommitHistory:
    commits: list[CommitInfo]
    truncated: bool

class GitHubAPIError(Exception):
    """Общая ошибка обращения к GitHub API."""

class RepositoryNotFoundError(GitHubAPIError):
    """Репозиторий не найден или недоступен публично."""

class GitHubRateLimitError(GitHubAPIError):
    """Превышен лимит запросов GitHub."""

class GitHubAccessError(GitHubAPIError):
    """GitHub отклонил авторизацию или доступ."""

class GitHubNetworkError(GitHubAPIError):
    """Не удалось связаться с GitHub."""

def parse_commit(data: dict) -> CommitInfo:
    """Преобразует данные GitHub в коммит с датой в UTC."""
    try:
        sha = data["sha"]
        message = data["commit"]["message"]
        date_string = data["commit"]["committer"]["date"]
    except (KeyError, TypeError) as error:
        raise GitHubAPIError(
            "GitHub вернул неполные данные коммита."
        ) from error

    if (
        not isinstance(sha, str)
        or not sha.strip()
        or not isinstance(message, str)
        or not isinstance(date_string, str)
    ):
        raise GitHubAPIError(
            "GitHub вернул некорректные поля коммита."
        )

    try:
        committed_at = datetime.fromisoformat(date_string)
    except ValueError as error:
        raise GitHubAPIError(
            "GitHub вернул некорректную дату коммита."
        ) from error

    if committed_at.tzinfo is None:
        raise GitHubAPIError(
            "Дата коммита не содержит часовой пояс."
        )

    return CommitInfo(
        sha=sha,
        message=message,
        committed_at=committed_at.astimezone(timezone.utc),
    )

def check_response(response: httpx.Response) -> None:
    """Преобразует ошибки HTTP в понятные ошибки приложения."""
    status = response.status_code

    if status == 404:
        raise RepositoryNotFoundError(
            "Репозиторий не найден или недоступен публично."
        )

    if status in {403, 429}:
        # Вторичный лимит может сработать даже при ненулевом остатке.
        is_rate_limit = (
            status == 429
            or response.headers.get("x-ratelimit-remaining") == "0"
            or "retry-after" in response.headers
            or "rate limit" in response.text.lower()
        )

        if is_rate_limit:
            raise GitHubRateLimitError(
                "Превышен лимит запросов GitHub. Попробуйте позже."
            )

        raise GitHubAccessError(
            "GitHub запретил доступ к репозиторию."
        )

    if status == 401:
        raise GitHubAccessError(
            "GitHub отклонил токен. Проверьте GITHUB_TOKEN."
        )

    if status != 200:
        raise GitHubAPIError(
            f"GitHub вернул неожиданный статус: {status}."
        )


def create_github_client(
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> httpx.AsyncClient:
    """Создаёт HTTP-клиент с общими настройками GitHub."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "CodeGarden",
    }

    token = os.getenv("GITHUB_TOKEN", "").strip()

    if token:
        headers["Authorization"] = f"Bearer {token}"

    return httpx.AsyncClient(
        base_url="https://api.github.com",
        headers=headers,
        timeout=15.0,
        transport=transport,
        follow_redirects=False,
    )

async def get_repository(
    owner: str,
    repo: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict:
    """Получает метаданные публичного GitHub-репозитория."""
    validate_repository_parts(owner, repo)

    try:
        async with create_github_client(
            transport=transport,
        ) as client:
            response = await client.get(f"/repos/{owner}/{repo}")
    except httpx.RequestError as error:
        raise GitHubNetworkError(
            "Не удалось связаться с GitHub. Попробуйте позже."
        ) from error

    check_response(response)

    try:
        data = response.json()
    except ValueError as error:
        raise GitHubAPIError(
            "GitHub вернул некорректный JSON."
        ) from error

    if not isinstance(data, dict):
        raise GitHubAPIError(
            "GitHub вернул неожиданный формат данных."
        )

    if data.get("private") is True:
        raise RepositoryNotFoundError(
            "CodeGarden поддерживает только публичные репозитории."
        )

    if (
        data.get("private") is not False
        or not isinstance(data.get("name"), str)
        or not isinstance(data.get("full_name"), str)
    ):
        raise GitHubAPIError(
            "В ответе GitHub отсутствуют данные репозитория."
        )

    return data

def is_empty_repository_response(response: httpx.Response) -> bool:
    """Проверяет явное сообщение GitHub о пустом репозитории."""
    if response.status_code != 409:
        return False

    try:
        data = response.json()
    except ValueError:
        return False

    return (
        isinstance(data, dict)
        and data.get("message") == "Git Repository is empty."
    )

async def get_commits(
        owner: str,
        repo: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
) -> CommitHistory:
    """Загружает максимум три страницы по 100 коммитов."""
    validate_repository_parts(owner, repo)

    commits: list[CommitInfo] = []
    seen_shas: set[str] = set()

    try:
        async with create_github_client(
            transport=transport,
        ) as client:
            for page in range(1, 4):
                response = await client.get(
                    f"/repos/{owner}/{repo}/commits",
                    params={"per_page": 100, "page": page},
                )

                # После уже загруженной страницы пустой репозиторий
                # означал бы изменение истории во время анализа.
                if page == 1 and is_empty_repository_response(response):
                    return CommitHistory(commits=[], truncated=False)

                check_response(response)

                try:
                    data = response.json()
                except ValueError as error:
                    raise GitHubAPIError(
                        "GitHub вернул некорректный JSON коммитов."
                    ) from error

                if not isinstance(data, list) or len(data) > 100:
                    raise GitHubAPIError(
                        "GitHub вернул неожиданный формат страницы коммитов."
                    )

                for item in data:
                    commit = parse_commit(item)

                    if commit.sha in seen_shas:
                        raise GitHubAPIError(
                            "GitHub вернул повторяющийся коммит. "
                            "История могла измениться. Повторите анализ."
                        )

                    seen_shas.add(commit.sha)
                    commits.append(commit)

                has_next = "next" in response.links

                if has_next and not data:
                    raise GitHubAPIError(
                        "GitHub вернул пустую страницу со ссылкой на следующую."
                    )

                if not has_next:
                    return CommitHistory(
                        commits=commits,
                        truncated=False,
                    )

                if page == 3:
                    return CommitHistory(
                        commits=commits,
                        truncated=True,
                    )
    except httpx.RequestError as error:
        raise GitHubNetworkError(
            "Не удалось загрузить историю коммитов. Попробуйте позже."
        ) from error

    raise GitHubAPIError("Не удалось завершить загрузку коммитов.")
            