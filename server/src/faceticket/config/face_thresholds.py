"""얼굴 인증 임곗값.

도메인 캘리브레이션의 결과 — 코드 구조와 무관, 하드웨어/조명/사용자 그룹에 따라 조정한다.
"""
from __future__ import annotations

EMBED_DIM: int = 512                # InceptionResnetV1 (vggface2) 출력
COSINE_THRESHOLD: float = 0.55      # 동일인 ≈ 0.6+, 타인 ≈ 0.0~0.3 — 조명 환경 변경 시 재캘리브레이션

FRONTAL: dict = {
    "min_prob":   0.95,             # MTCNN 검출 신뢰도 하한
    "max_roll":   15.0,             # 두 눈 잇는 선의 수평 기울기 최대 (°)
    "max_yaw":    0.12,             # 코/입 중심이 두 눈 중심에서 좌우로 벗어난 비율
    "pitch_min":  0.30,             # 코 수직 위치 비율 — 너무 위
    "pitch_max":  0.75,             # 너무 아래
    "min_bbox_ratio": 0.18,         # 얼굴 가로 / 이미지 가로 — 너무 멀면 거부
}
