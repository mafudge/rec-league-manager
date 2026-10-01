import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8000');

Future<String> fetchBackendStatus() async {
  try {
    final r = await http.get(Uri.parse('$apiUrl/api/health')).timeout(const Duration(seconds: 3));
    if (r.statusCode != 200) return 'backend unreachable';
    return (jsonDecode(r.body) as Map<String, dynamic>)['status'] as String;
  } catch (_) {
    return 'backend unreachable';
  }
}

void main() => runApp(const RecLeagueApp());

class RecLeagueApp extends StatelessWidget {
  const RecLeagueApp({super.key, this.loadStatus = fetchBackendStatus});

  final Future<String> Function() loadStatus;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rec League Manager',
      theme: ThemeData(colorSchemeSeed: Colors.green),
      home: Scaffold(
        appBar: AppBar(title: const Text('Rec League Manager')),
        body: Center(
          child: FutureBuilder<String>(
            future: loadStatus(),
            builder: (context, snap) => Text('Backend: ${snap.data ?? 'checking…'}'),
          ),
        ),
      ),
    );
  }
}
