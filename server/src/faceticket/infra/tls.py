"""자체 서명(self-signed) TLS 인증서 — 태블릿 등 외부 IP 에서 HTTPS 접근용.

브라우저의 `getUserMedia` 는 `localhost` 외에는 secure context(HTTPS)를 요구하므로,
LAN IP 로 태블릿이 접근하려면 TLS 가 필요하다. 운영 환경이 아니라 학내 시연용이므로
공인 CA 대신 호스트의 모든 IPv4 주소를 SAN 에 넣은 자체 서명 인증서를 자동 발급한다.

태블릿 측은 첫 접속 시 "안전하지 않음" 경고를 한 번 수락해야 한다.
"""
from __future__ import annotations

import datetime as _dt
import ipaddress
import logging
import socket
from pathlib import Path
from typing import Iterable

log = logging.getLogger(__name__)


def _local_ipv4s() -> list[str]:
    """호스트의 모든 IPv4 주소(루프백 포함) 수집."""
    ips: set[str] = {"127.0.0.1"}
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, family=socket.AF_INET):
            ips.add(info[4][0])
    except OSError as e:
        log.debug("gethostname/getaddrinfo failed: %s", e)
    # UDP 트릭으로 기본 라우트 IP 도 확보
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.add(s.getsockname()[0])
    except OSError:
        pass
    return sorted(ips)


def ensure_self_signed_cert(
    cert_path: Path,
    key_path: Path,
    *,
    extra_hosts: Iterable[str] = (),
    valid_days: int = 825,
) -> tuple[Path, Path]:
    """`cert_path`/`key_path` 가 없으면 자체 서명 인증서를 생성.

    SAN 에 호스트의 모든 IPv4 + localhost + `extra_hosts` 를 포함시켜
    태블릿이 LAN IP 로 접근해도 호스트네임 검증이 통과되게 한다.
    """
    cert_path = Path(cert_path)
    key_path = Path(key_path)
    if cert_path.exists() and key_path.exists():
        return cert_path, key_path

    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "TLS 자동 생성에는 `cryptography` 패키지가 필요합니다 (보통 bleak 와 함께 설치됨)."
        ) from e

    cert_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.parent.mkdir(parents=True, exist_ok=True)

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = _dt.datetime.now(_dt.timezone.utc)
    subject = issuer = x509.Name(
        [x509.NameAttribute(NameOID.COMMON_NAME, "inha-face-ticket (self-signed)")]
    )

    san_entries: list[x509.GeneralName] = [x509.DNSName("localhost")]
    for host in {*_local_ipv4s(), *extra_hosts}:
        try:
            san_entries.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            san_entries.append(x509.DNSName(host))

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - _dt.timedelta(minutes=5))
        .not_valid_after(now + _dt.timedelta(days=valid_days))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    log.info(
        "self-signed TLS cert generated: %s (SAN=%s)",
        cert_path,
        [str(e.value) for e in san_entries],
    )
    return cert_path, key_path
