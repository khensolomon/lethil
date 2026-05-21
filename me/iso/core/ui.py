"""
Terminal UI helpers: colored output, prompts, password input.

All output goes through these helpers so behavior (colors, unattended mode,
indentation) is consistent across the codebase.
"""

import getpass
import sys

# Module-level flag for unattended execution. Set by build.py at startup.
UNATTENDED = False


class Colors:
    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def _supports_color() -> bool:
    """Disable colors when output isn't a TTY (e.g. piped to a file)."""
    return sys.stdout.isatty()


def _c(color: str, text: str) -> str:
    return f"{color}{text}{Colors.ENDC}" if _supports_color() else text


def print_header(text: str) -> None:
    bar = "=" * 56
    print(f"\n{_c(Colors.HEADER + Colors.BOLD, bar)}")
    print(f"{_c(Colors.HEADER + Colors.BOLD, '   ' + text)}")
    print(f"{_c(Colors.HEADER + Colors.BOLD, bar)}")


def print_step(text: str) -> None:
    print(f"\n{_c(Colors.OKBLUE + Colors.BOLD, '==> ' + text)}")


def print_info(text: str) -> None:
    print(f"{_c(Colors.OKBLUE, '[INFO]')} {text}")


def print_success(text: str) -> None:
    print(f"{_c(Colors.OKGREEN, '[ OK ]')} {text}")


def print_warning(text: str) -> None:
    print(f"{_c(Colors.WARNING, '[WARN]')} {text}")


def print_error(text: str, exit_code: int = 1) -> None:
    """Print an error and exit. Use raise ConfigError instead when recoverable."""
    print(f"{_c(Colors.FAIL, '[FAIL]')} {text}", file=sys.stderr)
    sys.exit(exit_code)


def ask_input(prompt_text: str, default_val: str = "") -> str:
    if UNATTENDED:
        print(f"{_c(Colors.OKBLUE, '[AUTO]')} {prompt_text}: {default_val}")
        return default_val
    suffix = f" [{default_val}]" if default_val else ""
    val = input(f"{_c(Colors.WARNING, prompt_text + suffix + ': ')}").strip()
    return val if val else default_val


def ask_yes_no(prompt_text: str, default: str = "yes") -> bool:
    is_yes_default = str(default).lower() in ("y", "yes", "true", "1")
    if UNATTENDED:
        print(f"{_c(Colors.OKBLUE, '[AUTO]')} {prompt_text}: {'Yes' if is_yes_default else 'No'}")
        return is_yes_default

    hint = "[Y/n]" if is_yes_default else "[y/N]"
    val = input(f"{_c(Colors.WARNING, prompt_text + ' ' + hint + ': ')}").strip().lower()
    if not val:
        return is_yes_default
    return val in ("y", "yes")


def ask_choice(question: str, choices: list, default: int = 1) -> int:
    """
    Display a numbered menu. Default is 1-based for human friendliness.
    Returns 0-based index.
    """
    if UNATTENDED:
        idx = max(0, min(len(choices) - 1, int(default) - 1))
        print(f"{_c(Colors.OKBLUE, '[AUTO]')} {question}: {choices[idx]}")
        return idx

    print(_c(Colors.WARNING, question))
    for i, choice in enumerate(choices, 1):
        marker = " (default)" if i == default else ""
        print(f"  {i}. {choice}{marker}")

    while True:
        val = input(f"{_c(Colors.WARNING, f'Select [1-{len(choices)}] [{default}]: ')}").strip()
        if not val:
            return int(default) - 1
        try:
            idx = int(val)
            if 1 <= idx <= len(choices):
                return idx - 1
        except ValueError:
            pass
        print(f"  Please enter a number between 1 and {len(choices)}.")


def ask_password(prompt_text: str) -> str:
    if UNATTENDED:
        print(f"{_c(Colors.OKBLUE, '[AUTO]')} {prompt_text}: (skipped)")
        return ""
    return getpass.getpass(f"{_c(Colors.WARNING, prompt_text + ': ')}")


def set_unattended(value: bool) -> None:
    global UNATTENDED
    UNATTENDED = value
