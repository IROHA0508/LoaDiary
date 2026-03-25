from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# ──────────────────────────────────────────
# User
# ──────────────────────────────────────────
class UserCreate(BaseModel):
  fingerprint: str
  representative: str

class UserResponse(BaseModel):
  id: str
  fingerprint: str
  representative: str
  created_at: datetime

  model_config = {"from_attributes" : True}

# ──────────────────────────────────────────
# Character
# ──────────────────────────────────────────
class CharacterCreate(BaseModel):
  name: str
  class_name: str
  item_level: Optional[float] = None
  combat_power: Optional[float] = None
  server: str


class CharacterUpdate(BaseModel):
  name: Optional[str] = None
  class_name: Optional[str] = None
  item_level: Optional[float] = None
  combat_power: Optional[float] = None
  server: Optional[str] = None


class CharacterResponse(BaseModel):
  id: str
  user_id: str
  name: str
  class_name: str
  item_level: Optional[float]
  combat_power: Optional[float]
  server: str
  updated_at: datetime

  model_config = {"from_attributes": True}


# ──────────────────────────────────────────
# Raid
# ──────────────────────────────────────────

class RaidCreate(BaseModel):
  # group_code: str
  raid_id: str
  raid_name: str
  difficulty: str
  max_slots: int = Field(ge=1, le=16)   # 슬롯 수를 1~16사이로 제한하는 유효성검사
  created_by: str


class RaidResponse(BaseModel):
  id: str
  # group_code: str
  raid_id: str
  raid_name: str
  difficulty: str
  max_slots: int
  created_by: str
  created_at: datetime

  model_config = {"from_attributes": True}


# ──────────────────────────────────────────
# RaidSlot
# ──────────────────────────────────────────

class RaidSlotCreate(BaseModel):
  character_id: str
  slot_order: int
  role: Optional[str] = None


class RaidSlotResponse(BaseModel):
  id: str
  raid_id: str
  character_id: str
  slot_order: int
  role: Optional[str]

  model_config = {"from_attributes": True}