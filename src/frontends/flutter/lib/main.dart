import 'package:flutter/material.dart';

import 'api.dart';

Future<String> fetchGreeting({String baseUrl = apiUrl}) async {
  try {
    return 'Hello from ${await fetchBackendName(baseUrl: baseUrl)}';
  } catch (_) {
    return "Can't reach the backend at $baseUrl";
  }
}

void main() => runApp(const RecLeagueApp());

class RecLeagueApp extends StatelessWidget {
  const RecLeagueApp({super.key, this.loadGreeting = fetchGreeting});

  final Future<String> Function() loadGreeting;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rec League Manager',
      theme: ThemeData(colorSchemeSeed: Colors.green),
      home: Scaffold(
        appBar: AppBar(title: const Text('Rec League Manager')),
        body: Center(
          child: FutureBuilder<String>(
            future: loadGreeting(),
            builder: (context, snap) => Text(snap.data ?? 'Connecting to the backend…'),
          ),
        ),
      ),
    );
  }
}
