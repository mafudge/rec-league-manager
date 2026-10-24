import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../api.dart';

Future<String> fetchGreeting({String baseUrl = apiUrl}) async {
  try {
    return 'Hello from ${await fetchBackendName(baseUrl: baseUrl)}';
  } catch (_) {
    return "Can't reach the backend at $baseUrl";
  }
}

/// What to show after Say hello: the backend's greeting, its refusal, or where we looked.
/// The app never checks the name itself; the backend decides (SCAF-13).
Future<String> sayHello(
  String name, {
  String baseUrl = apiUrl,
  http.Client? client,
}) async {
  try {
    return await fetchHello(name, baseUrl: baseUrl, client: client);
  } on BackendRefused catch (e) {
    return e.message;
  } catch (_) {
    return "Can't reach the backend at $baseUrl";
  }
}

Future<String> defaultSayHello(String name) => sayHello(name);

class HomePage extends StatefulWidget {
  const HomePage({
    super.key,
    required this.loadGreeting,
    required this.sayHello,
  });

  final Future<String> Function() loadGreeting;
  final Future<String> Function(String name) sayHello;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final Future<String> _greeting = widget.loadGreeting();
  final _name = TextEditingController();
  String? _reply;
  bool _asking = false;

  Future<void> _ask() async {
    setState(() => _asking = true);
    final reply = await widget.sayHello(_name.text);
    if (!mounted) return;
    setState(() {
      _reply = reply;
      _asking = false;
    });
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rec League Manager')),
      body: Center(
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FutureBuilder<String>(
                    future: _greeting,
                    builder: (context, snap) => Text(
                      snap.data ?? 'Connecting to the backend…',
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _name,
                    decoration: const InputDecoration(
                      labelText: 'Your name',
                      border: OutlineInputBorder(),
                    ),
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _asking ? null : _ask(),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _asking ? null : _ask,
                    child: const Text('Say hello'),
                  ),
                  const SizedBox(height: 16),
                  if (_reply != null)
                    Text(
                      _reply!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  const SizedBox(height: 32),
                  OutlinedButton(
                    onPressed: () => Navigator.pushNamed(context, '/signup'),
                    child: const Text('Sign up'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => Navigator.pushNamed(context, '/signin'),
                    child: const Text('Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
