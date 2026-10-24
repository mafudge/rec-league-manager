import 'package:flutter/material.dart';

import '../api.dart';
import 'leagues.dart';

/// The Schedule tab: generate the round robin, read it week by week, enter and clear scores. Every refusal is
/// the backend's own words; nothing is validated here.
class ScheduleTab extends StatefulWidget {
  const ScheduleTab({super.key, required this.api, required this.leagueId});

  final Api api;
  final String leagueId;

  @override
  State<ScheduleTab> createState() => _ScheduleTabState();
}

class _ScheduleTabState extends State<ScheduleTab> {
  List<Game>? _games;
  List<Entrant> _entrants = [];
  String _message = '';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Reloads the games (which own the errors) and the entrants (which only feed the stale notice).
  Future<void> _load() async {
    try {
      final games = await widget.api.listGames(widget.leagueId);
      if (mounted) setState(() => _games = games);
    } catch (e) {
      if (!mounted || toSignInIfLost(context, e)) return;
      setState(() => _message = widget.api.messageFor(e));
    }
    try {
      final entrants = await widget.api.listEntrants(widget.leagueId);
      if (mounted) setState(() => _entrants = entrants);
    } catch (_) {
      if (mounted) setState(() => _entrants = []);
    }
  }

  Future<void> _run(Future<String?> Function() action) async {
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      final note = await action();
      await _load();
      if (mounted) setState(() => _message = note ?? _message);
    } catch (e) {
      if (!mounted || toSignInIfLost(context, e)) return;
      setState(() => _message = widget.api.messageFor(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _generate() =>
      _run(() => widget.api.generateSchedule(widget.leagueId));

  Future<void> _clearAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: const Text('Clear every score in this league?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('OK'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _run(() async {
      await widget.api.clearScores(widget.leagueId);
      return null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
    final games = _games ?? const <Game>[];
    final weeks = <int, List<Game>>{};
    for (final g in games) {
      weeks.putIfAbsent(g.week, () => []).add(g);
    }
    // Stale: a schedule exists but an entrant (added after generating) is in none of its games.
    final inGames = {
      for (final g in games) ...[g.homeId, if (g.awayId != null) g.awayId!],
    };
    final stale =
        games.isNotEmpty && _entrants.any((e) => !inGames.contains(e.id));
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      children: [
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            FilledButton(
              onPressed: _busy ? null : _generate,
              child: const Text('Generate schedule'),
            ),
            TextButton(
              onPressed: _busy ? null : _clearAll,
              child: const Text('Clear all scores'),
            ),
          ],
        ),
        Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(_message),
          ),
        ),
        if (stale)
          Text(
            'Regenerate the schedule to include new entrants.',
            style: muted,
          ),
        if (_games != null && games.isEmpty)
          Text('No schedule yet — add entrants, then generate.', style: muted),
        for (final entry in weeks.entries) ...[
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Semantics(
              header: true,
              child: Text(
                'Week ${entry.key}',
                style: theme.textTheme.titleLarge,
              ),
            ),
          ),
          for (final g in entry.value)
            GameRow(
              // A new key when the saved score changes, so the fields re-fill from the backend.
              key: ValueKey('${g.id}-${g.homeScore}-${g.awayScore}'),
              api: widget.api,
              game: g,
              onChanged: _load,
            ),
        ],
      ],
    );
  }
}

/// A blank field goes as `""` (never null, which means Clear) so the backend's message shows; text that
/// parses as a number goes as a number (an int stays an int); anything else goes as typed.
Object toScore(String text) {
  final t = text.trim();
  if (t.isEmpty) return '';
  final i = int.tryParse(t);
  if (i != null) return i;
  // NaN and Infinity parse but cannot be encoded as JSON: send those as typed.
  final d = double.tryParse(t);
  return d != null && d.isFinite ? d : text;
}

/// One game: who plays whom (or the score), plus two plain text fields that stay available to correct it.
class GameRow extends StatefulWidget {
  const GameRow({
    super.key,
    required this.api,
    required this.game,
    required this.onChanged,
  });

  final Api api;
  final Game game;
  final Future<void> Function() onChanged;

  @override
  State<GameRow> createState() => _GameRowState();
}

class _GameRowState extends State<GameRow> {
  late final _home = TextEditingController(
    text: widget.game.homeScore?.toString() ?? '',
  );
  late final _away = TextEditingController(
    text: widget.game.awayScore?.toString() ?? '',
  );
  String _error = '';
  bool _saving = false;

  @override
  void dispose() {
    _home.dispose();
    _away.dispose();
    super.dispose();
  }

  Future<void> _do(Future<void> Function() action) async {
    setState(() {
      _saving = true;
      _error = '';
    });
    try {
      await action();
    } catch (e) {
      if (!mounted || toSignInIfLost(context, e)) return;
      setState(() => _error = widget.api.messageFor(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save() => _do(() async {
    await widget.api.saveScore(
      widget.game.id,
      toScore(_home.text),
      toScore(_away.text),
    );
    await widget.onChanged();
  });

  /// Clear undoes one game's score (both null); no confirmation, it is one game.
  Future<void> _clear() => _do(() async {
    await widget.api.saveScore(widget.game.id, null, null);
    await widget.onChanged();
  });

  @override
  Widget build(BuildContext context) {
    final g = widget.game;
    if (g.isBye) {
      return Card(child: ListTile(title: Text('${g.homeName} — bye')));
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              g.played
                  ? '${g.homeName} ${g.homeScore} – ${g.awayScore} ${g.awayName}'
                  : '${g.homeName} vs ${g.awayName}',
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _field(_home, '${g.homeName} score')),
                const SizedBox(width: 8),
                Expanded(child: _field(_away, '${g.awayName} score')),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: const Text('Save'),
                ),
                if (g.played)
                  TextButton(
                    onPressed: _saving ? null : _clear,
                    child: const Text('Clear'),
                  ),
              ],
            ),
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: EdgeInsets.only(top: _error.isEmpty ? 0 : 8),
                child: Text(
                  _error,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label) => TextField(
    controller: c,
    decoration: InputDecoration(
      labelText: label,
      border: const OutlineInputBorder(),
    ),
    autocorrect: false,
  );
}
