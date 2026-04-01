from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ──────────────────────────────────────────
# User
# ──────────────────────────────────────────
class UserCreate(BaseModel):
  fingerprint: str
  representative: str

class UserResponse(BaseModel):
  id: str
  fingerprint: Optional[str] = None   # 임시 유저(fingerprint=None)도 허용
  representative: str
  created_at: datetime

  model_config = {"from_attributes": True}

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
  is_support: Optional[bool] = False
  updated_at: datetime

  model_config = {"from_attributes": True}


# ──────────────────────────────────────────
# Raid
# ──────────────────────────────────────────

class RaidCreate(BaseModel):
  raid_id: str
  raid_name: str
  difficulty: str
  max_slots: int = Field(ge=1, le=16)
  created_by: str


class RaidResponse(BaseModel):
  id: str
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
  character_name: Optional[str] = None
  class_name: Optional[str] = None
  is_support: Optional[bool] = None
  item_level: Optional[float] = None
  slot_order: int
  role: Optional[str]

  model_config = {"from_attributes": True}


# ──────────────────────────────────────────
# RaidMember
# ──────────────────────────────────────────

class RaidMemberCreate(BaseModel):
  representative: str


class RaidMemberResponse(BaseModel):
  id: str
  raid_id: str
  user_id: str
  added_by: str
  created_at: datetime

  model_config = {"from_attributes": True}


class RaidMemberWithCharacters(BaseModel):
  user_id: str
  representative: str
  characters: List[CharacterResponse]


# ──────────────────────────────────────────
# 주간 참여 완료 슬롯
# ──────────────────────────────────────────
class WeeklyUsedSlotResponse(BaseModel):
  raid_instance_id: str
  character_id: str

  model_config = {"from_attributes": True}