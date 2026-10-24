import 'package:flutter/material.dart';

import '../api.dart';
import 'leagues.dart';

String diffText(int n) => n > 0 ? '+$n' : '$n';

/// One standings table, shared by the organizer's tab and the public page. The backend sorts the rows and
/// words the tiebreak; nothing here sorts. It scrolls sideways inside its own box if it must, never the page.
class StandingsTable extends StatelessWidget {
  const StandingsTable({
    super.key,
    required this.standings,
    required this.allowTies,
  });

  final Standings standings;
  final bool allowTies;

  @override
  Widget build(BuildContext context) {
    final muted = TextStyle(
      color: Theme.of(context).colorScheme.onSurfaceVariant,
    );
    DataColumn col(String label, {bool number = true}) =>
        DataColumn(label: Text(label), numeric: number);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (standings.played == 0) Text('No games played yet', style: muted),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columnSpacing: 14,
            horizontalMargin: 8,
            columns: [
              col('Entrant', number: false),
              col('W'),
              col('L'),
              if (allowTies) col('T'),
              col('PF'),
              col('PA'),
              col('Diff'),
            ],
            rows: [
              for (final r in standings.rows)
                DataRow(
                  cells: [
                    DataCell(Text(r.name)),
                    DataCell(Text('${r.w}')),
                    DataCell(Text('${r.l}')),
                    if (allowTies) DataCell(Text('${r.t}')),
                    DataCell(Text('${r.pf}')),
                    DataCell(Text('${r.pa}')),
                    DataCell(Text(diffText(r.diff))),
                  ],
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(standings.tiebreak, style: muted),
        ),
      ],
    );
  }
}

/// The Standings tab. It loads when it is built, and the league home rebuilds it each time the tab opens.
class StandingsTab extends StatefulWidget {
  const StandingsTab({
    super.key,
    required this.api,
    required this.leagueId,
    required this.allowTies,
  });

  final Api api;
  final String leagueId;
  final bool allowTies;

  @override
  State<StandingsTab> createState() => _StandingsTabState();
}

class _StandingsTabState extends State<StandingsTab> {
  Standings? _standings;
  String _message = '';

  @override
  void initState() {
    super.initState();
    widget.api
        .getStandings(widget.leagueId)
        .then((s) {
          if (mounted) setState(() => _standings = s);
        })
        .catchError((Object e) {
          if (!mounted || toSignInIfLost(context, e)) return;
          setState(() => _message = widget.api.messageFor(e));
        });
  }

  @override
  Widget build(BuildContext context) {
    final s = _standings;
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      children: [
        Semantics(
          liveRegion: true,
          child: Text(
            _message,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
        if (s != null)
          StandingsTable(standings: s, allowTies: widget.allowTies),
      ],
    );
  }
}
