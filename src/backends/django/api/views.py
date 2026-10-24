from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import NotFound
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


@api_view(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
@authentication_classes([])
@permission_classes([])
def not_found(request):
    raise NotFound("Not Found")
