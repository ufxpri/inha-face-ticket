from faceticket.adapters.persistence.sqlite_repo import SqliteIssueRepository


def test_record_issue_creates_active_record(tmp_path) -> None:
    repo = SqliteIssueRepository(tmp_path / "issue.db")
    try:
        issue_id = repo.record_issue("WB-001", "A-01", "Kim")

        assert issue_id == 1
        assert repo.list_active() == [
            {
                "id": 1,
                "wristband_id": "WB-001",
                "seat": "A-01",
                "name": "Kim",
                "issued_at": repo.list_active()[0]["issued_at"],
            }
        ]

        active = repo.find_active_by_wristband("WB-001")
        assert active is not None
        assert active.id == 1
        assert active.wristband_id == "WB-001"
        assert active.seat == "A-01"
        assert active.name == "Kim"
    finally:
        repo.close()


def test_record_return_removes_record_from_active_list(tmp_path) -> None:
    repo = SqliteIssueRepository(tmp_path / "issue.db")
    try:
        repo.record_issue("WB-001", "A-01", "Kim")

        assert repo.record_return("WB-001") is True

        assert repo.list_active() == []
        assert repo.find_active_by_wristband("WB-001") is None
        assert repo.record_return("WB-001") is False
    finally:
        repo.close()
