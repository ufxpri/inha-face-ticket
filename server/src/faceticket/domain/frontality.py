"""정면도 검사 — 5점 키포인트(눈, 코, 입꼬리) 기반 순수 규칙.

MTCNN 의존성을 끊고 numpy 만으로 동작 → 단위 테스트 가능. `FaceEngine` 의 `_check_frontal`
정적 메서드에서 추출했다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional, Sequence

from faceticket.config import FRONTAL


@dataclass(frozen=True)
class FrontalityResult:
    ok: bool
    reason: Optional[str] = None
    metrics: dict = field(default_factory=dict)


Landmark = Sequence[float]   # (x, y)


def check_frontal(
    box: Sequence[float],          # (x1, y1, x2, y2)
    prob: Optional[float],
    landmarks: Sequence[Landmark], # [eye_l, eye_r, nose, mouth_l, mouth_r]
    img_width: int,
) -> FrontalityResult:
    """프로파일/기울임/거리 검사. 통과 시 ok=True."""
    metrics: dict = {}

    if prob is None or prob < FRONTAL["min_prob"]:
        return FrontalityResult(False, f"검출 신뢰도 낮음 (p={float(prob or 0):.2f})", metrics)

    x1, y1, x2, y2 = box
    bw = max(1e-6, x2 - x1)

    if (bw / max(1e-6, img_width)) < FRONTAL["min_bbox_ratio"]:
        return FrontalityResult(False, "얼굴이 너무 작음 — 더 가까이 와주세요", metrics)

    eye_l, eye_r, nose, mouth_l, mouth_r = landmarks

    # Roll — 두 눈 잇는 선의 수평 기울기 (°)
    dx = float(eye_r[0] - eye_l[0])
    dy = float(eye_r[1] - eye_l[1])
    roll = abs(math.degrees(math.atan2(dy, dx)))
    if roll > 90:
        roll = abs(180 - roll)
    metrics["roll"] = roll
    if roll > FRONTAL["max_roll"]:
        return FrontalityResult(False, f"고개 기울어짐 (roll {roll:.0f}°)", metrics)

    # Yaw — 코/입중심이 두 눈 중심으로부터 좌우로 벗어난 비율
    eye_mid_x   = (eye_l[0]   + eye_r[0])   / 2.0
    mouth_mid_x = (mouth_l[0] + mouth_r[0]) / 2.0
    nose_off    = abs(float(nose[0]) - eye_mid_x) / bw
    mouth_off   = abs(mouth_mid_x - eye_mid_x) / bw
    yaw = max(nose_off, mouth_off)
    metrics["yaw"] = yaw
    if yaw > FRONTAL["max_yaw"]:
        return FrontalityResult(False, f"옆얼굴 감지 (yaw {yaw:.2f})", metrics)

    # Pitch — 코 수직 위치 = (코y - 눈선y) / (입선y - 눈선y)
    eye_mid_y   = (eye_l[1]   + eye_r[1])   / 2.0
    mouth_mid_y = (mouth_l[1] + mouth_r[1]) / 2.0
    if (mouth_mid_y - eye_mid_y) < 1e-3:
        return FrontalityResult(False, "키포인트 비정상", metrics)
    pitch = float(nose[1] - eye_mid_y) / float(mouth_mid_y - eye_mid_y)
    metrics["pitch"] = pitch
    if pitch < FRONTAL["pitch_min"]:
        return FrontalityResult(False, f"고개가 위로 들림 (pitch {pitch:.2f})", metrics)
    if pitch > FRONTAL["pitch_max"]:
        return FrontalityResult(False, f"고개가 아래로 숙여짐 (pitch {pitch:.2f})", metrics)

    return FrontalityResult(True, None, metrics)
