from pydantic import BaseModel

class Plant(BaseModel):
    month: str
    commit_count: int
    stage: str
    x: int
    y: int

class Flower(BaseModel):
    x: int
    y: int

class GardenData(BaseModel):
    repository: str
    total_analyzed_commits: int
    active_months: int
    bug_fix_count: int
    truncated: bool

    width: int
    height: int

    plant_display_limit: int
    flower_display_limit: int
    hidden_plants: int
    hidden_flowers: int

    plants: list[Plant]
    flowers: list[Flower]

class RepositoryMetadata(BaseModel):
    owner: str
    name: str
    full_name: str
    description: str | None
    stars: int
    html_url: str
    default_branch: str

class GardenResponse(BaseModel):
    repository: RepositoryMetadata
    garden: GardenData