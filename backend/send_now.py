"""
send_now.py  –  Immediately dispatch a groundwater alert email to all policy makers.
Run: python send_now.py
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, To

# Internal imports for live data
from data.real_data_ingestion import get_all_real_stations_with_status

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()

api_key      = os.getenv("SENDGRID_API_KEY")
sender_email = os.getenv("SENDGRID_SENDER_EMAIL")
receivers    = [e.strip() for e in os.getenv("POLICY_MAKERS_EMAILS", "").split(",") if e.strip()]

# --- Fetch Live Results ---
stations = get_all_real_stations_with_status(limit=5)
critical_stations = [s for s in stations if s["status"] == "critical"]
warning_stations  = [s for s in stations if s["status"] == "warning"]

# Sustainability Index Logic (Matching main.py)
baselines = [s["base_level"] for s in stations]
levels    = [s["waterLevel"] for s in stations]
ratios    = [b / l if l > 0 else 1.0 for b, l in zip(baselines, levels)]
import numpy as np
gsi       = int(np.clip(np.mean(ratios) * 80, 0, 100)) if ratios else 0

current_time_str = datetime.now().strftime("%B %d, %Y, %H:%M IST")

print(f"[FETCHED] {len(stations)} stations")
print(f"[METRICS] Sustainability: {gsi}%, Critical: {len(critical_stations)}, Warning: {len(warning_stations)}")
print(f"[SENDING] To: {receivers}")

# --- Construct Dynamic Badges ---
critical_html = ""
for s in critical_stations:
    critical_html += f"""
    <div class="badge-critical">
      <p class="badge-title">🔴 CRITICAL — Station {s['id']} ({s['region']})</p>
      <p class="badge-body">Current Level: {s['waterLevel']}m (Baseline: {s['base_level']}m). Status: {s['status'].upper()}. Trend: {s['trend'].upper()}.</p>
    </div>
    """

warning_html = ""
for s in warning_stations:
    warning_html += f"""
    <div class="badge-warning">
      <p class="badge-title">🟡 WARNING — Station {s['id']} ({s['region']})</p>
      <p class="badge-body">Current Level: {s['waterLevel']}m (Baseline: {s['base_level']}m). Recovery monitoring recommended.</p>
    </div>
    """

if not critical_html and not warning_html:
    critical_html = "<p style='color:#15803d;'>✅ No critical or warning levels detected across monitored stations.</p>"

HTML_BODY = f"""
<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px; }}
    .card {{ background: #fff; border-radius: 8px; padding: 30px; max-width: 620px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
    .header {{ background: linear-gradient(135deg, #1e3a5f, #2563eb); color: white; border-radius: 8px 8px 0 0; padding: 20px 30px; margin: -30px -30px 24px; }}
    .header h1 {{ margin: 0; font-size: 20px; }}
    .header p  {{ margin: 4px 0 0; opacity: 0.85; font-size: 13px; }}
    .badge-critical {{ background: #fee2e2; color: #b91c1c; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-bottom: 12px; }}
    .badge-warning  {{ background: #fef9c3; color: #92400e; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 12px; }}
    .badge-title {{ font-weight: bold; font-size: 14px; margin: 0 0 4px; }}
    .badge-body  {{ font-size: 13px; margin: 0; }}
    .kpi {{ display: flex; gap: 12px; margin: 20px 0; }}
    .kpi-box {{ flex: 1; background: #f1f5f9; border-radius: 6px; padding: 14px; text-align: center; }}
    .kpi-val {{ font-size: 22px; font-weight: bold; color: #1e3a5f; }}
    .kpi-lbl {{ font-size: 11px; color: #64748b; margin-top: 2px; }}
    .btn {{ display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 16px; }}
    .footer {{ font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; }}
    .suggestion {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px 16px; margin-top: 16px; }}
    .suggestion h4 {{ margin: 0 0 8px; color: #15803d; font-size: 13px; }}
    .suggestion ul {{ margin: 0; padding-left: 18px; font-size: 12px; color: #374151; }}
    .suggestion ul li {{ margin-bottom: 4px; }}
  </style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>🔴 Groundwater Security Alert</h1>
    <p>Computational Groundwater Governance Platform — Automated Alert Dispatch</p>
  </div>

  <p style="color:#374151;font-size:14px;">Dear Policy Maker,</p>
  <p style="color:#374151;font-size:14px;">Our AI system has analyzed the latest data from the National DWLR Network. Below is the real-time summary as of <strong>{current_time_str}</strong>.</p>

  {critical_html}
  {warning_html}

  <!-- KPI Row -->
  <div class="kpi">
    <div class="kpi-box"><div class="kpi-val">{len(stations)}</div><div class="kpi-lbl">Active Stations</div></div>
    <div class="kpi-box"><div class="kpi-val">{gsi}%</div><div class="kpi-lbl">Sustainability Index</div></div>
    <div class="kpi-box"><div class="kpi-val">{len(critical_stations)}</div><div class="kpi-lbl">Critical Alerts</div></div>
    <div class="kpi-box"><div class="kpi-val">{len(warning_stations)}</div><div class="kpi-lbl">Warnings</div></div>
  </div>

  <div class="suggestion">
    <h4>✅ Suggested Actions</h4>
    <ul>
      <li>Review extraction permits in affected zones.</li>
      <li>Deploy rapid groundwater recharge interventions where critical depletion is noted.</li>
      <li>Issue advisory to local boards to optimize water usage.</li>
      <li>Monitor the dashboard for 7-model predictive insights.</li>
    </ul>
  </div>

  <a href="https://groundwater-governance.vercel.app" class="btn">Open Groundwater Dashboard →</a>

  <div class="footer">
    This email is auto-generated by the Computational Groundwater Governance Platform.<br>
    Powered by 7 active ML models — Data extrapolated from Atal Jal dataset.
  </div>
</div>
</body>
</html>
"""

message = Mail(
    from_email=sender_email,
    to_emails=[To(r) for r in receivers],
    subject=f"🔴 URGENT: Groundwater Security Alert ({datetime.now().strftime('%d %b %Y')})",
    html_content=HTML_BODY
)

if not api_key:
    print("\n❌ ERROR: SENDGRID_API_KEY not found in .env")
    sys.exit(1)

try:
    sg = SendGridAPIClient(api_key)
    response = sg.send(message)
    print(f"\n✅ SUCCESS! Status Code: {response.status_code}")
    print(f"   Mail dispatched to: {', '.join(receivers)}")
except Exception as e:
    print(f"\n❌ FAILED: {e}")
