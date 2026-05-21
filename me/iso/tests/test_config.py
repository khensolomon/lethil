"""
Tests for core.config — preset loading and validation.
Run with: python -m pytest tests/ -v
Or with stdlib unittest: python -m unittest tests.test_config
"""

import sys
import unittest
from pathlib import Path
from tempfile import NamedTemporaryFile

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import config


class TestConfigValidation(unittest.TestCase):
    def _write(self, content: str) -> Path:
        f = NamedTemporaryFile(mode="w", suffix=".yaml", delete=False)
        f.write(content)
        f.close()
        return Path(f.name)

    def test_minimal_valid_preset(self):
        path = self._write("""
autoinstall:
  version: 1
""")
        data, warnings = config.load_preset(path)
        self.assertEqual(data["autoinstall"]["version"], 1)

    def test_missing_autoinstall_fails(self):
        path = self._write("""
builder:
  shared: {}
""")
        with self.assertRaises(config.ConfigError) as ctx:
            config.load_preset(path)
        self.assertIn("autoinstall", str(ctx.exception))

    def test_invalid_yaml_syntax(self):
        path = self._write("""
autoinstall:
  version: 1
  identity: {hostname: test, : missing-key}
""")
        with self.assertRaises(config.ConfigError) as ctx:
            config.load_preset(path)
        self.assertIn("YAML parse error", str(ctx.exception))

    def test_wrong_type_for_packages(self):
        path = self._write("""
autoinstall:
  version: 1
builder:
  ubuntu:
    packages: "not-a-list"
""")
        with self.assertRaises(config.ConfigError) as ctx:
            config.load_preset(path)
        self.assertIn("packages", str(ctx.exception))
        self.assertIn("list[str]", str(ctx.exception))

    def test_unknown_top_level_key_warns(self):
        path = self._write("""
autoinstall:
  version: 1
unknown_top_level_key: xyz
""")
        data, warnings = config.load_preset(path)
        # Unknown TOP-LEVEL key should produce a warning, not an error.
        # (Unknown keys inside autoinstall: are silently passed through to
        # cloud-init, since cloud-init has many evolving fields we don't track.)
        self.assertTrue(
            any("unknown_top_level_key" in w for w in warnings),
            f"Expected warning, got: {warnings}",
        )

    def test_prompt_validation(self):
        path = self._write("""
autoinstall:
  version: 1
builder:
  ubuntu:
    prompts:
      - ask: "Install Foo?"
        default: "yes"
        packages: ["foo"]
""")
        data, warnings = config.load_preset(path)
        prompts = data["builder"]["ubuntu"]["prompts"]
        self.assertEqual(len(prompts), 1)
        self.assertEqual(prompts[0]["ask"], "Install Foo?")

    def test_prompt_missing_ask_fails(self):
        path = self._write("""
autoinstall:
  version: 1
builder:
  ubuntu:
    prompts:
      - default: "yes"
        packages: ["foo"]
""")
        with self.assertRaises(config.ConfigError) as ctx:
            config.load_preset(path)
        self.assertIn("ask", str(ctx.exception))

    def test_choice_validation(self):
        path = self._write("""
autoinstall:
  version: 1
builder:
  debian:
    prompts:
      - ask: "Pick one"
        default: "1"
        choices:
          - label: "Option A"
            packages: ["a"]
          - label: "Option B"
            packages: ["b"]
""")
        data, _ = config.load_preset(path)
        choices = data["builder"]["debian"]["prompts"][0]["choices"]
        self.assertEqual(len(choices), 2)
        self.assertEqual(choices[0]["label"], "Option A")

    def test_loads_real_preset(self):
        """The actual ubuntu-desktop preset should validate cleanly."""
        preset_dir = Path(__file__).resolve().parent.parent / "presets"
        preset = preset_dir / "ubuntu-desktop.yaml"
        if preset.exists():
            data, warnings = config.load_preset(preset)
            self.assertIn("autoinstall", data)
            self.assertIn("builder", data)


class TestPostInstall(unittest.TestCase):
    def test_script_includes_commands(self):
        from core import postinstall
        script = postinstall.build_postinstall_script(
            commands=["apt update", "apt install -y curl"],
            snaps=[{"name": "code", "classic": True}],
        )
        self.assertIn("apt update", script)
        self.assertIn("apt install -y curl", script)
        self.assertIn("snap install code --classic", script)

    def test_script_handles_quotes(self):
        from core import postinstall
        # Single quote in a command — must not break the script
        script = postinstall.build_postinstall_script(
            commands=["echo 'hello world' > /tmp/foo"],
        )
        # The script should be valid bash; the command should appear escaped
        self.assertIn("hello world", script)


class TestPrompts(unittest.TestCase):
    def test_collect_actions_merges_distro_specific(self):
        from core import prompts
        target = {
            "packages": ["common"],
            "ubuntu": {"snaps": ["code|classic"]},
            "debian": {"packages": ["debian-only"]},
        }
        ubuntu_actions = prompts._collect_actions(target, "ubuntu")
        self.assertEqual(ubuntu_actions["packages"], ["common"])
        self.assertEqual(ubuntu_actions["snaps"], ["code|classic"])

        debian_actions = prompts._collect_actions(target, "debian")
        self.assertEqual(debian_actions["packages"], ["common", "debian-only"])
        self.assertEqual(debian_actions["snaps"], [])


if __name__ == "__main__":
    unittest.main()
