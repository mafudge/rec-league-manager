import os

import requests
import streamlit as st

API_URL = os.environ.get("API_URL", "http://localhost:8000")


def backend_status() -> str:
    try:
        r = requests.get(f"{API_URL}/api/health", timeout=3)
        r.raise_for_status()
        return r.json()["status"]
    except Exception:
        return "backend unreachable"


st.title("Rec League Manager")
st.write(f"Backend: {backend_status()}")
