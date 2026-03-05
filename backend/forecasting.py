import pandas as pd
import pmdarima as pm
from supabase import create_client, Client
import os

url = os.environ.get("VITE_SUPABASE_URL", "")
key = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

supabase: Client = None
if url and key:
    supabase = create_client(url, key)

def generate_traffic_forecast(intersection_id: str = "BLR-CORE-1"):
    """
    Pulls real historical traffic density from Supabase and applies an AutoARIMA
    time-series forecasting model to predict congestion over the next sequence.
    """
    if not supabase:
        return {"status": "error", "message": "Supabase client not initialized."}
        
    try:
        response = supabase.table("traffic_data").select("created_at, density").eq("intersection_id", intersection_id).order("created_at", desc=False).limit(100).execute()
        data = response.data
        if not data or len(data) < 10:
            return {"status": "insufficient_data", "message": "Need at least 10 data points physically saved in DB to forecast."}
            
        df = pd.DataFrame(data)
        df['created_at'] = pd.to_datetime(df['created_at'])
        df.set_index('created_at', inplace=True)
        density_series = df['density'].astype(float)
        
        # Fit AutoARIMA - pure predictive math based on real HW telemetry
        model = pm.auto_arima(density_series, seasonal=False, stepwise=True, suppress_warnings=True, error_action="ignore")
        
        # Predict next 5 steps
        predictions = model.predict(n_periods=5)
        preds_list = [round(float(p), 1) for p in predictions]
        
        try:
            supabase.table("signal_logs").insert({
                "agent_name": "AutoARIMA-Forecaster",
                "action": "Congestion Prediction",
                "message": f"Next 5 steps predicted density: {preds_list}",
                "log_type": "INFO"
            }).execute()
        except Exception as e:
            print("AutoARIMA logging exception:", e)
        
        return {
            "status": "success",
            "model_type": "AutoARIMA (True RL Prediction)",
            "historical_baseline": float(density_series.iloc[-1]),
            "predictions": preds_list
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    print(generate_traffic_forecast())
