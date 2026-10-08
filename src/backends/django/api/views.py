from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def backend(request):
    return Response({"backend": "django"})


@api_view(["GET"])
def hello(request):
    name = request.query_params.get("name", "").strip()
    if not name:
        return Response({"error": "Name is required"}, status=400)
    return Response({"message": f"Hello {name}"})
