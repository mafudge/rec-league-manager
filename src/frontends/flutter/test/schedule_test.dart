import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'leagues_test.dart' as h;

Map<String, dynamic> game(
  String id,
  int week,
  String home,
  String? away, [
  Object? hs,
  Object? as_,
]) => {
  'id': id,
  'week': week,
  'home_id': 'h-$home',
  'home_name': home,
  'away_id': away == null ? null : 'a-$away',
  'away_name': away,
  'home_score': hs,
  'away_score': as_,
};

List<Map<String, dynamic>> generated() => [
  game('g1', 1, 'Bag Ladies', 'Corn Stars'),
  game('g2', 1, 'Hole Patrol', null),
  game('g3', 2, 'Corn Stars', 'Hole Patrol'),
];

/// A fake backend for one league: GET /games answers `games`, POST /schedule swaps in [generated].
h.Fake backend({
  List<Map<String, dynamic>>? games,
  List<String> entrants = const ['Bag Ladies', 'Corn Stars', 'Hole Patrol'],
  (int, Object) post = (201, const {'weeks': 2, 'message': null}),
  (int, Object)? put,
}) {
  var current = games ?? [];
  return h.Fake({
    'GET /api/leagues/abc123': h.json(200, h.league()),
    'GET /api/leagues/abc123/entrants': h.json(200, [
      for (final n in entrants) {'id': 'h-$n', 'name': n},
    ]),
    'GET /api/leagues/abc123/games': (http.Request r) => h.json(200, current),
    'POST /api/leagues/abc123/schedule': (http.Request r) {
      if (post.$1 < 400) current = generated();
      return h.json(post.$1, post.$2);
    },
    'PUT /api/games/g1/score': (http.Request r) {
      if (put != null) return h.json(put.$1, put.$2);
      final sent = jsonDecode(r.body) as Map<String, dynamic>;
      current = [
        for (final g in current) g['id'] == 'g1' ? {...g, ...sent} : g,
      ];
      return h.json(200, current.firstWhere((g) => g['id'] == 'g1'));
    },
    'DELETE /api/leagues/abc123/scores': h.json(200, {'cleared': 1}),
  });
}

Future<void> open(WidgetTester tester, h.Fake fake) async {
  await h.show(tester, fake.api, '/leagues/abc123');
  tester.view.physicalSize = const Size(375 * 2, 3000 * 2);
  await tester.tap(find.text('Schedule'));
  await tester.pumpAndSettle();
}

Finder button(String label) => find.widgetWithText(FilledButton, label);
Finder text(String t) => find.text(t);
Finder score(String name) => find.widgetWithText(TextField, '$name score');
Finder save(int i) => find.widgetWithText(FilledButton, 'Save').at(i);

Future<void> typeScore(WidgetTester tester, String name, String v) async {
  await tester.enterText(score(name).first, v);
}

Future<void> tapSave(WidgetTester tester, [int i = 0]) async {
  await tester.tap(save(i));
  await tester.pumpAndSettle();
}

Map<String, dynamic> body(http.Request r) =>
    jsonDecode(r.body) as Map<String, dynamic>;

const stale = 'Regenerate the schedule to include new entrants.';
const whole = 'Scores must be whole numbers 0 or greater';

