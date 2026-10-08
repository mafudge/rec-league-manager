from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def backend(request):
    return Response({"backend": "django"})
