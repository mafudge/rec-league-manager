import streamlit as st

from api import API_URL, BackendRefused, backend_name, hello


def greeting() -> str:
    try:
        return f"Hello from {backend_name()}"
    except Exception:
        return f"Can't reach the backend at {API_URL}"


def say_hello(name: str) -> str:
    """The backend's greeting, its refusal, or where we looked. The name is sent as typed."""
    try:
        return hello(name)
    except BackendRefused as e:
        return str(e)
    except Exception:
        return f"Can't reach the backend at {API_URL}"


st.title("Rec League Manager")
st.write(greeting())

# A form, so pressing Enter in the box submits it like the button does.
with st.form("say_hello"):
    name = st.text_input("Your name", key="name")
    asked = st.form_submit_button("Say hello")
if asked:
    st.write(say_hello(name))