void main() {
  testWidgets('with no games it says there is no schedule yet', (tester) async {
    await open(tester, backend());
    expect(text('No schedule yet — add entrants, then generate.'), findsOne);
  });

  testWidgets('existing games are grouped by week, with byes and rows', (
    tester,
  ) async {
    await open(tester, backend(games: generated()));
    expect(text('Week 1'), findsOneWidget);
    expect(text('Week 2'), findsOneWidget);
    expect(text('Bag Ladies vs Corn Stars'), findsOneWidget);
    expect(text('Hole Patrol — bye'), findsOneWidget);
    expect(find.textContaining('No schedule yet'), findsNothing);
  });

  testWidgets('Generate schedule POSTs with no body and no Content-Type', (
    tester,
  ) async {
    final fake = backend();
    await open(tester, fake);
    await tester.tap(button('Generate schedule'));
    await tester.pumpAndSettle();
    final post = fake.calls('POST /api/leagues/abc123/schedule').single;
    expect(post.url.toString(), '${h.base}/api/leagues/abc123/schedule');
    expect(post.headers['authorization'], 'Bearer t1');
    expect(post.headers.containsKey('content-type'), isFalse);
    expect(post.body, isEmpty);
    expect(text('Hole Patrol — bye'), findsOneWidget);
    expect(text('Week 1'), findsOneWidget);
    expect(text('Corn Stars vs Hole Patrol'), findsOneWidget);
  });

  testWidgets('the weeks message is shown when present', (tester) async {
    const msg =
        'This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8.';
    await open(tester, backend(post: (201, {'weeks': 5, 'message': msg})));
    await tester.tap(button('Generate schedule'));
    await tester.pumpAndSettle();
    expect(text(msg), findsOneWidget);
  });

  for (final (status, error) in [
    (400, 'Add at least 2 entrants first'),
    (409, 'Scores already recorded — clear them first'),
  ]) {
    testWidgets('a $status refusal is shown as the backend worded it', (
      tester,
    ) async {
      await open(tester, backend(post: (status, {'error': error})));
      await tester.tap(button('Generate schedule'));
      await tester.pumpAndSettle();
      expect(text(error), findsOneWidget);
    });
  }

  testWidgets('Clear all scores asks first: Cancel sends nothing, OK deletes', (
    tester,
  ) async {
    final fake = backend(games: generated());
    await open(tester, fake);
    await tester.tap(find.widgetWithText(TextButton, 'Clear all scores'));
    await tester.pumpAndSettle();
    expect(text('Clear every score in this league?'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(fake.calls('DELETE /api/leagues/abc123/scores'), isEmpty);
    final loads = fake.calls('GET /api/leagues/abc123/games').length;

    await tester.tap(find.widgetWithText(TextButton, 'Clear all scores'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'OK'));
    await tester.pumpAndSettle();
    final del = fake.calls('DELETE /api/leagues/abc123/scores').single;
    expect(del.url.toString(), '${h.base}/api/leagues/abc123/scores');
    expect(del.headers.containsKey('content-type'), isFalse);
    expect(del.body, isEmpty);
    expect(
      fake.calls('GET /api/leagues/abc123/games').length,
      greaterThan(loads),
    );
  });

  testWidgets('each game has two labelled text fields and Save; a bye none', (
    tester,
  ) async {
    await open(tester, backend(games: generated()));
    for (final n in ['Bag Ladies', 'Corn Stars', 'Hole Patrol']) {
      expect(score(n), findsAtLeastNWidgets(1));
    }
    // not number-only: the backend validates
    final tf = tester.widget<TextField>(score('Bag Ladies').first);
    expect(tf.keyboardType, isNot(const TextInputType.numberWithOptions()));
    expect(tf.inputFormatters, isNull);
    expect(find.widgetWithText(FilledButton, 'Save'), findsNWidgets(2));
    expect(find.byType(TextField), findsNWidgets(4));
  });

  testWidgets('saving sends numbers, shows the game played, still editable', (
    tester,
  ) async {
    final fake = backend(games: generated());
    await open(tester, fake);
    await typeScore(tester, 'Bag Ladies', '21');
    await typeScore(tester, 'Corn Stars', '14');
    await tapSave(tester);
    final put = fake.calls('PUT /api/games/g1/score').single;
    expect(put.url.toString(), '${h.base}/api/games/g1/score');
    expect(put.headers['authorization'], 'Bearer t1');
    expect(put.headers['content-type'], contains('application/json'));
    expect(body(put), {'home_score': 21, 'away_score': 14});
    expect(text('Bag Ladies 21 – 14 Corn Stars'), findsOneWidget);
    expect(find.text('21'), findsOneWidget);
    await typeScore(tester, 'Corn Stars', '17');
    await tapSave(tester);
    expect(text('Bag Ladies 21 – 17 Corn Stars'), findsOneWidget);
  });

  testWidgets('blank fields are sent as "" and the backend message shows', (
    tester,
  ) async {
    final fake = backend(games: generated(), put: (400, {'error': whole}));
    await open(tester, fake);
    await tapSave(tester);
    expect(body(fake.calls('PUT /api/games/g1/score').single), {
      'home_score': '',
      'away_score': '',
    });
    expect(text(whole), findsOneWidget);
    expect(text('Bag Ladies vs Corn Stars'), findsOneWidget);
  });

  testWidgets('one blank field sends "" for it', (tester) async {
    final fake = backend(games: generated(), put: (400, {'error': whole}));
    await open(tester, fake);
    await typeScore(tester, 'Bag Ladies', '21');
    await tapSave(tester);
    expect(body(fake.calls('PUT /api/games/g1/score').single), {
      'home_score': 21,
      'away_score': '',
    });
    expect(text(whole), findsOneWidget);
  });

  testWidgets(
    'what is typed goes as typed: -3 and 1.5 as numbers, text as text',
    (tester) async {
      final fake = backend(games: generated(), put: (400, {'error': whole}));
      await open(tester, fake);
      await typeScore(tester, 'Bag Ladies', '-3');
      await typeScore(tester, 'Corn Stars', ' 1.5 ');
      await tapSave(tester);
      expect(body(fake.calls('PUT /api/games/g1/score').last), {
        'home_score': -3,
        'away_score': 1.5,
      });
      expect(text(whole), findsOneWidget);
      await typeScore(tester, 'Bag Ladies', 'abc');
      await tapSave(tester);
      expect(body(fake.calls('PUT /api/games/g1/score').last), {
        'home_score': 'abc',
        'away_score': 1.5,
      });
      expect(fake.calls('PUT /api/games/g1/score').length, 2);
    },
  );

  testWidgets('a tie refusal is shown as the backend worded it', (
    tester,
  ) async {
    await open(
      tester,
      backend(
        games: generated(),
        put: (400, {'error': "This league doesn't allow ties"}),
      ),
    );
    await typeScore(tester, 'Bag Ladies', '15');
    await typeScore(tester, 'Corn Stars', '15');
    await tapSave(tester);
    expect(text("This league doesn't allow ties"), findsOneWidget);
  });

  testWidgets('Clear is on played games only, sends both null, row unplayed', (
    tester,
  ) async {
    final scored = generated();
    scored[0] = {...scored[0], 'home_score': 21, 'away_score': 14};
    final fake = backend(games: scored);
    await open(tester, fake);
    expect(text('Bag Ladies 21 – 14 Corn Stars'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Clear'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Clear all scores'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Bag Ladies score'), findsOneWidget);
    expect(
      tester.widget<TextField>(score('Bag Ladies').first).controller!.text,
      '21',
    );
    final loads = fake.calls('GET /api/leagues/abc123/games').length;
    await tester.tap(find.widgetWithText(TextButton, 'Clear'));
    await tester.pumpAndSettle();
    expect(body(fake.calls('PUT /api/games/g1/score').single), {
      'home_score': null,
      'away_score': null,
    });
    // the fake merges the nulls in, so the row reads unplayed again
    expect(text('Bag Ladies vs Corn Stars'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Clear'), findsNothing);
    expect(
      tester.widget<TextField>(score('Bag Ladies').first).controller!.text,
      '',
    );
    expect(
      fake.calls('GET /api/leagues/abc123/games').length,
      greaterThan(loads),
    );
  });

  testWidgets('an entrant with no games shows the regenerate notice', (
    tester,
  ) async {
    await open(
      tester,
      backend(
        games: generated(),
        entrants: ['Bag Ladies', 'Corn Stars', 'Hole Patrol', 'Late Joiners'],
      ),
    );
    expect(text(stale), findsOneWidget);
    expect(
      tester.getTopLeft(text(stale)).dy,
      lessThan(tester.getTopLeft(text('Week 1')).dy),
    );
  });

  testWidgets('no notice when every entrant has a game', (tester) async {
    await open(tester, backend(games: generated()));
    expect(text(stale), findsNothing);
  });

  testWidgets('no notice when there is no schedule', (tester) async {
    await open(tester, backend(entrants: ['Bag Ladies', 'Corn Stars']));
    expect(text(stale), findsNothing);
    expect(
      text('No schedule yet — add entrants, then generate.'),
      findsOneWidget,
    );
  });

  testWidgets('generating clears the notice', (tester) async {
    await open(
      tester,
      backend(games: [game('g9', 1, 'Bag Ladies', 'Corn Stars')]),
    );
    expect(text(stale), findsOneWidget);
    await tester.tap(button('Generate schedule'));
    await tester.pumpAndSettle();
    expect(text(stale), findsNothing);
  });

  testWidgets('NaN and Infinity are sent as typed, not crash', (tester) async {
    final fake = backend(games: generated(), put: (400, {'error': whole}));
    await open(tester, fake);
    await typeScore(tester, 'Bag Ladies', 'NaN');
    await typeScore(tester, 'Corn Stars', '-Infinity');
    await tapSave(tester);
    expect(body(fake.calls('PUT /api/games/g1/score').single), {
      'home_score': 'NaN',
      'away_score': '-Infinity',
    });
    expect(text(whole), findsOneWidget);
  });

  testWidgets('a lost session during Save goes to sign in', (tester) async {
    final fake = backend(games: generated());
    fake.routes['PUT /api/games/g1/score'] = h.json(401, {
      'error': 'Sign in required',
    });
    fake.routes['POST /api/auth/refresh'] = h.json(401, {
      'error': 'Sign in required',
    });
    await open(tester, fake);
    await typeScore(tester, 'Bag Ladies', '1');
    await typeScore(tester, 'Corn Stars', '2');
    await tapSave(tester);
    expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
  });

  testWidgets('a lost session goes to sign in', (tester) async {
    final fake = h.Fake({
      'GET /api/leagues/abc123': h.json(200, h.league()),
      'GET /api/leagues/abc123/entrants': h.json(200, []),
      'GET /api/leagues/abc123/games': h.json(401, {
        'error': 'Sign in required',
      }),
      'POST /api/auth/refresh': h.json(401, {'error': 'Sign in required'}),
    });
    await open(tester, fake);
    expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
  });
}
