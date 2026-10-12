#!/usr/bin/env python3
"""Keep the first /qapps response in step with Zenith's screen assets."""

import re
import sys
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / "component/zenith-erp-saas/framework-overrides/webroot/screen/webroot/qapps.xml"
SCREEN = ROOT / "component/zenith-erp-app/screen/zenith/ZenithApp.xml"
ASSETS = ROOT / "component/zenith-erp-app/screen"
STAGING = ROOT / ".github/workflows/staging-acceptance.yml"
QA_WRAPPER = ROOT / "docs/infra/ci/base-overrides/qapps.xml"


def pre_actions(path):
    node = ElementTree.parse(path).getroot().find("pre-actions")
    assert node is not None, f"No pre-actions in {path}"
    return "\n".join(node.itertext())


def styles(script):
    return re.findall(r"html_stylesheets\.add\('([^']+)'\)", script)


def main():
    wrapper = pre_actions(WRAPPER)
    screen = pre_actions(SCREEN)
    expected = styles(screen)
    actual = styles(wrapper)
    assert expected and actual == expected, "First-paint CSS order or cache versions differ from ZenithApp.xml"
    assert len(actual) == len(set(actual)), "Duplicate first-paint stylesheet"
    assert all((ASSETS / url.split("?", 1)[0].lstrip("/")).is_file()
               for url in actual if url.startswith("/zenithstatic/")), "Missing first-paint stylesheet"
    boot = "/zenithstatic/js/qapps-shell-boot.js?v=1"
    assert f"html_scripts.add('{boot}')" in wrapper, "Loading guard must run in the wrapper"
    assert wrapper.index(boot) < wrapper.index("/libs/moment.js/"), "Loading guard must run before framework JS"
    assert "reqPath == '/qapps/zenith' || reqPath.startsWith('/qapps/zenith/')" in wrapper, "Scope assets to Zenith"
    assert QA_WRAPPER.read_bytes() == WRAPPER.read_bytes(), "QA wrapper snapshot differs from the served wrapper"
    assert 'component/zenith-erp-saas/framework-overrides/webroot/screen/webroot/qapps.xml' in STAGING.read_text(), "Staging must install the candidate wrapper"
    print(f"qapps first-paint assets match ZenithApp: {len(actual)} styles; loading guard precedes framework JS")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, ElementTree.ParseError) as exc:
        sys.exit(f"qapps first-paint guard failed: {exc}")
