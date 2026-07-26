"""
conftest.py — Shared Playwright fixtures for Aarav TN test suite.
Local dev target: http://localhost:5173
"""
import pytest


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "viewport": {"width": 1440, "height": 900},
        "record_video_dir": "test-results/videos/",
    }


@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args):
    return {
        **browser_type_launch_args,
        "headless": False,
        "slow_mo": 80,
    }
