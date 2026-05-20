"""얼굴 임베딩 추출 + 정면도 게이트 + 코사인 유사도.

PyTorch 기반 facenet-pytorch 사용:
    - MTCNN 으로 얼굴 검출 + 5점 키포인트(눈, 코, 입꼬리) 추출
    - 키포인트로 정면도(roll/yaw/pitch + 거리)를 검사하여 측면·기울임을 거부
    - 통과한 얼굴만 InceptionResnetV1(pretrained='vggface2') 로 512-d 임베딩 추출

facenet-pytorch 미설치 환경에서는 이미지 해시 기반 의사 임베딩으로 폴백한다.
"""
from __future__ import annotations

import hashlib
import io
import math
from typing import Optional, Tuple

import numpy as np
from PIL import Image

from app.config import EMBED_DIM, FRONTAL

HAS_ML = False
_IMPORT_ERR = ""

try:
    import torch
    from facenet_pytorch import MTCNN, InceptionResnetV1
    HAS_ML = True
except BaseException as _e:
    _IMPORT_ERR = repr(_e)


class FaceEngine:
    def __init__(self) -> None:
        self.has_ml = HAS_ML        # 모델 로드 가능 여부 (불변)
        self.force_stub = False     # 런타임 토글 — True 면 모델이 있어도 stub 사용
        self.device = None
        self.mtcnn = None
        self.resnet = None

        if not HAS_ML:
            print(f"[FACE] facenet-pytorch 사용 불가({_IMPORT_ERR}) — 의사 임베딩 모드")
            return

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[FACE] PyTorch device = {self.device}")
        self.mtcnn = MTCNN(image_size=160, margin=20, post_process=True,
                           select_largest=True, keep_all=False, device=self.device)
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        print("[FACE] facenet-pytorch 모델 로드 완료 (InceptionResnetV1 / vggface2, 512-d)")

    @property
    def is_ml_active(self) -> bool:
        return self.has_ml and not self.force_stub

    # ── 정면도 검사 ────────────────────────────────────
    @staticmethod
    def _check_frontal(box, prob, landmarks, img_w) -> Tuple[bool, Optional[str], dict]:
        """5점 키포인트로 정면도 검사. (ok, reason, metrics) 반환."""
        metrics: dict = {}
        if prob is None or prob < FRONTAL["min_prob"]:
            return False, f"검출 신뢰도 낮음 (p={float(prob or 0):.2f})", metrics

        x1, y1, x2, y2 = box
        bw = max(1e-6, x2 - x1)
        bh = max(1e-6, y2 - y1)

        # 너무 멀면 정면이어도 임베딩 품질이 떨어진다 — 거부
        if (bw / max(1e-6, img_w)) < FRONTAL["min_bbox_ratio"]:
            return False, "얼굴이 너무 작음 — 더 가까이 와주세요", metrics

        eye_l   = landmarks[0]
        eye_r   = landmarks[1]
        nose    = landmarks[2]
        mouth_l = landmarks[3]
        mouth_r = landmarks[4]

        # Roll — 두 눈을 잇는 선의 수평 기울기(°)
        dx = float(eye_r[0] - eye_l[0])
        dy = float(eye_r[1] - eye_l[1])
        roll = abs(math.degrees(math.atan2(dy, dx)))
        # 좌/우 식별이 뒤바뀐 경우(아주 큰 roll) 보정
        if roll > 90:
            roll = abs(180 - roll)
        metrics["roll"] = roll
        if roll > FRONTAL["max_roll"]:
            return False, f"고개 기울어짐 (roll {roll:.0f}°) — 똑바로 봐주세요", metrics

        # Yaw — 코/입중심이 두 눈 중심으로부터 좌우로 얼마나 벗어났나
        eye_mid_x  = (eye_l[0]   + eye_r[0])   / 2.0
        mouth_mid_x = (mouth_l[0] + mouth_r[0]) / 2.0
        nose_off   = abs(float(nose[0]) - eye_mid_x) / bw
        mouth_off  = abs(mouth_mid_x - eye_mid_x) / bw
        yaw = max(nose_off, mouth_off)
        metrics["yaw"] = yaw
        if yaw > FRONTAL["max_yaw"]:
            return False, f"옆얼굴 감지 — 정면을 바라봐 주세요 (yaw {yaw:.2f})", metrics

        # Pitch — 코 수직 위치 = (코y - 눈선y) / (입선y - 눈선y)
        eye_mid_y   = (eye_l[1]   + eye_r[1])   / 2.0
        mouth_mid_y = (mouth_l[1] + mouth_r[1]) / 2.0
        if (mouth_mid_y - eye_mid_y) < 1e-3:
            return False, "키포인트 비정상", metrics
        pitch = float(nose[1] - eye_mid_y) / float(mouth_mid_y - eye_mid_y)
        metrics["pitch"] = pitch
        if pitch < FRONTAL["pitch_min"]:
            return False, f"고개가 위로 들림 (pitch {pitch:.2f})", metrics
        if pitch > FRONTAL["pitch_max"]:
            return False, f"고개가 아래로 숙여짐 (pitch {pitch:.2f})", metrics

        return True, None, metrics

    # ── 임베딩 추출 ───────────────────────────────────
    def extract(self, img_bytes: bytes) -> Tuple[Optional[np.ndarray], Optional[str]]:
        """(embedding, reason). 얼굴 검출/정면 검증 실패 시 (None, 사유)."""
        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception as e:
            return None, f"이미지 디코드 실패: {e}"

        if self.is_ml_active:
            try:
                boxes, probs, lmks = self.mtcnn.detect(img, landmarks=True)
                if boxes is None or len(boxes) == 0:
                    return None, "얼굴 미검출 — 카메라 정면으로 와주세요"

                # select_largest=True 이므로 첫 번째가 가장 큰 얼굴
                box   = boxes[0]
                prob  = float(probs[0]) if probs is not None else 0.0
                lmk   = lmks[0]

                ok, reason, metrics = self._check_frontal(box, prob, lmk, img.width)
                print(f"[FACE] det prob={prob:.3f} metrics={ {k: round(v, 3) for k, v in metrics.items()} } -> {'OK' if ok else reason}")
                if not ok:
                    return None, reason

                # 정면도 통과 — 크롭은 __call__ 이 알아서 (재검출 비용 ≈ 같은 입력 캐시 효과로 미미)
                face_tensor = self.mtcnn(img)
                if face_tensor is None:
                    return None, "얼굴 크롭 실패"
                if face_tensor.ndim == 3:
                    face_tensor = face_tensor.unsqueeze(0)

                with torch.no_grad():
                    emb = self.resnet(face_tensor.to(self.device))
                v = emb.detach().cpu().numpy().ravel().astype(np.float32)
                n = float(np.linalg.norm(v))
                if n > 1e-8:
                    v = v / n
                return v, None
            except Exception as e:
                print(f"[FACE] 임베딩 추출 실패: {e}")
                return None, f"임베딩 추출 오류: {e}"

        # 폴백: 결정적 의사 임베딩
        h = hashlib.sha256(img_bytes).digest()
        rng = np.random.RandomState(int.from_bytes(h[:4], "big"))
        v = rng.randn(EMBED_DIM).astype(np.float32)
        return v / (np.linalg.norm(v) + 1e-8), None

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        a = np.asarray(a, dtype=np.float32).ravel()
        b = np.asarray(b, dtype=np.float32).ravel()
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        if denom < 1e-8:
            return 0.0
        return float(np.dot(a, b) / denom)
