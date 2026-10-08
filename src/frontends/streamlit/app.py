import streamlit as st

from api import API_URL, backend_name


def greeting() -> str:
    try:
        return f"Hello from {backend_name()}"
    except Exception:
        return f"Can't reach the backend at {API_URL}"


st.title("Rec League Manager")
st.write(greeting())
