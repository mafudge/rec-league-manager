import 'package:flutter/material.dart';

import '../api.dart';
import 'standings.dart';

String gameText(Game g) {
  if (g.isBye) return '${g.homeName} — bye';
  if (g.played)
    return '${g.homeName} ${g.homeScore} – ${g.awayScore} ${g.awayName}';
  return '${g.homeName} vs ${g.awayName}';
}

/// The public page `/l/<slug>`: read-only, no sign-in, this week's games first. It never touches the token
/// and has nothing that writes (no buttons, fields or links).
class PublicPage extends StatefulWidget {
  const PublicPage({super.key, required this.api, required this.slug});

  final Api api;
  final String slug;

  @override
  State<PublicPage> createState() => _PublicPageState();
}

class _PublicPageState extends State<PublicPage> {
  PublicView? _view;
  bool _notFound = false;
  String _message = '';

  @override
  void initState() {
    super.initState();
    widget.api
        .getPublic(widget.slug)
        .then((v) {
          if (mounted) setState(() => _view = v);
        })
        .catchError((Object e) {
          if (!mounted) return;
          setState(() {
            if (e is BackendRefused && e.message == 'League not found') {
              _notFound = true;
            } else {
              _message = widget.api.messageFor(e);
            }
          });
        });
  }

  Widget _heading(BuildContext context, String text, TextStyle? style) =>
      Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 4),
        child: Semantics(header: true, child: Text(text, style: style)),
      );

  List<Widget> _games(List<Game> games) => [
    for (final g in games)
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        // Its own semantics node, so a screen reader reads one game at a time rather than the whole page.
        child: Semantics(container: true, child: Text(gameText(g))),
      ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
    final v = _view;
    final children = <Widget>[];
    if (_notFound) {
      children.add(
        Semantics(
          header: true,
          child: Text('League not found', style: theme.textTheme.headlineSmall),
        ),
      );
    } else if (v == null) {
      children.add(
        Semantics(
          liveRegion: true,
          child: Text(
            _message,
            style: TextStyle(color: theme.colorScheme.error),
          ),
        ),
      );
    } else {
      final league = v.league;
      final sportSeason = [
        league.sport,
        league.season,
      ].where((s) => s.isNotEmpty).join(' · ');
      final weeks = <int, List<Game>>{};
      for (final g in v.games) {
        weeks.putIfAbsent(g.week, () => []).add(g);
      }
      children.addAll([
        Semantics(
          header: true,
          child: Text(league.name, style: theme.textTheme.headlineSmall),
        ),
        Semantics(container: true, child: Text(league.location, style: muted)),
        if (sportSeason.isNotEmpty)
          Semantics(container: true, child: Text(sportSeason, style: muted)),
        if (v.games.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text('No games scheduled yet', style: muted),
          )
        else ...[
          _heading(
            context,
            'This week — Week ${v.currentWeek}',
            theme.textTheme.titleLarge,
          ),
          ..._games(weeks[v.currentWeek] ?? const []),
          _heading(context, 'Full schedule', theme.textTheme.titleLarge),
          for (final e in weeks.entries) ...[
            _heading(context, 'Week ${e.key}', theme.textTheme.titleMedium),
            ..._games(e.value),
          ],
        ],
        _heading(context, 'Standings', theme.textTheme.titleLarge),
        StandingsTable(standings: v.standings, allowTies: league.allowTies),
      ]);
    }
    return Scaffold(
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: children,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
