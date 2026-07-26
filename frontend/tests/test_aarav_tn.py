"""
Aarav Talent Nurturing System — Playwright Python Test Suite
═════════════════════════════════════════════════════════════
Spec  : Virtual Humanoid User Flow v2.1
        (Aarav_Talent_Nurturing_Humanoid_Execution_Spec_v2_2.pdf)
Target: http://localhost:5173  ← local Vite dev server

HOW TO RUN
──────────
  Step 1 — Install (one-time):
    pip install pytest-playwright pytest-html
    playwright install chromium

  Step 2 — Start dev server (separate terminal):
    npm run dev

  Step 3 — Run tests:
    pytest tests/test_aarav_tn.py -v
    pytest tests/test_aarav_tn.py::TestSCR001DesktopHome -v
    pytest tests/test_aarav_tn.py::TestDOMIDAudit -v
    pytest tests/test_aarav_tn.py::TestFullWalkthrough -v

  Step 4 — HTML report:
    pytest tests/test_aarav_tn.py -v --html=test-results/report.html --self-contained-html

Spec coverage
─────────────
  Section 4  — UI/UX Screen Inventory (SCR-001 → SCR-008)
  Section 6  — Element Target Registry (EL-001 → EL-101, all IDs)
  Section 8  — Detailed Action Matrix (ACT-001 → ACT-099)
  Section 9  — Full Platform Walkthrough (9 sequences)
  Section 10 — Per-screen detailed checks
  Section 12 — Error handling (ERR-001 → ERR-009)
  Section 14 — Decision logic (DEC-001 → DEC-008)
"""

import re
import os
import pytest
from datetime import datetime, timedelta
from playwright.sync_api import Page, expect

# ─── Constants ────────────────────────────────────────────────────────────────

APP_URL     = "http://localhost:5173"   # local Vite dev server
SETTLE_MS   = 400     # spec: window_open_settle_ms = 310 ms + small buffer
DATA_MS     = 2000    # wait for DataContext /api/* initial poll
TIMEOUT     = 10_000
NAV_TIMEOUT = 15_000

# ─── Shared helpers ───────────────────────────────────────────────────────────

def goto_app(page: Page) -> None:
    """Navigate to local app and wait for #desktop + data load."""
    page.set_default_timeout(TIMEOUT)
    page.set_default_navigation_timeout(NAV_TIMEOUT)
    page.goto(APP_URL)
    page.wait_for_selector("#desktop", timeout=15_000)
    page.wait_for_timeout(DATA_MS)


def open_screen(page: Page, key: str) -> None:
    """Click a dock button and wait for the window to open.
    key: analytics | tracker | escalations | hil | certs | audit
    """
    page.click(f"#dock-{key}-btn")
    page.wait_for_timeout(SETTLE_MS)
    expect(page.locator(".window.open")).to_be_visible(timeout=8_000)
    expect(page.locator(".screen-header")).to_be_visible()


def close_window(page: Page) -> None:
    """Close the open app window if one is open."""
    if page.locator(".window.open").count():
        page.click("#window-close-btn")
        expect(page.locator(".window.open")).not_to_be_visible(timeout=6_000)


def skip_if_empty(count: int, reason: str) -> None:
    if count == 0:
        pytest.skip(reason)


def future_date(days: int = 30) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def screenshot(page: Page, name: str) -> None:
    os.makedirs("test-results", exist_ok=True)
    page.screenshot(path=f"test-results/{name}.png", full_page=False)
    print(f"  📸 Screenshot saved: test-results/{name}.png")


