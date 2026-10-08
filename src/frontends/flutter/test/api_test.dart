import 'dart:convert';
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

  test('asks /api/hello with the name encoded, and returns the message', () async {
    Uri? asked;
    final client = MockClient((req) async {
      asked = req.url;
      // UTF-8 JSON with no charset in Content-Type, as FastAPI sends it.
      return http.Response.bytes(utf8.encode('{"message":"Hello José Ada"}'), 200, headers: {'content-type': 'application/json'});
    });
    expect(await fetchHello('José Ada', baseUrl: 'http://localhost:54321/functions/v1', client: client), 'Hello José Ada');
    expect(asked.toString(), 'http://localhost:54321/functions/v1/api/hello?name=Jos%C3%A9+Ada');
  });

  test('a 400 carries the backend\'s own error message', () async {
    final client = MockClient((_) async => http.Response('{"error":"Name is required"}', 400));
    expect(
      fetchHello('', client: client),
      throwsA(isA<BackendRefused>().having((e) => e.message, 'message', 'Name is required')),
    );
  });

  test('sayHello shows the reply, the refusal, or where it looked', () async {
    final ok = MockClient((_) async => http.Response('{"message":"Hello Mike"}', 200));
    final refused = MockClient((_) async => http.Response('{"error":"Name is required"}', 400));
    expect(await sayHello('Mike', client: ok), 'Hello Mike');
    expect(await sayHello('', client: refused), 'Name is required');
    expect(await sayHello('Mike', baseUrl: 'http://localhost:1'), "Can't reach the backend at http://localhost:1");
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
    expect(await fetchHello('Mike', baseUrl: live), 'Hello Mike');
    expect(fetchHello(' ', baseUrl: live), throwsA(isA<BackendRefused>()));
  }, skip: live == null ? 'set LIVE_API_URL to test against a running backend' : false);
}
