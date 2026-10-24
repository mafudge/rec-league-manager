import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import 'entrants.dart';
import 'leagues.dart';
import 'schedule.dart';

/// This app's own origin; empty when the page has none (e.g. a test run).
String pageOrigin() {
  try {
    return Uri.base.origin;
  } catch (_) {
    return '';
  }
}

/// The league home: name, location, sport · season, the public link, and tabs over Entrants, Schedule and
/// Standings (the last two are filled in by later tasks).
class LeagueHome extends StatefulWidget {
  const LeagueHome({
    super.key,
    required this.api,
    required this.id,
    this.origin,
  });

  final Api api;
  final String id;
  final String? origin;

  @override
  State<LeagueHome> createState() => _LeagueHomeState();
}

class _LeagueHomeState extends State<LeagueHome> {
  League? _league;
  String _message = '';
  String _copied = '';

  @override
  void initState() {
    super.initState();
    widget.api
        .getLeague(widget.id)
        .then((l) {
          if (mounted) setState(() => _league = l);
        })
        .catchError((Object e) {
          if (!mounted || toSignInIfLost(context, e)) return;
          setState(() => _message = widget.api.messageFor(e));
        });
  }

  /// Hash URL strategy: the public page lives at `<origin>/#/l/<slug>`.
  String get _publicUrl =>
      '${widget.origin ?? pageOrigin()}/#/l/${_league!.slug}';

  Future<void> _copy() async {
    try {
      await Clipboard.setData(ClipboardData(text: _publicUrl));
      if (mounted) setState(() => _copied = 'Link copied');
    } catch (_) {
      if (mounted) setState(() => _copied = "Couldn't copy the link");
    }
  }

  @override
  Widget build(BuildContext context) {
    final league = _league;
    final theme = Theme.of(context);
    final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
    if (league == null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Semantics(
          liveRegion: true,
          child: Text(
            _message,
            style: TextStyle(color: theme.colorScheme.error),
          ),
        ),
      );
    }
    final sportSeason = [
      league.sport,
      league.season,
    ].where((s) => s.isNotEmpty).join(' · ');
    return DefaultTabController(
      length: 3,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: NestedScrollView(
            headerSliverBuilder: (context, _) => [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                sliver: SliverList.list(
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        league.name,
                        style: theme.textTheme.headlineSmall,
                      ),
                    ),
                    Text(league.location, style: muted),
                    if (sportSeason.isNotEmpty) Text(sportSeason, style: muted),
                    const SizedBox(height: 8),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      children: [
                        OutlinedButton(
                          onPressed: _copy,
                          child: const Text('Copy public link'),
                        ),
                        Semantics(liveRegion: true, child: Text(_copied)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    SelectableText(_publicUrl, style: muted),
                    const SizedBox(height: 8),
                    const TabBar(
                      tabs: [
                        Tab(text: 'Entrants'),
                        Tab(text: 'Schedule'),
                        Tab(text: 'Standings'),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            body: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TabBarView(
                children: [
                  EntrantsTab(api: widget.api, leagueId: widget.id),
                  ScheduleTab(api: widget.api, leagueId: widget.id),
                  const SizedBox(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