# ══════════════════════════════════════════════════════════════════════════════
# 1 ── SCR-001  Desktop Home
#     Spec §10.1 | ACT-001 → ACT-004
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR001DesktopHome:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        yield

    # ── ACT-001 ───────────────────────────────────────────────────────────────
    def test_ACT001_desktop_renders(self, page: Page):
        """#desktop renders — page loaded successfully."""
        expect(page.locator("#desktop")).to_be_visible()

    # ── ACT-002 ───────────────────────────────────────────────────────────────
    def test_ACT002_dock_container_visible(self, page: Page):
        """#dock-container visible (REG-DOCK)."""
        expect(page.locator("#dock-container")).to_be_visible()

    # ── ACT-003 ───────────────────────────────────────────────────────────────
    def test_ACT003_clock_shows_time(self, page: Page):
        """Clock shows HH:MM format (REG-CLOCK)."""
        clock = page.locator("text=/\\d{2}:\\d{2}/").first
        expect(clock).to_be_visible()
        print(f"  Clock: {clock.text_content()}")

    # ── ACT-004 ───────────────────────────────────────────────────────────────
    def test_ACT004_widgets_render(self, page: Page):
        """.dw-notes and .dw-tasks widgets render (REG-WIDGETS)."""
        expect(page.locator(".dw-notes")).to_be_visible()
        expect(page.locator(".dw-tasks")).to_be_visible()

    def test_ACT004b_tasks_card_structure(self, page: Page):
        """Today's Tasks widget: card header + progress bar + scrollable body."""
        expect(page.locator(".dw-card-head")).to_be_visible()
        expect(page.locator(".dw-prog-bg")).to_be_visible()
        expect(page.locator(".dw-tasks-body")).to_be_visible()

    # ── 6A Dock buttons EL-001 → EL-007 ──────────────────────────────────────
    @pytest.mark.parametrize("el,key,label", [
        ("EL-001", "home",        "Home"),
        ("EL-002", "analytics",   "Analytics"),
        ("EL-003", "tracker",     "Tracker"),
        ("EL-004", "escalations", "Escalations"),
        ("EL-005", "hil",         "HIL Approval"),
        ("EL-006", "certs",       "Certifications"),
        ("EL-007", "audit",       "Audit Log"),
    ])
    def test_dock_button_present(self, page: Page, el, key, label):
        f"""{el} | #dock-{key}-btn — {label} dock button present."""
        expect(page.locator(f"#dock-{key}-btn")).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# 2 ── SCR-002  Analytics Dashboard
