// The one client for every backend: they all serve the same REST contract (ADR 003).
import 'dart:convert';

import 'package:http/http.dart' as http;

const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8000');

/// The backend understood the request and said no, e.g. "Name is required".
class BackendRefused implements Exception {
  BackendRefused(this.message);
  final String message;
  @override
  String toString() => message;
}

Uri _uri(String baseUrl, String path, [Map<String, String>? query]) {
  final base = baseUrl.replaceAll(RegExp(r'/+$'), '');
  return Uri.parse('$base$path').replace(queryParameters: query);
}

Future<Map<String, dynamic>> _get(Uri uri, http.Client? client) async {
  final r = await (client ?? http.Client()).get(uri).timeout(const Duration(seconds: 3));
  if (r.statusCode != 200 && r.statusCode != 400) {
    throw http.ClientException('GET ${uri.path} returned ${r.statusCode}');
  }
  // JSON is always UTF-8; decode the bytes ourselves rather than rely on how http guesses the charset.
  final body = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
  if (r.statusCode == 400) throw BackendRefused(body['error'] as String? ?? 'The backend refused the request');
  return body;
}

/// Asks the backend which one it is. Throws if it can't be reached.
Future<String> fetchBackendName({String baseUrl = apiUrl, http.Client? client}) async =>
    (await _get(_uri(baseUrl, '/api/backend'), client))['backend'] as String;

/// Asks the backend to greet [name]. Throws [BackendRefused] if it refuses the name.
Future<String> fetchHello(String name, {String baseUrl = apiUrl, http.Client? client}) async =>
    (await _get(_uri(baseUrl, '/api/hello', {'name': name}), client))['message'] as String;
