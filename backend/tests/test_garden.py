from copy import deepcopy
from datetime import datetime, timezone

import pytest

from app.garden import (
    generate_garden,
    get_plant_stage,
    group_commits_by_month,
    is_bug_fix,
)
from app.github import CommitHistory, CommitInfo


def make_commit(
    number: int,
    date: str,
    message: str = "feat: example",
) -> CommitInfo:
    return CommitInfo(
        sha=f"{number:040x}",
        message=message,
        committed_at=datetime.fromisoformat(date),
    )


@pytest.mark.parametrize(
    ("count", "expected"),
    [
        (0, "empty"),
        (1, "seedling"),
        (4, "seedling"),
        (5, "small_plant"),
        (14, "small_plant"),
        (15, "young_tree"),
        (29, "young_tree"),
        (30, "mature_tree"),
        (300, "mature_tree"),
    ],
)
def test_plant_stage_boundaries(count, expected):
    assert get_plant_stage(count) == expected


def test_negative_commit_count():
    with pytest.raises(ValueError):
        get_plant_stage(-1)


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("fix: login error", True),
        ("fix(auth): token error", True),
        ("FIX: crash", True),
        ("  FiX(api): timeout", True),
        ("\tfix: example\nDetails", True),
        ("feature: new login", False),
        ("prefix: something", False),
        ("hotfix: example", False),
        ("fix something", False),
        ("fix(auth) missing colon", False),
        ("fix(): empty scope", False),
        ("fix!: breaking change", False),
        ("feat: login\nfix: later line", False),
        ("\nfix: second line", False),
        ("", False),
    ],
)
def test_bug_fix_detection(message, expected):
    assert is_bug_fix(message) is expected


def test_monthly_grouping_across_years_and_timezones():
    commits = [
        make_commit(1, "2026-01-01T01:00:00+03:00"),
        make_commit(2, "2026-01-15T12:00:00Z"),
        make_commit(3, "2025-11-30T23:30:00-02:00"),
    ]

    grouped = group_commits_by_month(commits)

    assert list(grouped) == ["2025-12", "2026-01"]
    assert grouped["2025-12"] == [commits[0], commits[2]]
    assert grouped["2026-01"] == [commits[1]]


def test_grouping_rejects_date_without_timezone():
    commit = make_commit(1, "2026-01-01T00:00:00")

    with pytest.raises(ValueError):
        group_commits_by_month([commit])


def test_empty_history():
    history = CommitHistory(commits=[], truncated=False)

    garden = generate_garden("dev/demo", history)

    assert group_commits_by_month([]) == {}
    assert garden.total_analyzed_commits == 0
    assert garden.active_months == 0
    assert garden.bug_fix_count == 0
    assert garden.plants == []
    assert garden.flowers == []
    assert garden.hidden_plants == 0
    assert garden.hidden_flowers == 0
    assert garden.truncated is False


def test_monthly_counts_become_growth_stages():
    commits = []
    number = 0

    for month, count in enumerate([1, 5, 15, 30], start=1):
        for _ in range(count):
            commits.append(
                make_commit(
                    number,
                    f"2026-{month:02d}-15T12:00:00Z",
                )
            )
            number += 1

    garden = generate_garden(
        "dev/demo",
        CommitHistory(commits=commits, truncated=False),
    )

    assert [plant.commit_count for plant in garden.plants] == [
        1, 5, 15, 30,
    ]
    assert [plant.stage for plant in garden.plants] == [
        "seedling",
        "small_plant",
        "young_tree",
        "mature_tree",
    ]


def make_large_history() -> CommitHistory:
    commits = []

    # 13 активных месяцев, по два исправления в каждом.
    for index in range(13):
        year = 2025 + index // 12
        month = index % 12 + 1

        for _ in range(2):
            commits.append(
                make_commit(
                    len(commits),
                    f"{year}-{month:02d}-15T12:00:00Z",
                    "fix: example",
                )
            )

    return CommitHistory(commits=commits, truncated=True)


def test_display_limits_preserve_overall_statistics():
    garden = generate_garden("dev/demo", make_large_history())

    assert garden.total_analyzed_commits == 26
    assert garden.active_months == 13
    assert garden.bug_fix_count == 26

    assert len(garden.plants) == 12
    assert len(garden.flowers) == 12
    assert garden.hidden_plants == 1
    assert garden.hidden_flowers == 14

    assert garden.plants[0].month == "2025-02"
    assert garden.plants[-1].month == "2026-01"
    assert all(plant.commit_count == 2 for plant in garden.plants)


def test_generation_is_deterministic_and_order_independent():
    history = make_large_history()

    first = generate_garden("dev/demo", history)
    second = generate_garden("dev/demo", history)

    reversed_history = CommitHistory(
        commits=list(reversed(history.commits)),
        truncated=history.truncated,
    )
    third = generate_garden("DEV/DEMO", reversed_history)

    assert first.model_dump() == second.model_dump()
    assert first.model_dump() == third.model_dump()


def test_generation_preserves_input():
    history = make_large_history()
    original = deepcopy(history)

    generate_garden("dev/demo", history)

    assert history == original


@pytest.mark.parametrize("truncated", [False, True])
def test_truncated_flag_is_preserved(truncated):
    history = CommitHistory(
        commits=[
            make_commit(1, "2026-01-01T00:00:00Z"),
        ],
        truncated=truncated,
    )

    garden = generate_garden("dev/demo", history)

    assert garden.truncated is truncated


def test_layout_bounds_and_plant_spacing():
    garden = generate_garden("dev/demo", make_large_history())

    positions = {(plant.x, plant.y) for plant in garden.plants}
    assert len(positions) == len(garden.plants)

    for plant in garden.plants:
        # Размер будущего спрайта: 48 × 56, основание в (x, y).
        assert 0 <= plant.x - 24
        assert plant.x + 24 <= garden.width
        assert 0 <= plant.y - 56
        assert plant.y <= garden.height

    for index, first in enumerate(garden.plants):
        for second in garden.plants[index + 1:]:
            assert (
                abs(first.x - second.x) >= 48
                or abs(first.y - second.y) >= 56
            )

    for flower in garden.flowers:
        assert 4 <= flower.x <= garden.width - 4
        assert 8 <= flower.y <= garden.height


def test_result_can_be_serialized_to_json():
    garden = generate_garden(
        "dev/demo",
        CommitHistory(commits=[], truncated=False),
    )

    assert '"repository":"dev/demo"' in garden.model_dump_json()