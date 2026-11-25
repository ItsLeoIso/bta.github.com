import unittest

from agent_orchestrator import slugify


class OrchestratorHelpersTest(unittest.TestCase):
    def test_slugify_removes_unsafe_characters(self):
        self.assertEqual(slugify("Phase 7: Art & Polish!"), "phase-7-art-polish")

    def test_slugify_falls_back_for_empty_text(self):
        self.assertEqual(slugify("日本語"), "task")

    def test_slugify_has_a_bounded_length(self):
        self.assertLessEqual(len(slugify("x" * 200)), 36)


if __name__ == "__main__":
    unittest.main()
