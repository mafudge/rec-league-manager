import 'package:flutter/material.dart';

import '../api.dart';
import 'leagues.dart';

/// The Entrants tab: who is in the league, and a one-row form to add someone. Validation is the backend's.
class EntrantsTab extends StatefulWidget {
  const EntrantsTab({super.key, required this.api, required this.leagueId});

  final Api api;
  final String leagueId;

  @override
  State<EntrantsTab> createState() => _EntrantsTabState();
}

class _EntrantsTabState extends State<EntrantsTab> {
  final _name = TextEditingController();
  final _entrants = <Entrant>[];
  String _message = '';
  bool _busy = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    widget.api
        .listEntrants(widget.leagueId)
        .then((list) {
          if (!mounted) return;
          setState(() {
            _entrants.addAll(list);
            _loaded = true;
          });
        })
        .catchError((Object e) {
          if (!mounted || toSignInIfLost(context, e)) return;
          setState(() => _message = widget.api.messageFor(e));
        });
  }

  Future<void> _add() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      final added = await widget.api.addEntrant(widget.leagueId, _name.text);
      if (!mounted) return;
      setState(() {
        _entrants.add(added);
        _name.clear();
        _busy = false;
      });
    } catch (e) {
      if (!mounted || toSignInIfLost(context, e)) return;
      setState(() {
        _message = widget.api.messageFor(e);
        _busy = false;
      });
    }
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'Name',
                  border: OutlineInputBorder(),
                ),
                autocorrect: false,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _add(),
              ),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: FilledButton(
                onPressed: _busy ? null : _add,
                child: const Text('Add'),
              ),
            ),
          ],
        ),
        Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              _message,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        ),
        if (_loaded && _entrants.isEmpty)
          const Text('No entrants yet — add the first one.'),
        for (final e in _entrants) Card(child: ListTile(title: Text(e.name))),
      ],
    );
  }
}
