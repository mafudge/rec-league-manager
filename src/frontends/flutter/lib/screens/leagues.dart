import 'package:flutter/material.dart';

import '../api.dart';

/// Sends a lost session to /signin; true when [e] was that.
bool toSignInIfLost(BuildContext context, Object e) {
  if (e is! SignInRequired) return false;
  Navigator.pushNamedAndRemoveUntil(context, '/signin', (_) => false);
  return true;
}

/// "My leagues": the organizer's leagues, oldest first, and a way to create one.
class LeaguesPage extends StatefulWidget {
  const LeaguesPage({super.key, required this.api});

  final Api api;

  @override
  State<LeaguesPage> createState() => _LeaguesPageState();
}

class _LeaguesPageState extends State<LeaguesPage> {
  List<League>? _leagues;
  String _message = '';

  @override
  void initState() {
    super.initState();
    widget.api
        .listLeagues()
        .then((l) {
          if (mounted) setState(() => _leagues = l);
        })
        .catchError((Object e) {
          if (!mounted || toSignInIfLost(context, e)) return;
          setState(() => _message = widget.api.messageFor(e));
        });
  }

  @override
  Widget build(BuildContext context) {
    final leagues = _leagues;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Semantics(
              header: true,
              child: Text(
                'My leagues',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            Semantics(
              liveRegion: true,
              child: Text(
                _message,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
            if (leagues != null && leagues.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('No leagues yet — create one.'),
              ),
            for (final l in leagues ?? <League>[])
              Card(
                child: ListTile(
                  title: Text(l.name),
                  subtitle: Text(l.location),
                  onTap: () => Navigator.pushNamed(context, '/leagues/${l.id}'),
                ),
              ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton(
                onPressed: () => Navigator.pushNamed(context, '/leagues/new'),
                child: const Text('Create a league'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