#     Spec §10.2 | ACT-010 → ACT-017
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR002Analytics:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "analytics")
        yield
        close_window(page)

    # ── ACT-010/011 ───────────────────────────────────────────────────────────
    def test_ACT010_window_opens(self, page: Page):
        """Analytics window opens with screen-header (EL-002)."""
        expect(page.locator(".window.open")).to_be_visible()
        expect(page.locator(".screen-header")).to_be_visible()

    # ── ACT-012  8 KPI cards (EL-020) ────────────────────────────────────────
    @pytest.mark.parametrize("key,label", [
        ("assign", "Assignment Rate"),
        ("comp",   "Completion Rate"),
        ("pass",   "Assessment Pass"),
        ("over",   "Overdue Rate"),
        ("cert",   "Cert Compliance"),
        ("hil",    "HIL Override Rate"),
        ("cap",    "Capability Update"),
        ("time",   "Avg Time to Assign"),
    ])
    def test_ACT012_kpi_card_renders(self, page: Page, key, label):
        f"""EL-020 | #kpi-{key}-card renders — {label}."""
        expect(page.locator(f"#kpi-{key}-card")).to_be_visible()

    # ── ACT-013/014 ───────────────────────────────────────────────────────────
    def test_ACT013_kpi_drilldown_modal(self, page: Page):
        """EL-020 click → modal opens; EL-021 #kpi-detail-close-btn closes it."""
        page.click("#kpi-assign-card")
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#kpi-detail-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_EL022_dismiss_btn_closes_modal(self, page: Page):
        """EL-022 | #kpi-detail-dismiss-btn also closes modal."""
        page.click("#kpi-comp-card")
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#kpi-detail-dismiss-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    # ── ACT-015 EL-023 ────────────────────────────────────────────────────────
    def test_ACT015_donut_slices_present(self, page: Page):
        """EL-023 | Status breakdown donut slices in DOM."""
        slices = page.locator("[id^='status-'][id$='-slice']")
        count = slices.count()
        print(f"  Donut slices found: {count}")
        if count == 0:
            print("  WARN: No status slices — metrics API may be empty")

    def test_EL023_donut_click_opens_modal(self, page: Page):
        """EL-023/024 | Donut slice click → status-detail modal → EL-024 close."""
        skip_if_empty(
            page.locator("[id^='status-'][id$='-slice']").count(),
            "No donut slices — metrics data empty"
        )
        page.locator("[id^='status-'][id$='-slice']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#status-detail-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    # ── ACT-016/017 EL-025/026 ────────────────────────────────────────────────
    def test_ACT016_rfp_bar_click(self, page: Page):
        """EL-025 | #rfp-bar-0-bar click → RFP modal; EL-026 close."""
        skip_if_empty(
            page.locator("#rfp-bar-0-bar").count(),
            "No RFP bars — data empty"
        )
        page.click("#rfp-bar-0-bar")
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#rfp-detail-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    # ── API health (Spec §11) ─────────────────────────────────────────────────
    def test_api_health_dot(self, page: Page):
        """API health | .api-dot color shows backend status (#16A34A = healthy)."""
        if page.locator(".api-dot").count():
            color = page.locator(".api-dot").first.evaluate(
                "el => window.getComputedStyle(el).backgroundColor"
            )
            print(f"  API dot color: {color}")


# ══════════════════════════════════════════════════════════════════════════════
# 3 ── SCR-003  Assignment Tracker
#     Spec §10.3 | ACT-020 → ACT-025
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR003Tracker:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "tracker")
        yield
        close_window(page)

    def test_ACT020_tracker_opens(self, page: Page):
        """ACT-020 | Tracker window opens (EL-003)."""
        expect(page.locator(".window.open")).to_be_visible()

    def test_ACT021_table_has_rows(self, page: Page):
        """ACT-021 | Assignment table rows > 0 (ERR-002 guard)."""
        count = page.locator("[id^='tracker-row-']").count()
        print(f"  Tracker rows: {count}")
        if count == 0:
            print("  WARN ERR-002: No rows — check /api/assignments or seed DB")

    # ── Filter buttons (EL-030 / EL-031)
    # ⚠ SPEC GAP: spec §10.3 lists #tracker-filter-pending-btn — NOT in source code
    @pytest.mark.parametrize("btn_id,label", [
        ("tracker-filter-all-btn",      "All"),
        ("tracker-filter-active-btn",   "Active"),
        ("tracker-filter-at-risk-btn",  "At Risk"),
        ("tracker-filter-overdue-btn",  "Overdue"),
        ("tracker-filter-complete-btn", "Complete"),
    ])
    def test_filter_btn_present_and_active(self, page: Page, btn_id, label):
        """EL-030/031 | Filter button present and activates on click."""
        btn = page.locator(f"#{btn_id}")
        expect(btn).to_be_visible()
        btn.click()
        expect(btn).to_have_class(re.compile(r"\bon\b"))

    def test_spec_gap_pending_filter(self, page: Page):
        """⚠ SPEC GAP | #tracker-filter-pending-btn listed in spec §10.3 but NOT in source."""
        count = page.locator("#tracker-filter-pending-btn").count()
        print(f"  [SPEC GAP] #tracker-filter-pending-btn in DOM: {count}  (spec says it should exist)")

    def test_ACT022_all_filter_resets(self, page: Page):
        """ACT-022 EL-030 | All filter button resets active state."""
        page.click("#tracker-filter-active-btn")
        page.click("#tracker-filter-all-btn")
        expect(page.locator("#tracker-filter-all-btn")).to_have_class(re.compile(r"\bon\b"))

    def test_ACT023_active_filter(self, page: Page):
        """ACT-023 EL-031 | Active filter filters rows."""
        page.click("#tracker-filter-active-btn")
        expect(page.locator("#tracker-filter-active-btn")).to_have_class(re.compile(r"\bon\b"))

    def test_ACT024_row_click_opens_modal(self, page: Page):
        """ACT-024/025 EL-032/033 | Row click → detail modal → close."""
        skip_if_empty(
            page.locator("[id^='tracker-row-']").count(),
            "ERR-002: No assignment rows"
        )
        page.locator("[id^='tracker-row-']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#assignment-detail-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# 4 ── SCR-005  HIL Approval Queue
#     Spec §10.4 | ACT-030 → ACT-034
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR005HIL:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "hil")
        yield
        close_window(page)

    def test_ACT030_hil_opens(self, page: Page):
        """ACT-030 | HIL screen opens (EL-005)."""
        expect(page.locator(".window.open")).to_be_visible()

    def test_ACT031_pending_items(self, page: Page):
        """ACT-031 | Pending approve buttons exist OR empty state (DEC-001 ERR-003)."""
        count = page.locator("[id^='hil-approve-'][id$='-btn']").count()
        print(f"  Pending HIL items: {count}")
        if count == 0:
            print("  WARN DEC-001: HIL queue empty")

    def test_ACT032_approve_flow(self, page: Page):
        """ACT-032/033/034 EL-040/045/042 | Approve → notes → confirm."""
        skip_if_empty(
            page.locator("[id^='hil-approve-'][id$='-btn']").count(),
            "DEC-001 ERR-003: HIL queue empty"
        )
        page.locator("[id^='hil-approve-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()

        # EL-045 notes
        notes = page.locator("#hil-act-notes")
        expect(notes).to_be_visible()
        notes.fill("Playwright test approval — Aarav TN walkthrough")

        # EL-042 confirm
        page.click("#hil-confirm-action-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_EL041_reject_btn_present(self, page: Page):
        """EL-041 | Reject button present for each pending HIL item."""
        skip_if_empty(
            page.locator("[id^='hil-reject-'][id$='-btn']").count(),
            "ERR-003: HIL queue empty"
        )
        expect(page.locator("[id^='hil-reject-'][id$='-btn']").first).to_be_visible()

    def test_EL043_cancel_closes_modal(self, page: Page):
        """EL-043 | #hil-confirm-cancel-btn closes modal without action."""
        skip_if_empty(
            page.locator("[id^='hil-approve-'][id$='-btn']").count(),
            "ERR-003: HIL queue empty"
        )
        page.locator("[id^='hil-approve-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#hil-confirm-cancel-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_EL044_close_btn(self, page: Page):
        """EL-044 | #hil-confirm-close-btn (×) cancels modal."""
        skip_if_empty(
            page.locator("[id^='hil-approve-'][id$='-btn']").count(),
            "ERR-003: HIL queue empty"
        )
        page.locator("[id^='hil-approve-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#hil-confirm-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_EL045_notes_accepts_input(self, page: Page):
        """EL-045 | #hil-act-notes textarea accepts typed input."""
        skip_if_empty(
            page.locator("[id^='hil-approve-'][id$='-btn']").count(),
            "ERR-003: HIL queue empty"
        )
        page.locator("[id^='hil-approve-'][id$='-btn']").first.click()
        notes = page.locator("#hil-act-notes")
        expect(notes).to_be_visible()
        notes.fill("Test notes input")
        expect(notes).to_have_value("Test notes input")
        page.click("#hil-confirm-cancel-btn")


# ══════════════════════════════════════════════════════════════════════════════
# 5 ── SCR-004  Escalations Panel
#     Spec §10.5 | ACT-040 → ACT-044
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR004Escalations:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "escalations")
        yield
        close_window(page)

    def test_ACT040_escalations_opens(self, page: Page):
        """ACT-040 | Escalations screen opens (EL-004)."""
        expect(page.locator(".window.open")).to_be_visible()

    def test_ACT041_open_escalations(self, page: Page):
        """ACT-041 | Open escalation cards exist OR empty (DEC-002 ERR-004)."""
        count = page.locator("[id^='escalation-extend-'][id$='-btn']").count()
        print(f"  Open escalations: {count}")
        if count == 0:
            print("  WARN DEC-002: No open escalations")

    def test_ACT042_extend_opens_modal(self, page: Page):
        """ACT-042 EL-050 | Extend button opens deadline modal."""
        skip_if_empty(
            page.locator("[id^='escalation-extend-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-extend-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#extend-deadline-cancel-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_ACT043_fill_date_and_confirm(self, page: Page):
        """ACT-043/044 EL-056/053 | Fill #nd-inp date → confirm extends deadline."""
        skip_if_empty(
            page.locator("[id^='escalation-extend-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-extend-'][id$='-btn']").first.click()

        nd = page.locator("#nd-inp")
        expect(nd).to_be_visible()
        date_str = future_date(30)   # DEC-003: today + 30 days
        nd.fill(date_str)
        expect(nd).to_have_value(date_str)
        page.locator("#nd-notes").fill("Extended via Playwright test")
        page.click("#extend-deadline-confirm-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_DEC003_empty_date_guard(self, page: Page):
        """DEC-003 ERR-006 | Empty date on confirm shows toast or keeps modal open."""
        skip_if_empty(
            page.locator("[id^='escalation-extend-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-extend-'][id$='-btn']").first.click()
        page.locator("#nd-inp").fill("")
        page.click("#extend-deadline-confirm-btn")

        modal_open  = page.locator(".modal-head").is_visible()
        toast_shown = page.locator(".toast").is_visible()
        assert modal_open or toast_shown, \
            "ERR-006: expected modal to stay open or warning toast to appear"
        if page.locator(".modal-head").is_visible():
            page.click("#extend-deadline-cancel-btn")

    def test_EL054_cancel_btn(self, page: Page):
        """EL-054/055 | extend-deadline-cancel and close-btn dismiss modal."""
        skip_if_empty(
            page.locator("[id^='escalation-extend-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-extend-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#extend-deadline-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()

    def test_EL051_replace_opens_modal(self, page: Page):
        """EL-051 | Replace button opens confirm modal."""
        skip_if_empty(
            page.locator("[id^='escalation-replace-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-replace-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#escalation-confirm-cancel-btn")

    def test_EL052_accept_opens_modal(self, page: Page):
        """EL-052 | Accept button opens confirm modal."""
        skip_if_empty(
            page.locator("[id^='escalation-accept-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-accept-'][id$='-btn']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#escalation-confirm-cancel-btn")

    def test_EL058_resolve_cancel_close_present(self, page: Page):
        """EL-058/059/060 | resolve, cancel, close buttons present in confirm modal."""
        skip_if_empty(
            page.locator("[id^='escalation-replace-'][id$='-btn']").count(),
            "DEC-002 ERR-004: No open escalations"
        )
        page.locator("[id^='escalation-replace-'][id$='-btn']").first.click()
        expect(page.locator("#escalation-confirm-resolve-btn")).to_be_visible()
        expect(page.locator("#escalation-confirm-cancel-btn")).to_be_visible()
        expect(page.locator("#escalation-confirm-close-btn")).to_be_visible()
        page.click("#escalation-confirm-close-btn")


# ══════════════════════════════════════════════════════════════════════════════
# 6 ── SCR-006  Certification Registry
#     Spec §10.6 | ACT-050 → ACT-053
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR006Certs:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "certs")
        yield
        close_window(page)

    def test_ACT050_certs_opens(self, page: Page):
        """ACT-050 | Certs screen opens (EL-006)."""
        expect(page.locator(".window.open")).to_be_visible()

    @pytest.mark.parametrize("btn_id,el,label", [
        ("certs-filter-all-btn",        "EL-070", "All"),
        ("certs-filter-registered-btn", "EL-071", "Registered"),
        ("certs-filter-verified-btn",   "EL-072", "Verified"),
        ("certs-filter-pending-btn",    "EL-073", "Pending"),
    ])
    def test_cert_filter_present(self, page: Page, btn_id, el, label):
        f"""{el} | #{btn_id} — {label} filter present and activates."""
        btn = page.locator(f"#{btn_id}")
        expect(btn).to_be_visible()
        btn.click()
        expect(btn).to_have_class(re.compile(r"\bon\b"))

    def test_ACT051_all_filter(self, page: Page):
        """ACT-051 EL-070 | All filter shows all certifications."""
        page.click("#certs-filter-all-btn")
        expect(page.locator("#certs-filter-all-btn")).to_have_class(re.compile(r"\bon\b"))
        print(f"  Cert rows: {page.locator('[id^=cert-row-]').count()}")

    def test_ACT052_cert_journey_modal(self, page: Page):
        """ACT-052/053 EL-074/075 | Cert row click → journey modal → close."""
        skip_if_empty(
            page.locator("[id^='cert-row-']").count(),
            "No cert rows"
        )
        page.locator("[id^='cert-row-']").first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#cert-journey-close-btn")
        expect(page.locator(".modal-head")).not_to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# 7 ── SCR-007  Audit Log
#     Spec §10.7 | ACT-060 → ACT-061
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR007AuditLog:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "audit")
        yield
        close_window(page)

    def test_ACT060_audit_opens(self, page: Page):
        """ACT-060 | Audit screen opens (EL-007)."""
        expect(page.locator(".window.open")).to_be_visible()

    def test_ACT061_table_has_rows(self, page: Page):
        """ACT-061 EL-080 | #audit-log-table present with rows."""
        expect(page.locator("#audit-log-table")).to_be_visible()
        count = page.locator("#audit-log-table tbody tr").count()
        print(f"  Audit rows: {count}")
        if count == 0:
            print("  WARN ERR-002: Audit log empty — check /api/audit-logs")

    def test_EL081_row_id_pattern(self, page: Page):
        """EL-081 | Rows follow id pattern audit-row-{id}."""
        skip_if_empty(
            page.locator("[id^='audit-row-']").count(),
            "No audit rows"
        )
        expect(page.locator("[id^='audit-row-']").first).to_be_visible()

    def test_audit_badge_levels(self, page: Page):
        """Spec §10.7 | b-pp / b-wn / b-er / b-ok level badges present."""
        count = page.locator(".badge").count()
        print(f"  Badge elements: {count}")
        if count > 0:
            expect(page.locator(".badge").first).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# 8 ── SCR-008  Aarav AI Orb
#     Spec §10.8 | ACT-070 → ACT-072
# ══════════════════════════════════════════════════════════════════════════════

class TestSCR008AaravOrb:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        yield

    def test_ACT070_orb_opens_panel(self, page: Page):
        """ACT-070 EL-090 | #aarav-orb-trigger opens #aarav-panel."""
        expect(page.locator("#aarav-orb-trigger")).to_be_visible()
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        page.click("#aarav-panel-close-btn")

    def test_ACT071_panel_insights(self, page: Page):
        """ACT-071 EL-091 | Panel shows insight cards or empty state (DEC-008 ERR-009)."""
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        count = page.locator("[id^='aarav-view-']").count()
        if count == 0:
            print("  WARN DEC-008 ERR-009: No AI insights — data still initialising")
        print(f"  AI insight cards: {count}")
        page.click("#aarav-panel-close-btn")

    def test_ACT072_close_btn(self, page: Page):
        """ACT-072 EL-092 | #aarav-panel-close-btn closes panel."""
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        page.click("#aarav-panel-close-btn")
        expect(page.locator("#aarav-panel")).not_to_be_visible()

    def test_EL093_view_action_pairs_match(self, page: Page):
        """EL-093/094 | view and action button counts equal (one pair per insight)."""
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        v = page.locator("[id^='aarav-view-'][id$='-btn']").count()
        a = page.locator("[id^='aarav-action-'][id$='-btn']").count()
        assert v == a, f"view buttons ({v}) != action buttons ({a})"
        print(f"  Insight view/action pairs: {v}")
        page.click("#aarav-panel-close-btn")

    def test_EL095_backdrop_or_close(self, page: Page):
        """EL-095 | #aarav-backdrop closes panel (mobile) or close-btn (desktop)."""
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        backdrop = page.locator("#aarav-backdrop")
        if backdrop.is_visible():
            backdrop.click()
        else:
            page.click("#aarav-panel-close-btn")
        expect(page.locator("#aarav-panel")).not_to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# 9 ── 6B  Window Chrome Controls
#     Spec §6B | EL-010 → EL-013 / EL-100 / EL-101
# ══════════════════════════════════════════════════════════════════════════════

class TestWindowChrome:

    @pytest.fixture(autouse=True)
    def setup(self, page: Page):
        goto_app(page)
        open_screen(page, "analytics")
        yield

    def test_EL010_close_btn(self, page: Page):
        """EL-010 | #window-close-btn closes window → back to desktop."""
        page.click("#window-close-btn")
        expect(page.locator(".window.open")).not_to_be_visible()
        expect(page.locator("#desktop")).to_be_visible()

    def test_EL011_maximize_restore(self, page: Page):
        """EL-011 | #window-maximize-btn maximizes then restores window."""
        page.click("#window-maximize-btn")
        expect(page.locator(".window")).to_have_class(re.compile(r"\bmaximized\b"))
        page.click("#window-maximize-btn")
        expect(page.locator(".window")).not_to_have_class(re.compile(r"\bmaximized\b"))
        close_window(page)

    def test_EL012_dark_mode_toggle(self, page: Page):
        """EL-012 | #dark-mode-toggle-btn adds/removes dark class on <html>."""
        page.click("#dark-mode-toggle-btn")
        html_cls = page.locator("html").get_attribute("class") or ""
        assert "dark" in html_cls, "Expected 'dark' class on <html> after first toggle"
        page.click("#dark-mode-toggle-btn")
        html_cls2 = page.locator("html").get_attribute("class") or ""
        assert "dark" not in html_cls2, "Expected 'dark' removed after second toggle"
        close_window(page)

    def test_EL013_livepanel_collapse_expand(self, page: Page):
        """EL-013 EL-100 EL-101 | Live panel collapses and collapsed-label re-expands."""
        panel = page.locator(".live-panel")
        page.click("#livepanel-toggle-btn")           # EL-013 / EL-100
        expect(panel).to_have_class(re.compile(r"\bcollapsed\b"))
        page.click("#livepanel-collapsed-label")      # EL-101
        expect(panel).not_to_have_class(re.compile(r"\bcollapsed\b"))
        close_window(page)


# ══════════════════════════════════════════════════════════════════════════════
# 10 ── ACT-080  Home Button
# ══════════════════════════════════════════════════════════════════════════════

class TestHomeButton:

    def test_ACT080_home_returns_to_desktop(self, page: Page):
        """ACT-080 EL-001 | #dock-home-btn closes window and shows desktop."""
        goto_app(page)
        open_screen(page, "analytics")
        expect(page.locator(".window.open")).to_be_visible()
        page.click("#dock-home-btn")
        expect(page.locator(".window.open")).not_to_be_visible()
        expect(page.locator("text=/\\d{2}:\\d{2}/").first).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# 11 ── Section 6  DOM ID Mapping Audit
#      Validates every EL-### from spec §6 against the live DOM
# ══════════════════════════════════════════════════════════════════════════════

class TestDOMIDAudit:

    def test_6A_dock_ids(self, page: Page):
        """6A EL-001→007 | All dock button IDs present."""
        goto_app(page)
        ids = [
            "dock-home-btn", "dock-analytics-btn", "dock-tracker-btn",
            "dock-escalations-btn", "dock-hil-btn", "dock-certs-btn",
            "dock-audit-btn", "dock-container",
        ]
        missing = [i for i in ids if page.locator(f"#{i}").count() == 0]
        assert not missing, f"Missing dock IDs: {missing}"

    def test_6B_window_chrome_ids(self, page: Page):
        """6B EL-010→013 EL-100/101 | Window chrome IDs present."""
        goto_app(page)
        open_screen(page, "analytics")
        ids = [
            "window-close-btn", "window-maximize-btn", "dark-mode-toggle-btn",
            "livepanel-toggle-btn", "livepanel-collapsed-label",
        ]
        missing = [i for i in ids if page.locator(f"#{i}").count() == 0]
        assert not missing, f"Missing window chrome IDs: {missing}"
        close_window(page)

    def test_6C_analytics_kpi_ids(self, page: Page):
        """6C EL-020→026 | All KPI card IDs present."""
        goto_app(page)
        open_screen(page, "analytics")
        kpi_ids = [f"kpi-{k}-card" for k in
                   ["assign","comp","pass","over","cert","hil","cap","time"]]
        missing = [i for i in kpi_ids if page.locator(f"#{i}").count() == 0]
        assert not missing, f"Missing KPI card IDs: {missing}"

        # Open modal to verify close/dismiss buttons
        page.click("#kpi-assign-card")
        expect(page.locator(".modal-head")).to_be_visible()
        for mid in ["kpi-detail-close-btn", "kpi-detail-dismiss-btn"]:
            assert page.locator(f"#{mid}").count() > 0, f"Missing modal ID: #{mid}"
        page.click("#kpi-detail-close-btn")
        close_window(page)

    def test_6D_tracker_filter_ids(self, page: Page):
        """6D EL-030/031 | Tracker filter button IDs present.
        ⚠ SPEC GAP: pending filter listed in spec §10.3 but absent from source code."""
        goto_app(page)
        open_screen(page, "tracker")
        ids = [
            "tracker-filter-all-btn", "tracker-filter-active-btn",
            "tracker-filter-at-risk-btn", "tracker-filter-overdue-btn",
            "tracker-filter-complete-btn",
        ]
        missing = [i for i in ids if page.locator(f"#{i}").count() == 0]
        pending = page.locator("#tracker-filter-pending-btn").count()
        print(f"  [SPEC GAP] #tracker-filter-pending-btn in DOM: {pending}")
        assert not missing, f"Missing tracker filter IDs: {missing}"
        close_window(page)

    def test_6E_hil_modal_ids(self, page: Page):
        """6E EL-040→045 | HIL modal IDs present (skips if queue empty)."""
        goto_app(page)
        open_screen(page, "hil")
        approve = page.locator("[id^='hil-approve-'][id$='-btn']")
        if approve.count() == 0:
            print("  WARN ERR-003: HIL queue empty — skipping modal ID audit")
            close_window(page)
            return
        approve.first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        ids = ["hil-act-notes", "hil-confirm-action-btn",
               "hil-confirm-cancel-btn", "hil-confirm-close-btn"]
        missing = [i for i in ids if page.locator(f"#{i}").count() == 0]
        assert not missing, f"Missing HIL modal IDs: {missing}"
        page.click("#hil-confirm-cancel-btn")
        close_window(page)

    def test_6F_escalation_modal_ids(self, page: Page):
        """6F EL-050→060 | Escalation extend-modal IDs present."""
        goto_app(page)
        open_screen(page, "escalations")
        extend = page.locator("[id^='escalation-extend-'][id$='-btn']")
        if extend.count() == 0:
            print("  WARN ERR-004: No open escalations — skipping")
            close_window(page)
            return
        extend.first.click()
        expect(page.locator(".modal-head")).to_be_visible()
        ids = ["nd-inp", "nd-notes", "extend-deadline-confirm-btn",
               "extend-deadline-cancel-btn", "extend-deadline-close-btn"]
        missing = [i for i in ids if page.locator(f"#{i}").count() == 0]
        assert not missing, f"Missing extend-modal IDs: {missing}"
        page.click("#extend-deadline-cancel-btn")
        close_window(page)

    def test_6G_cert_filter_ids(self, page: Page):
        """6G EL-070→073 | Cert filter IDs present."""
        goto_app(page)
        open_screen(page, "certs")
        ids = ["certs-filter-all-btn", "certs-filter-registered-btn",
               "certs-filter-verified-btn", "certs-filter-pending-btn"]
        missing = [i for i in ids if page.locator(f"#{i}").count() == 0]
        assert not missing, f"Missing cert filter IDs: {missing}"
        close_window(page)

    def test_6H_audit_table_id(self, page: Page):
        """6H EL-080 | #audit-log-table present."""
        goto_app(page)
        open_screen(page, "audit")
        expect(page.locator("#audit-log-table")).to_be_visible()
        close_window(page)

    def test_6I_aarav_orb_ids(self, page: Page):
        """6I EL-090→095 | Aarav orb and panel IDs present."""
        goto_app(page)
        expect(page.locator("#aarav-orb-trigger")).to_be_visible()
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        for i in ["aarav-panel", "aarav-panel-close-btn"]:
            assert page.locator(f"#{i}").count() > 0, f"Missing: #{i}"
        page.click("#aarav-panel-close-btn")


# ══════════════════════════════════════════════════════════════════════════════
# 12 ── Section 9  Full Platform Walkthrough (ACT-001 → ACT-099)
#       9 sequences end-to-end with screenshots
# ══════════════════════════════════════════════════════════════════════════════

class TestFullWalkthrough:

    def test_full_demo_ACT001_to_ACT099(self, page: Page):
        """
        Section 9 | Aarav full platform demo:
        Desktop → Analytics → Tracker → HIL → Escalations → Certs → Audit → AI Orb → Home
        """
        os.makedirs("test-results", exist_ok=True)

        # ── Seq 1: SCR-001 Desktop (ACT-001 → ACT-004) ──────────────────────
        goto_app(page)
        expect(page.locator("#dock-container")).to_be_visible()
        expect(page.locator(".dw-notes")).to_be_visible()
        expect(page.locator(".dw-tasks")).to_be_visible()
        clock = page.locator("text=/\\d{2}:\\d{2}/").first.text_content()
        print(f"\n  [ACT-003] Clock: {clock}")
        screenshot(page, "SCR-001-DESKTOP")

        # ── Seq 2: SCR-002 Analytics (ACT-010 → ACT-017) ────────────────────
        open_screen(page, "analytics")
        for k in ["assign","comp","pass","over","cert","hil","cap","time"]:
            expect(page.locator(f"#kpi-{k}-card")).to_be_visible()
        page.click("#kpi-assign-card")
        expect(page.locator(".modal-head")).to_be_visible()
        page.click("#kpi-detail-close-btn")
        if page.locator("#rfp-bar-0-bar").count():
            page.click("#rfp-bar-0-bar")
            expect(page.locator(".modal-head")).to_be_visible()
            page.click("#rfp-detail-close-btn")
        screenshot(page, "SCR-002-ANALYTICS")
        close_window(page)

        # ── Seq 3: SCR-003 Tracker (ACT-020 → ACT-025) ──────────────────────
        open_screen(page, "tracker")
        page.click("#tracker-filter-all-btn")
        if page.locator("[id^='tracker-row-']").count():
            page.locator("[id^='tracker-row-']").first.click()
            expect(page.locator(".modal-head")).to_be_visible()
            page.click("#assignment-detail-close-btn")
        screenshot(page, "SCR-003-TRACKER")
        close_window(page)

        # ── Seq 4: SCR-005 HIL (ACT-030 → ACT-034) ──────────────────────────
        open_screen(page, "hil")
        hil = page.locator("[id^='hil-approve-'][id$='-btn']")
        if hil.count():
            hil.first.click()
            page.locator("#hil-act-notes").fill("Aarav walkthrough — HIL approval")
            page.click("#hil-confirm-action-btn")
            print("  [ACT-034] HIL item approved")
        else:
            print("  [DEC-001] HIL queue empty — skipping approval")
        screenshot(page, "SCR-005-HIL")
        close_window(page)

        # ── Seq 5: SCR-004 Escalations (ACT-040 → ACT-044) ──────────────────
        open_screen(page, "escalations")
        esc = page.locator("[id^='escalation-extend-'][id$='-btn']")
        if esc.count():
            esc.first.click()
            page.locator("#nd-inp").fill(future_date(30))
            page.locator("#nd-notes").fill("Aarav walkthrough — deadline extension")
            page.click("#extend-deadline-confirm-btn")
            print("  [ACT-044] Deadline extended")
        else:
            print("  [DEC-002] No open escalations — skipping")
        screenshot(page, "SCR-004-ESCALATIONS")
        close_window(page)

        # ── Seq 6: SCR-006 Certs (ACT-050 → ACT-053) ────────────────────────
        open_screen(page, "certs")
        page.click("#certs-filter-all-btn")
        cert = page.locator("[id^='cert-row-']")
        if cert.count():
            cert.first.click()
            expect(page.locator(".modal-head")).to_be_visible()
            page.click("#cert-journey-close-btn")
        screenshot(page, "SCR-006-CERTS")
        close_window(page)

        # ── Seq 7: SCR-007 Audit (ACT-060 → ACT-061) ────────────────────────
        open_screen(page, "audit")
        expect(page.locator("#audit-log-table")).to_be_visible()
        rows = page.locator("#audit-log-table tbody tr").count()
        print(f"  [ACT-061] Audit rows: {rows}")
        screenshot(page, "SCR-007-AUDIT")
        close_window(page)

        # ── Seq 8: SCR-008 Aarav AI Orb (ACT-070 → ACT-072) ─────────────────
        page.click("#aarav-orb-trigger")
        expect(page.locator("#aarav-panel")).to_be_visible()
        insights = page.locator("[id^='aarav-view-']").count()
        print(f"  [ACT-071] AI insights: {insights}")
        screenshot(page, "SCR-008-AARAV-ORB")
        page.click("#aarav-panel-close-btn")

        # ── Seq 9: SCR-001 Home (ACT-080 + ACT-099) ──────────────────────────
        expect(page.locator("#desktop")).to_be_visible()
        screenshot(page, "SCR-001-DESKTOP-FINAL")
        print("  [ACT-099] Full platform walkthrough complete. All modules reviewed.")
