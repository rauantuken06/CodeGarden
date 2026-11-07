from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.config import API_TITLE, API_VERSION, CORS_ORIGINS
from app.garden import generate_garden
from app.github import (
    GitHubAccessError,
    GitHubAPIError,
    GitHubNetworkError,
    GitHubRateLimitError,
    RepositoryNotFoundError,
    get_commits,
    get_repository,
)
from app.schemas import GardenResponse, RepositoryMetadata
from app.validation import InvalidGitHubURL, validate_repository_parts

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)

@app.get("/api/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "version": API_VERSION,
    }

@app.get(
    "/api/garden/{owner}/{repo}",
    response_model=GardenResponse,    
) 
async def get_garden(owner: str, repo: str) -> GardenResponse:
    try:
        validate_repository_parts(owner, repo)

        raw_repository = await get_repository(owner, repo)

        metadata = RepositoryMetadata(
            owner=raw_repository["owner"]["login"],
            name=raw_repository["name"],
            full_name=raw_repository["full_name"],
            description=raw_repository.get("description"),
            stars=raw_repository["stargazers_count"],
            html_url=raw_repository["html_url"],
            default_branch=raw_repository["default_branch"],
        )

        history = await get_commits(
            metadata.owner,
            metadata.name,
        )

        garden = generate_garden(
            f"{metadata.owner}/{metadata.name}",
            history,
        )

        return GardenResponse(
            repository=metadata,
            garden=garden,
        )
    except InvalidGitHubURL as error:
        raise HTTPException(
            status_code=422,
            detail="Некорректное имя владельца или репозитория.",
        ) from error

    except RepositoryNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail="Репозиторий не найден или недоступен публично.",
        ) from error

    except GitHubRateLimitError as error:
        raise HTTPException(
            status_code=503,
            detail="Не удалось связаться с GitHub. Попробуйте позже.",
        ) from error

    except GitHubAccessError as error:
        raise HTTPException(
            status_code=502,
            detail="GitHub отклонил запрос сервера.",
        ) from error

    except GitHubAPIError as error:
        raise HTTPException(
            status_code=502,
            detail="Не удалось получить корректные данные от GitHub.",
        ) from error

    except (KeyError, TypeError, ValidationError) as error:
        raise HTTPException(
            status_code=502,
            detail="GitHub вернул неожиданный формат данных.",
        ) from error
