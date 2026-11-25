import io
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from agent_orchestrator import (
    get_repo_snapshot,
    is_protected_path,
    safe_extract_snapshot,
    slugify,
    wait_for_interaction,
)


def make_tar(entries):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for name, payload in entries:
            data = payload if isinstance(payload, bytes) else payload.encode("utf-8")
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


class FakeEnvironmentFiles:
    def __init__(self):
        self.downloaded = []

    def list(self, *, environment, path, recursive=False):
        self.list_args = (environment, path, recursive)
        return SimpleNamespace(
            files=[
                SimpleNamespace(type="FILE", path="workspace/bta/README.md"),
                SimpleNamespace(type="FILE", path="workspace/bta/src/game.js"),
                SimpleNamespace(type="DIRECTORY", path="workspace/bta/src"),
                SimpleNamespace(type="FILE", path="workspace/bta/node_modules/pkg/index.js"),
            ]
        )

    def download(self, *, environment, path):
        self.downloaded.append((environment, path))
        return {
            "workspace/bta/README.md": b"# BTA",
            "workspace/bta/src/game.js": b"export const game = true;",
        }[path]


class OrchestratorHelpersTest(unittest.TestCase):
    def test_slugify_removes_unsafe_characters(self):
        self.assertEqual(slugify("Phase 7: Art & Polish!"), "phase-7-art-polish")

    def test_slugify_falls_back_for_empty_text(self):
        self.assertEqual(slugify("日本語"), "task")

    def test_slugify_has_a_bounded_length(self):
        self.assertLessEqual(len(slugify("x" * 200)), 36)

    def test_snapshot_export_lists_recursively_and_downloads_files(self):
        files = FakeEnvironmentFiles()
        client = SimpleNamespace(environments=SimpleNamespace(files=files))

        snapshot = get_repo_snapshot(client, "env_test")

        self.assertEqual(files.list_args, ("env_test", "workspace/bta", True))
        self.assertEqual(
            files.downloaded,
            [
                ("env_test", "workspace/bta/README.md"),
                ("env_test", "workspace/bta/src/game.js"),
            ],
        )
        with tarfile.open(fileobj=io.BytesIO(snapshot), mode="r:") as archive:
            self.assertEqual(
                sorted(archive.getnames()),
                ["README.md", "src/game.js"],
            )

    def test_snapshot_extraction_strips_repository_root(self):
        snapshot = make_tar([
            ("workspace/bta/README.md", "# BTA"),
            ("workspace/bta/src/game.js", "export const game = true;"),
        ])
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp)
            safe_extract_snapshot(snapshot, destination)
            self.assertEqual((destination / "README.md").read_text(), "# BTA")
            self.assertTrue((destination / "src/game.js").exists())

    def test_snapshot_extraction_rejects_parent_traversal(self):
        snapshot = make_tar([("../escape.txt", "no")])
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(RuntimeError):
                safe_extract_snapshot(snapshot, Path(temp))
            self.assertFalse((Path(temp).parent / "escape.txt").exists())

    def test_agent_cannot_change_gitignore_or_workflows(self):
        self.assertTrue(is_protected_path(".gitignore"))
        self.assertTrue(is_protected_path(".github/workflows/node-tests.yml"))
        self.assertTrue(is_protected_path("scripts/agent_orchestrator.py"))
        self.assertFalse(is_protected_path("src/game.js"))

    def test_interaction_completion_returns_result(self):
        interaction = SimpleNamespace(id="int_123", status="completed", output_text="done")
        result = wait_for_interaction(SimpleNamespace(), interaction)
        self.assertIs(result, interaction)

    def test_incomplete_interaction_fails_without_polling_forever(self):
        interaction = SimpleNamespace(id="int_123", status="incomplete", output_text="")
        with self.assertRaisesRegex(RuntimeError, "incomplete"):
            wait_for_interaction(SimpleNamespace(), interaction)


if __name__ == "__main__":
    unittest.main()
