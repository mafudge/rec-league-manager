import 'package:flutter/material.dart';

import '../api.dart';
import 'leagues.dart';

/// Sends what was typed; the backend's message is shown as-is (no validation of our own).
/// Weeks: blank is `null`, digits-only is a whole number, anything else goes as the text typed.
class NewLeaguePage extends StatefulWidget {
  const NewLeaguePage({super.key, required this.api});

  final Api api;

  @override
  State<NewLeaguePage> createState() => _NewLeaguePageState();
}

class _NewLeaguePageState extends State<NewLeaguePage> {
  final _name = TextEditingController();
  final _location = TextEditingController();
  final _sport = TextEditingController();
  final _season = TextEditingController();
  final _weeks = TextEditingController();
  bool _allowTies = false;
  String _message = '';
  bool _busy = false;

  Object? _weeksValue() {
    final t = _weeks.text.trim();
    if (t.isEmpty) return null;
    return RegExp(r'^\d+$').hasMatch(t)
        ? int.tryParse(t) ?? _weeks.text
        : _weeks.text;
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      final league = await widget.api.createLeague({
        'name': _name.text,
        'location': _location.text,
        'sport': _sport.text,
        'season': _season.text,
        'weeks': _weeksValue(),
        'allow_ties': _allowTies,
      });
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/leagues/${league.id}');
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
    for (final c in [_name, _location, _sport, _season, _weeks]) {
      c.dispose();
    }
    super.dispose();
  }

  Widget _field(String label, TextEditingController c, {bool number = false}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
          ),
          keyboardType: number ? TextInputType.number : null,
          textInputAction: TextInputAction.next,
        ),
      );

  @override
  Widget build(BuildContext context) {
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
                'Create a league',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            const SizedBox(height: 16),
            _field('Name', _name),
            _field('Location', _location),
            _field('Sport', _sport),
            _field('Season', _season),
            _field('Weeks', _weeks, number: true),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('Games can end in a tie'),
              value: _allowTies,
              onChanged: (v) => setState(() => _allowTies = v ?? false),
            ),
            Semantics(
              liveRegion: true,
              child: Text(
                _message,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton(
                onPressed: _busy ? null : _submit,
                child: const Text('Create league'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
