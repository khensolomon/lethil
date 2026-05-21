"""Distro-specific ISO builders."""

from .base import Builder, UserInputs
from .debian import DebianBuilder
from .ubuntu import UbuntuBuilder

__all__ = ["Builder", "UserInputs", "UbuntuBuilder", "DebianBuilder"]

# Registry: maps target name to builder class. Add new distros here.
BUILDERS = {
    "ubuntu": UbuntuBuilder,
    "debian": DebianBuilder,
}
