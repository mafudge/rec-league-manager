import 'dart:io' show Platform;

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rec_league_manager/api.dart';
import 'package:rec_league_manager/main.dart';

void main() {
  test('asks /api/backend and ignores a trailing slash on the API URL', () async {
    Uri? asked;
    final client = MockClient((req) async {
      asked = req.url;
      return http.Response('{"backend":"fastapi"}', 200);
    });
    expect(await fetchBackendName(baseUrl: 'http://localhost:8000/', client: client), 'fastapi');
    expect(asked.toString(), 'http://localhost:8000/api/backend');
  });

  test('throws on an error status', () async {
    final client = MockClient((_) async => http.Response('nope', 404));
    expect(fetchBackendName(client: client), throwsA(isA<http.ClientException>()));
  });

  test('says where it looked when the backend is unreachable', () async {
    // Nothing listens on port 1.
    expect(await fetchGreeting(baseUrl: 'http://localhost:1'), "Can't reach the backend at http://localhost:1");
  });

  // Live: LIVE_API_URL=http://localhost:5000 LIVE_BACKEND=firebase flutter test test/api_test.dart
  final live = Platform.environment['LIVE_API_URL'];
  test('a running backend names itself', () async {
    final name = await fetchBackendName(baseUrl: live!);
    expect(['fastapi', 'django', 'supabase', 'firebase'], contains(name));
    final want = Platform.environment['LIVE_BACKEND'];
    if (want != null) expect(name, want);
  }, skip: live == null ? 'set LIVE_API_URL to test against a running backend' : false);
}
