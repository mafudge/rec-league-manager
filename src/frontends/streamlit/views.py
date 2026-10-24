"""The pages. Each takes nothing and reads/writes the one session (st.session_state)."""
import streamlit as st

import api
from api import backend_name, hello

# Filled in by app.py once the st.Page objects exist, so pages can send people to each other.
PAGES: dict = {}


def go(name: str) -> None:
    st.switch_page(PAGES[name])


def signed_in() -> bool:
    return bool(st.session_state.get("token"))


def require_sign_in() -> None:
    """For every page that changes data: a signed-out visitor is sent to Sign in."""
    if not signed_in():
        go("signin")


def greeting() -> str:
    try:
        return f"Hello from {backend_name()}"
    except Exception as e:
        return api.message_for(e)


def say_hello(name: str) -> str:
    """The backend's greeting, its refusal, or where we looked. The name is sent as typed."""
    try:
        return hello(name)
    except Exception as e:
        return api.message_for(e)


def home() -> None:
    st.title("Rec League Manager")
    st.write(greeting())

    # A form, so pressing Enter in the box submits it like the button does.
    with st.form("say_hello"):
        name = st.text_input("Your name", key="name")
        asked = st.form_submit_button("Say hello")
    if asked:
        st.write(say_hello(name))
    if not signed_in():
        st.page_link(PAGES["signup"], label="Sign up")
        st.page_link(PAGES["signin"], label="Sign in")


def header() -> None:
    """Shown on every page while signed in: who, and a way out. Sign-out is client-side only (spec §5)."""
    if not signed_in():
        return
    if "email" not in st.session_state:
        try:
            st.session_state["email"] = api.me(st.session_state)["email"]
        except api.SignInRequired:
            go("signin")
        except Exception:
            pass  # anything else just leaves the email blank
    who, out = st.columns([3, 1], vertical_alignment="center")
    who.write(st.session_state.get("email", ""))
    if out.button("Sign out", key="sign_out"):
        api.clear_session(st.session_state)
        go("signin")


def _auth_page(signup: bool) -> None:
    st.title("Create your account" if signup else "Sign in")
    # Sends what was typed; the backend's message is shown as-is (no validation of our own).
    with st.form("signup" if signup else "signin"):
        email = st.text_input("Email", key="auth_email")
        password = st.text_input("Password", type="password", key="auth_password")
        submitted = st.form_submit_button("Sign up" if signup else "Sign in")
    if submitted:
        try:
            (api.sign_up if signup else api.sign_in)(st.session_state, email, password)
        except Exception as e:
            st.error(api.message_for(e))
        else:
            go("leagues")
    st.write("Already have an account?" if signup else "New here?")
    st.page_link(PAGES["signin" if signup else "signup"], label="Sign in" if signup else "Sign up")


def sign_up() -> None:
    _auth_page(True)


def sign_in() -> None:
    _auth_page(False)


def leagues() -> None:
    require_sign_in()
    header()
    st.title("Your leagues")
