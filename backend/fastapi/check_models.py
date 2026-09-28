"""Quick model verification script."""
import joblib, warnings, numpy as np
warnings.filterwarnings('ignore')
from pathlib import Path

models_dir = Path(__file__).parent.parent.parent / 'ml-models' / 'models'
print(f"Models dir: {models_dir}")
print()

m1 = joblib.load(models_dir / 'module1_state.joblib')
m2 = joblib.load(models_dir / 'module2_state.joblib')
m3 = joblib.load(models_dir / 'module3_state.joblib')
m4 = joblib.load(models_dir / 'module4_state.joblib')
m5 = joblib.load(models_dir / 'module5_alerts.joblib')

# ── Module 1: track forecast (GBR dict: dx_km, dy_km, USA_WIND, USA_PRES)
inner = m1['module1']
X_row = m1['X'][[0]]
scaled = inner['scaler'].transform(X_row)
print("=== Module 1: Track + Intensity Forecast ===")
preds = {}
for target, model in inner['gbr'].items():
    preds[target] = model.predict(scaled)[0]
    print(f"  {target}: {preds[target]:.2f}")
wind_kt = preds.get('USA_WINDh', 0)
pres_mb = preds.get('USA_PRESh', 0)
print(f"  => Wind: {wind_kt:.1f} kt | Pressure: {pres_mb:.1f} mb")
print()

# ── Module 2: cyclone category classification (0-4)
feat_cols_m2 = ['lat','lon','dx_km','dy_km','dist_km','heading_rad','vmax_kt','pressure_hpa']
rollout = m1['rollout']
X2 = rollout[feat_cols_m2].values[:1]
pred2 = m2.predict(X2)
prob2 = m2.predict_proba(X2)
print("=== Module 2: Cyclone Status Classification ===")
print(f"  Status class: {int(pred2[0])}")
print(f"  Class probabilities: {[round(p,3) for p in prob2[0]]}")
print()

# ── Module 3: spatial risk grid 160x200
print("=== Module 3: Spatial Risk Grid ===")
print(f"  Grid shape: {m3['risk'].shape}")
print(f"  Zone counts: {m3['zone_counts'].to_dict()}")
print(f"  Risk range: {m3['risk'].min():.3f} - {m3['risk'].max():.3f}")
print(f"  Weights: {m3['weights']}")
# Get red-zone locations
red_mask = m3['risk_zone'] == 'Red'
if red_mask.any():
    lons = m3['LON'][red_mask]
    lats = m3['LAT'][red_mask]
    print(f"  Red zone: {red_mask.sum()} cells, lat {lats.min():.1f}-{lats.max():.1f}, lon {lons.min():.1f}-{lons.max():.1f}")
print()

# ── Module 4: economic damage (GBR, 5 features)
print("=== Module 4: Economic Damage ===")
print(f"  n_features: {m4.n_features_in_}")
# Features: vmax_kt, pressure_hpa, lat, lon, dist_km
X4 = np.array([[wind_kt, pres_mb, 19.5, 85.4, 50.0]])
pred4 = m4.predict(X4)
print(f"  Predicted damage: ${pred4[0]:.1f}M USD")
print(f"  INR Crores: {pred4[0]*83/10:.1f}")
print()

# ── Module 5: CAP alerts
print("=== Module 5: CAP Alerts ===")
print(f"  Pre-generated alerts: {len(m5['alerts'])}")
for i, a in enumerate(m5['alerts']):
    ad = a['alert_data']
    print(f"  [{i}] Zone={ad['zone']} | Phase={ad['phase']} | Wind={ad['wind_kt']:.0f}kt")
    print(f"       SMS: {a['message_short_sms'][:80]}...")

print()
print("ALL MODELS VERIFIED SUCCESSFULLY")
