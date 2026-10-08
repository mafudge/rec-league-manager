#!/bin/sh
# Pass when all three emulators answer.
set -e
curl -fsS --retry 20 --retry-connrefused --retry-delay 2 http://localhost:8080/ -o /dev/null && echo "firestore ok"
curl -fsS --retry 20 --retry-connrefused --retry-delay 2 http://localhost:9099/ -o /dev/null && echo "auth ok"
curl -fsS --retry 20 --retry-connrefused --retry-delay 2 http://localhost:5000/ | grep -q "Rec League Manager" && echo "hosting ok"
# the REST contract (ADR 003), served by the Cloud Function in functions/ through Hosting
curl -fsS --retry 20 --retry-connrefused --retry-delay 2 http://localhost:5000/api/backend | grep -q '"backend":"firebase"' && echo "api ok"
