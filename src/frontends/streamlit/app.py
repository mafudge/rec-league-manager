import streamlit as st

import views

# One router for the whole app. The public page (`?league=<slug>`) is chosen here, before any sign-in check.
views.PAGES.update(
    home=st.Page("screens/home.py", title="Home", url_path="home", default=True),
    signup=st.Page("screens/signup.py", title="Sign up", url_path="signup"),
    signin=st.Page("screens/signin.py", title="Sign in", url_path="signin"),
    leagues=st.Page("screens/leagues.py", title="Your leagues", url_path="leagues"),
    league_new=st.Page("screens/league_new.py", title="Create a league", url_path="leagues-new"),
    league=st.Page("screens/league.py", title="League", url_path="league"),
)
st.navigation(list(views.PAGES.values()), position="hidden").run()
