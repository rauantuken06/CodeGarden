import hashlib
import re
from datetime import timezone

from app.github import CommitHistory, CommitInfo
from app.schemas import Flower, GardenData, Plant
from app.validation import validate_repository_parts

GARDEN_WIDTH = 384
GARDEN_HEIGHT = 256
PLANT_LIMIT = 12
FLOWER_LIMIT = 12

BUG_FIX_PATTERN = re.compile(
    r"^fix(?:\([^()\r\n]+\))?:",
    re.IGNORECASE,
)

def get_plant_stage(commit_count: int) -> str:
    """Определяет стадию растения по активности месяца."""
    if commit_count < 0:
        raise ValueError("Количество коммитов не может быть отрицательным.")

    if commit_count == 0:
        return "empty"

    if commit_count < 5:
        return "seedling"

    if commit_count < 15:
        return "small_plant"

    if commit_count < 30:
        return "young_tree"

    return "mature_tree"

def group_commits_by_month(
    commits: list[CommitInfo],
) -> dict[str, list[CommitInfo]]:
    """Группирует коммиты по месяцам UTC в хронологическом порядке."""
    grouped: dict[str, list[CommitInfo]] = {}

    for commit in commits:
        if commit.committed_at.tzinfo is None:
            raise ValueError("Дата коммита должна содержать часовой пояс.")

        utc_date = commit.committed_at.astimezone(timezone.utc)
        month = f"{utc_date.year:04d}-{utc_date.month:02d}"

        grouped.setdefault(month, []).append(commit)

    return {
        month: grouped[month]
        for month in sorted(grouped)
    }

def is_bug_fix(message: str) -> bool:
    """Проверяет префикс только первой строки сообщения."""
    first_line = message.split("\n", 1)[0].lstrip()

    return BUG_FIX_PATTERN.match(first_line) is not None

def stable_offset(key: str) -> tuple[int, int]:
    """Даёт небольшие стабильные смещения внутри ячейки."""
    digest = hashlib.sha256(key.encode("utf-8")).digest()

    return digest[0] % 13 - 6, digest[1] % 9 - 4

def generate_garden(
    repository: str,
    history: CommitHistory,
) -> GardenData:
    """Превращает загруженную историю в данные сада."""
    parts = repository.strip().split("/")

    if len(parts) != 2:
        raise ValueError("Укажите репозиторий в формате owner/repo.")

    owner, repo = parts
    validate_repository_parts(owner, repo)

    # Регистр идентификатора не должен менять расположение сада.
    identifier = f"{owner}/{repo}".lower()

    grouped = group_commits_by_month(history.commits)
    bug_fix_count = sum(
        is_bug_fix(commit.message)
        for  commit in history.commits
    )

    displayed_months = list(grouped)[-PLANT_LIMIT:]
    plants: list[Plant] = []

    for index, month in enumerate(displayed_months):
        column = index % 4
        row = index // 4

        offset_x, offset_y = stable_offset(
            f"{identifier}:plant{month}"
        )

        commit_count = len(grouped[month])

        plants.append(
            Plant(
                month=month,
                commit_count=commit_count,
                stage=get_plant_stage(commit_count),
                x=56 + column * 88 + offset_x,
                y=64 + row * 68 + offset_y,
            )
        )

    flowers: list[Flower] = []

    for index in range(min(bug_fix_count, FLOWER_LIMIT)):
        offset_x, offset_y = stable_offset(
            f"{identifier}:flower:{index}"
        )

        flowers.append(
            Flower(
                x=20 + index * 30 + offset_x,
                y=240 + offset_y,
            )
        )

    return GardenData(
        repository=identifier,
        total_analyzed_commits=len(history.commits),
        active_months=len(grouped),
        bug_fix_count=bug_fix_count,
        truncated=history.truncated,
        width=GARDEN_WIDTH,
        height=GARDEN_HEIGHT,
        plant_display_limit=PLANT_LIMIT,
        flower_display_limit=FLOWER_LIMIT,
        hidden_plants=len(grouped) - len(plants),
        hidden_flowers=bug_fix_count - len(flowers),
        plants=plants,
        flowers=flowers,
    )