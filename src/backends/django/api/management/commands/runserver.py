from django.contrib.staticfiles.management.commands.runserver import Command as StaticfilesRunserver


class Command(StaticfilesRunserver):
    # FastAPI has 8000; every backend gets its own port so all four can run at once.
    default_port = "8001"
