import 'package:flutter/material.dart';

/// Placeholder until the league list lands (F2).
class LeaguesPage extends StatelessWidget {
  const LeaguesPage({super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(16),
    child: Semantics(
      header: true,
      child: Text(
        'My leagues',
        style: Theme.of(context).textTheme.headlineSmall,
      ),
    ),
  );
}
