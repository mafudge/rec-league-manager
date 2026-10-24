"""The pages. Each takes nothing and reads/writes the one session (st.session_state)."""
import os
import re

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


def _fail(e: Exception) -> None:
    """A failed call: the backend's own words (or where we looked); a lost session goes to Sign in."""
    if isinstance(e, api.SignInRequired):
        go("signin")
    st.error(api.message_for(e))


def literal(text: str) -> str:
    """User text for the few places Streamlit insists on markdown (titles, button labels): show it as typed."""
    return re.sub(r"([\\`*_{}\[\]()#+\-.!~|<>$:&])", r"\\\1", text)


def public_url(slug: str) -> str:
    """This app's own public page for a league: `?league=<slug>` on the app's base URL."""
    base = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8501").rstrip("/")
    return f"{base}/?league={slug}"


def leagues() -> None:
    require_sign_in()
    header()
    st.title("My leagues")
    try:
        rows = api.list_leagues(st.session_state)
    except Exception as e:
        _fail(e)
        rows = None
    if rows is not None and not rows:
        st.write("No leagues yet — create one.")
    for league in rows or []:
        if st.button(literal(league["name"]), key=f"open_{league['id']}"):
            st.session_state["league_id"] = league["id"]
            go("league")
        st.text(league["location"])
    st.page_link(PAGES["league_new"], label="Create a league")


def league_new() -> None:
    require_sign_in()
    header()
    st.title("Create a league")
    # Sends what was typed; the backend's message is shown as-is (no validation of our own).
    with st.form("new_league"):
        name = st.text_input("Name", key="league_name")
        location = st.text_input("Location", key="league_location")
        sport = st.text_input("Sport", key="league_sport")
        season = st.text_input("Season", key="league_season")
        weeks = st.text_input("Weeks", key="league_weeks")
        allow_ties = st.checkbox("Games can end in a tie", key="league_ties")
        submitted = st.form_submit_button("Create league", key="create_league")
    if not submitted:
        return
    weeks = weeks.strip()
    if weeks == "":
        weeks = None  # blank is sent as null for the backend to refuse
    else:
        if re.fullmatch(r"[0-9]+", weeks):
            weeks = int(weeks)  # anything else is sent as typed; the backend says so
    try:
        league = api.create_league(st.session_state, dict(
            name=name, location=location, sport=sport, season=season, weeks=weeks, allow_ties=allow_ties))
    except Exception as e:
        _fail(e)
    else:
        st.session_state["league_id"] = league["id"]
        go("league")


def league_home() -> None:
    require_sign_in()
    header()
    league_id = st.session_state.get("league_id")
    if not league_id:
        go("leagues")
    try:
        league = api.get_league(st.session_state, league_id)
    except Exception as e:
        _fail(e)
        return
    st.title(literal(league["name"]))
    st.text(league["location"])
    st.text(" · ".join(x for x in (league["sport"], league["season"]) if x))
    st.code(public_url(league["slug"]), language=None)
    entrants_tab, schedule_tab, standings_tab = st.tabs(["Entrants", "Schedule", "Standings"])
    with entrants_tab:
        entrants(league_id)
    # Schedule and Standings stay empty until their tasks land.


def entrants(league_id: str) -> None:
    """The Entrants tab: a one-row add form, then who is in, in order. Validation is the backend's."""
    # A successful add swaps in a fresh, empty box (new key); a refused one keeps the old box and its text.
    # (clear_on_submit would also wipe the text on a refusal.)
    box_key = f"entrant_name_{st.session_state.get('entrant_boxes', 0)}"
    with st.form("add_entrant"):
        box, add = st.columns([3, 1], vertical_alignment="bottom")
        name = box.text_input("Name", key=box_key)
        submitted = add.form_submit_button("Add", key="add_entrant")
    if submitted:  # True only on the run the click caused, so a later rerun never re-sends it
        try:
            api.add_entrant(st.session_state, league_id, name)
        except Exception as e:
            _fail(e)
        else:
            st.session_state["entrant_boxes"] = st.session_state.get("entrant_boxes", 0) + 1
            st.rerun()
    try:
        rows = api.list_entrants(st.session_state, league_id)
    except Exception as e:
        _fail(e)
        return
    if not rows:
        st.write("No entrants yet — add the first one.")
    for entrant in rows:
        st.text(entrant["name"])
