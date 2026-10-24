import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:rec_league_manager/api.dart';

import 'leagues_test.dart' as h;
import 'schedule_test.dart' show game;
import 'standings_test.dart' show row;

final pubLeague = {
  'slug': 'k7m2pq',
  'name': 'Tuesday Cornhole',
  'location': "Joe's Tavern",
  'sport': 'Cornhole',
  'season': 'Fall 2026',
  'weeks': 2,
  'allow_ties': false,
};

Map<String, dynamic> body([Map<String, dynamic> over = const {}]) => {
  'league': pubLeague,
  'current_week': 2,
  'games': [
    game('g1', 1, 'Bag Ladies', 'Corn Stars', 21, 14),
    game('g2', 1, 'Hole Patrol', null),
    game('g3', 2, 'Corn Stars', 'Hole Patrol'),
    game('g4', 2, 'Bag Ladies', null),
  ],
  'standings': {
    'rows': [
      row('Bag Ladies', 1, 0, 0, 21, 14),
      row('Corn Stars', 0, 1, 0, 14, 21),
      row('Hole Patrol', 0, 0, 0, 0, 0),
    ],
    'played': 1,
    'tiebreak': 'Sorted by wins.',
  },
  ...over,
};

h.Fake backend(Object response) => h.Fake({'GET /api/public/k7m2pq': response});

Future<h.Fake> open(
  WidgetTester tester,
  Object response, {
  bool signedOut = true,
}) async {
  final fake = backend(response);
  if (signedOut) fake.api.signOut();
  await h.show(tester, fake.api, '/l/k7m2pq');
  return fake;
}

void main() {
  testWidgets('name, location under it, then sport and season', (tester) async {
    await open(tester, h.json(200, body()));
    final name = tester.getTopLeft(find.text('Tuesday Cornhole')).dy;
    final loc = tester.getTopLeft(find.text("Joe's Tavern")).dy;
    final ss = tester.getTopLeft(find.text('Cornhole · Fall 2026')).dy;
    expect(name < loc && loc < ss, isTrue);
  });

  testWidgets('this week first, then the full schedule, then standings', (
    tester,
  ) async {
    await open(tester, h.json(200, body()));
    double y(String t) => tester.getTopLeft(find.text(t)).dy;
    expect(y('This week — Week 2') < y('Full schedule'), isTrue);
    expect(y('Full schedule') < y('Standings'), isTrue);
    expect(find.text('Week 1'), findsOneWidget);
    expect(find.text('Week 2'), findsOneWidget);
    expect(y('Week 1') < y('Week 2'), isTrue);
  });

  testWidgets('games read as scores, matchups and byes', (tester) async {
    await open(tester, h.json(200, body()));
    expect(find.text('Bag Ladies 21 – 14 Corn Stars'), findsOneWidget);
    expect(find.text('Corn Stars vs Hole Patrol'), findsNWidgets(2));
    expect(find.text('Hole Patrol — bye'), findsOneWidget);
    expect(find.byType(DataTable), findsOneWidget);
  });

  testWidgets('nothing on the page writes', (tester) async {
    await open(tester, h.json(200, body()));
    for (final t in [
      ButtonStyleButton,
      IconButton,
      TextField,
      TextButton,
      Checkbox,
      Switch,
      TabBar,
      AppBar,
    ]) {
      expect(find.byType(t), findsNothing, reason: '$t');
    }
  });

  testWidgets('nothing on the page is tappable', (tester) async {
    await open(tester, h.json(200, body()));
    for (final w in tester.widgetList<InkWell>(find.byType(InkWell))) {
      expect(w.onTap, isNull);
    }
    expect(
      find.byType(GestureDetector).evaluate().where((e) {
        final g = e.widget as GestureDetector;
        return g.onTap != null;
      }),
      isEmpty,
    );
  });

  testWidgets('no token is sent, even when the organizer is signed in', (
    tester,
  ) async {
    final fake = await open(tester, h.json(200, body()), signedOut: false);
    final c = fake.calls('GET /api/public/k7m2pq');
    expect(c.length, 1);
    expect(c.first.url.toString(), '${h.base}/api/public/k7m2pq');
    expect(c.first.headers.containsKey('Authorization'), isFalse);
    expect(c.first.body, '');
    expect(c.first.headers.containsKey('Content-Type'), isFalse);
    expect(fake.calls('GET /api/auth/me'), isEmpty);
    expect(find.text('Sign out'), findsNothing);
  });

  testWidgets('no schedule says so and still shows standings', (tester) async {
    await open(tester, h.json(200, body({'current_week': null, 'games': []})));
    expect(find.text('No games scheduled yet'), findsOneWidget);
    expect(find.textContaining('This week'), findsNothing);
    expect(find.text('Standings'), findsOneWidget);
    expect(find.byType(DataTable), findsOneWidget);
  });

  testWidgets('an unknown league says League not found and nothing else', (
    tester,
  ) async {
    await open(tester, h.json(404, {'error': 'League not found'}));
    expect(find.text('League not found'), findsOneWidget);
    expect(find.byType(DataTable), findsNothing);
    expect(find.text('Standings'), findsNothing);
    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets("a backend that can't be reached says so, not League not found", (
    tester,
  ) async {
    final api = Api(baseUrl: h.base, client: _Down());
    await h.show(tester, api, '/l/k7m2pq');
    expect(find.textContaining("Can't reach the backend at"), findsOneWidget);
    expect(find.text('League not found'), findsNothing);
  });

  testWidgets('the page fits 375 px wide with ties on', (tester) async {
    final b = body();
    (b['league'] as Map)['allow_ties'] = true;
    await open(tester, h.json(200, b));
    expect(tester.takeException(), isNull);
    final scroll = tester.widgetList<Scrollable>(find.byType(Scrollable));
    expect(
      scroll.where((s) => s.axisDirection == AxisDirection.right).length,
      lessThanOrEqualTo(1),
    );
  });

  testWidgets("the league home's public link opens this page", (tester) async {
    final fake = h.Fake({
      'GET /api/leagues/abc123': h.json(200, h.league()),
      'GET /api/leagues/abc123/entrants': h.json(200, []),
      'GET /api/public/k7m2pq': h.json(200, body()),
    });
    await h.show(tester, fake.api, '/leagues/abc123');
    final shown = tester
        .widget<SelectableText>(find.byType(SelectableText))
        .data!;
    expect(shown, '${h.origin}/#/l/k7m2pq');
    // Opening that link in a browser means starting the app at its fragment.
    await tester.pumpWidget(const SizedBox());
    await h.show(tester, fake.api, Uri.parse(shown).fragment);
    expect(find.text('This week — Week 2'), findsOneWidget);
  });
}

class _Down extends http.BaseClient {
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) =>
      throw http.ClientException('down');
}
