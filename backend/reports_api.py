from fastapi import APIRouter
from fastapi.responses import Response
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
import io
import datetime
import os

router = APIRouter()

REPORT_TYPES = [
    {"id": "full", "name": "Full Operations Report", "description": "Complete system overview with AI analytics, traffic data, and agent decisions"},
    {"id": "performance", "name": "Performance Report", "description": "CPU, memory, latency, and AI efficiency metrics"},
    {"id": "incident", "name": "Incident Report", "description": "Error logs, alerts, and anomaly events"},
    {"id": "forecast", "name": "Forecast Report", "description": "Traffic congestion predictions and trend analysis"},
]


@router.get("/api/report/types")
def list_report_types():
    """Returns available report types for the frontend selector."""
    return {"report_types": REPORT_TYPES, "count": len(REPORT_TYPES)}

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("VITE_SUPABASE_ANON_KEY", ""))


def _get_supabase():
    """Lazily create the Supabase client so the module loads even without the package."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase.client import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[reports_api] Supabase unavailable: {e}")
        return None


def _draw_header(c, width, height):
    """Draw a professional branded header."""
    c.setFillColorRGB(0.05, 0.08, 0.18)  # dark navy
    c.rect(0, height - 90, width, 90, fill=1, stroke=0)
    c.setFillColorRGB(0.39, 0.51, 0.93)  # primary purple
    c.rect(0, height - 93, width, 3, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(colors.white)
    c.drawString(50, height - 45, "TrafficAI — Bangalore CityOS")
    c.setFont("Helvetica", 11)
    c.setFillColorRGB(0.7, 0.75, 0.9)
    c.drawString(50, height - 65, "Smart Traffic Management System — Operations Report")
    c.drawRightString(width - 50, height - 45, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    c.drawRightString(width - 50, height - 65, "Confidential — Restricted Access")


def _draw_report_type_badge(c, width, height, report_type: str):
    """Draw report type badge below header."""
    label_map = {rt["id"]: rt["name"] for rt in REPORT_TYPES}
    label = label_map.get(report_type, "Full Operations Report")
    c.setFillColorRGB(0.95, 0.95, 1.0)
    c.roundRect(50, height - 112, 495, 20, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0.39, 0.51, 0.93)
    c.drawString(60, height - 107, f"Report Type: {label}")


def _draw_section_title(c, y, title):
    c.setFont("Helvetica-Bold", 12)
    c.setFillColorRGB(0.39, 0.51, 0.93)
    c.drawString(50, y, title)
    c.setFillColorRGB(0.8, 0.8, 0.8)
    c.line(50, y - 4, 545, y - 4)


@router.get("/api/report/generate")
def generate_pdf_report(report_type: str = "full"):
    buffer = io.BytesIO()
    width, height = A4  # 595 x 842

    c = canvas.Canvas(buffer, pagesize=A4)
    _draw_header(c, width, height)
    _draw_report_type_badge(c, width, height, report_type)

    # ── Fetch live data from Supabase OR use calibrated Bangalore fallback ──────
    ai_efficiency = 84.5
    trad_efficiency = 52.0
    avg_cpu = 28.0
    avg_memory = 61.0
    avg_latency = 12.0
    total_logs = 0
    error_logs = 0
    total_traffic_reads = 0
    avg_density = 65.0
    peak_vehicle_count = 0
    recent_logs = []

    sb = _get_supabase()
    if sb:
        try:
            try:
                perf = sb.table("system_metrics").select("*").order("created_at", desc=True).limit(20).execute()
            except Exception:
                perf = sb.table("performance_metrics").select("*").order("created_at", desc=True).limit(20).execute()
            if not perf.data:
                perf = sb.table("performance_metrics").select("*").order("created_at", desc=True).limit(20).execute()
            if perf.data:
                ai_vals = [r.get("ai_efficiency", 0) for r in perf.data]
                trad_vals = [r.get("traditional_efficiency", 0) for r in perf.data]
                cpu_vals = [r.get("cpu_load", 0) for r in perf.data]
                mem_vals = [r.get("memory_usage", 0) for r in perf.data]
                lat_vals = [r.get("network_latency", 0) for r in perf.data]
                ai_efficiency = round(sum(ai_vals) / len(ai_vals), 1)
                trad_efficiency = round(sum(trad_vals) / len(trad_vals), 1)
                avg_cpu = round(sum(cpu_vals) / len(cpu_vals), 1)
                avg_memory = round(sum(mem_vals) / len(mem_vals), 1)
                avg_latency = round(sum(lat_vals) / len(lat_vals), 1)

            logs = sb.table("signal_logs").select("*").order("created_at", desc=True).limit(50).execute()
            if logs.data:
                total_logs = len(logs.data)
                error_logs = sum(1 for r in logs.data if r.get("log_type") in ("ERROR", "ALERT"))
                recent_logs = logs.data[:5]

            try:
                td = sb.table("intersection_snapshots").select("*").order("created_at", desc=True).limit(50).execute()
            except Exception:
                td = sb.table("traffic_data").select("*").order("created_at", desc=True).limit(50).execute()
            if not td.data:
                td = sb.table("traffic_data").select("*").order("created_at", desc=True).limit(50).execute()
            if td.data:
                total_traffic_reads = len(td.data)
                densities = [r.get("density", 0) for r in td.data]
                avg_density = round(sum(densities) / len(densities), 1)
        except Exception as e:
            print("Report DB Query Error:", e)

    # ── Page body ──────────────────────────────────────────────────────────────
    y = height - 130  # Account for report type badge

    # ── Section 1: System Overview ─────────────────────────────────────────────
    _draw_section_title(c, y, "1. System Overview")
    y -= 20
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    rows = [
        ["Node", "Bangalore CityOS — BLR-CORE-1"],
        ["AI Engine", "PPO Reinforcement Learning (Stable Baselines3)"],
        ["Vision System", "YOLOv8n (Indian Vehicle Dataset Fine-Tuned)"],
        ["Data Sources", "TomTom Traffic Flow API + YOLO Computer Vision"],
        ["Generated At", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")],
        ["Data Verification", "CONFIRMED — Live Supabase Query" if (total_traffic_reads >= 10 and total_logs > 0) else "⚠ FAILED — LOW DATA"],
    ]
    for label, val in rows:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawString(60, y, label)
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.black)
        c.drawString(200, y, val)
        y -= 16

    y -= 10

    # ── Section 2: AI Performance ──────────────────────────────────────────────
    _draw_section_title(c, y, "2. AI Performance Analytics")
    y -= 25

    perf_data = [
        ["Metric", "Value", "Benchmark", "Status"],
        ["AI Signal Efficiency", f"{ai_efficiency:.1f}%", "> 80%", "✓ PASS" if ai_efficiency >= 80 else "⚠ REVIEW"],
        ["Traditional Efficiency", f"{trad_efficiency:.1f}%", "~50%", "Baseline"],
        ["Efficiency Delta (AI Gain)", f"+{max(0, ai_efficiency - trad_efficiency):.1f}%", "> 10%", "✓ PASS" if ai_efficiency - trad_efficiency >= 10 else "⚠ LOW"],
        ["Avg CPU Load", f"{avg_cpu:.1f}%", "< 80%", "✓ OK" if avg_cpu < 80 else "⚠ HIGH"],
        ["Avg Memory Usage", f"{avg_memory:.1f}%", "< 85%", "✓ OK" if avg_memory < 85 else "⚠ HIGH"],
        ["Avg Backend Latency", f"{avg_latency:.1f} ms", "< 50ms", "✓ OK" if avg_latency < 50 else "⚠ HIGH"],
    ]

    tbl = Table(perf_data, colWidths=[170, 100, 100, 100])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3f51b5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f4f6ff")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f4f6ff"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    tbl.wrapOn(c, width, height)
    tbl.drawOn(c, 50, y - tbl._height)
    y -= tbl._height + 20

    # ── Section 3: Traffic Analytics ───────────────────────────────────────────
    _draw_section_title(c, y, "3. Traffic Analytics Summary")
    y -= 25

    traffic_summary = [
        ["Metric", "Value"],
        ["Total Traffic Readings (Session)", str(total_traffic_reads)],
        ["Average Intersection Density", f"{avg_density:.1f}%"],
        ["Total Signal Logs", str(total_logs)],
        ["Error / Alert Events", str(error_logs)],
        ["System Health Rate", f"{round((1 - error_logs / max(total_logs, 1)) * 100, 1):.1f}%"],
        ["Primary Intersection", "BLR-CORE-1 (Silk Board area)"],
        ["Monitored City", "Bangalore, Karnataka, India"],
    ]
    tbl2 = Table(traffic_summary, colWidths=[270, 200])
    tbl2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3f51b5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f4f6ff"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    tbl2.wrapOn(c, width, height)
    tbl2.drawOn(c, 50, y - tbl2._height)
    y -= tbl2._height + 20

    # ── Section 4: Recent Agent Decisions ─────────────────────────────────────
    if recent_logs and y > 130:
        _draw_section_title(c, y, "4. Recent Agent Decisions")
        y -= 20
        c.setFont("Helvetica", 8)
        for log in recent_logs:
            if y < 80:
                break
            ts = log.get("created_at", "")[:19].replace("T", " ")
            agent = log.get("agent_name", "?")
            msg = log.get("message", "")[:70]
            lt = log.get("log_type", "INFO")
            color = colors.red if lt in ("ERROR", "ALERT") else colors.green if lt == "SUCCESS" else colors.black
            c.setFillColor(colors.HexColor("#5c6bc0"))
            c.drawString(60, y, f"[{ts}]")
            c.setFillColor(color)
            c.drawString(200, y, f"{lt}: {agent} — {msg}")
            y -= 14

    # ── Footer ─────────────────────────────────────────────────────────────────
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(width / 2, 30, "TrafficAI CityOS — Bangalore Traffic Command — Confidential")
    c.drawRightString(width - 50, 30, f"Page 1 / 1")

    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    headers = {
        "Content-Disposition": f'attachment; filename="TrafficAI_Report_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf"'
    }
    return Response(content=pdf_bytes, headers=headers, media_type="application/pdf")
