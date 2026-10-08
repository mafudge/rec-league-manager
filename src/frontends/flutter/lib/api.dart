// The one client for every backend: they all serve the same REST contract (ADR 003).
import 'dart:convert';

import 'package:http/http.dart' as http;

const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8000');

/// Asks the backend which one it is. Throws if it can't be reached.
Future<String> fetchBackendName({String baseUrl = apiUrl, http.Client? client}) async {
  final c = client ?? http.Client();
  final base = baseUrl.replaceAll(RegExp(r'/+$'), '');
  final r = await c.get(Uri.parse('$base/api/backend')).timeout(const Duration(seconds: 3));
  if (r.statusCode != 200) throw http.ClientException('GET /api/backend returned ${r.statusCode}');
  return (jsonDecode(r.body) as Map<String, dynamic>)['backend'] as String;
}
