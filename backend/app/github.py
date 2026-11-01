import os

import httpx

from app.validation import validate_repository_parts

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


async def get_repository(
    owner: str,
    repo: str,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict:
    """Получает метаданные публичного GitHub-репозитория."""
    validate_repository_parts(owner, repo)

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "CodeGarden",
    }

    token = os.getenv("GITHUB_TOKEN", "").strip()

    if token:
        headers["Authorization"] = f"Bearer {token}"

    try: 
        async with httpx.AsyncClient(
            base_url="https://api.github.com",
            headers=headers,
            timeout=15.0,
            transport=transport,
            follow_redirects=False,
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