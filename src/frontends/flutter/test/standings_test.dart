import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:rec_league_manager/api.dart';
import 'package:rec_league_manager/screens/standings.dart';

import 'leagues_test.dart' as h;

const tiebreak = 'Sorted by wins, then point difference, then points for.';

Map<String, dynamic> row(String n, int w, int l, int t, int pf, int pa) => {
  'entrant_id': n,
  'name': n,
  'w': w,
  'l': l,
  't': t,
  'pf': pf,
  'pa': pa,
  'diff': pf - pa,
};

Map<String, dynamic> standingsJson({int played = 1, bool zeros = false}) => {
  'rows': zeros
      ? [
          row('Bag Ladies', 0, 0, 0, 0, 0),
          row('Corn Stars', 0, 0, 0, 0, 0),
          row('Toss Bosses', 0, 0, 0, 0, 0),
        ]
      : [
          row('Bag Ladies', 1, 0, 0, 21, 14),
          row('Corn Stars', 0, 0, 0, 0, 0),
          row('Toss Bosses', 0, 1, 0, 14, 21),
        ],
  'played': played,
  'tiebreak': tiebreak,
};

Future<void> pumpTable(
  WidgetTester tester,
  Map<String, dynamic> json, {
  bool allowTies = false,
}) async {
  tester.view.physicalSize = const Size(375 * 2, 800 * 2);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: StandingsTable(
            standings: Standings.fromJson(json),
            allowTies: allowTies,
          ),
        ),
      ),
    ),
  );
}

/// Texts of the header row (first N cells) and of each body row.
List<List<String>> cells(WidgetTester tester) {
  final table = tester.widget<DataTable>(find.byType(DataTable));
  List<String> t(List<DataCell> cs) => [
    for (final c in cs) (c.child as Text).data!,
  ];
  return [
    [for (final c in table.columns) (c.label as Text).data!],
    for (final r in table.rows) t(r.cells),
  ];
}

void main() {
  testWidgets('columns are Entrant, W, L, PF, PA, Diff without ties', (
    tester,
  ) async {
    await pumpTable(tester, standingsJson());
    expect(cells(tester).first, ['Entrant', 'W', 'L', 'PF', 'PA', 'Diff']);
  });

  testWidgets('a T column appears when the league allows ties', (tester) async {
    await pumpTable(tester, standingsJson(), allowTies: true);
    expect(cells(tester).first, ['Entrant', 'W', 'L', 'T', 'PF', 'PA', 'Diff']);
  });

  testWidgets(
    'rows keep the backend order; Diff has a plus only when positive',
    (tester) async {
      await pumpTable(tester, standingsJson());
      expect(cells(tester).skip(1).toList(), [
        ['Bag Ladies', '1', '0', '21', '14', '+7'],
        ['Corn Stars', '0', '0', '0', '0', '0'],
        ['Toss Bosses', '0', '1', '14', '21', '-7'],
      ]);
    },
  );

  testWidgets('the table is not sortable', (tester) async {
    await pumpTable(tester, standingsJson());
    final table = tester.widget<DataTable>(find.byType(DataTable));
    expect(table.sortColumnIndex, isNull);
    expect(table.columns.every((c) => c.onSort == null), isTrue);
  });

  testWidgets('the tiebreak sentence is printed under the table', (
    tester,
  ) async {
    await pumpTable(tester, standingsJson());
    final table = tester.getBottomLeft(find.byType(DataTable)).dy;
    expect(tester.getTopLeft(find.text(tiebreak)).dy, greaterThan(table - 1));
  });

  testWidgets('with no games played it says so and still lists every entrant', (
    tester,
  ) async {
    await pumpTable(tester, standingsJson(played: 0, zeros: true));
    expect(find.text('No games played yet'), findsOneWidget);
    expect(cells(tester).length, 4);
  });

  testWidgets("once a game is played there is no 'No games played yet'", (
    tester,
  ) async {
    await pumpTable(tester, standingsJson());
    expect(find.text('No games played yet'), findsNothing);
  });

  testWidgets('the page does not scroll sideways at 375 px with ties on', (
    tester,
  ) async {
    await pumpTable(tester, standingsJson(), allowTies: true);
    expect(tester.takeException(), isNull);
    expect(tester.getTopRight(find.byType(DataTable)).dx, lessThan(375 * 3));
    final box = tester.getSize(find.byType(StandingsTable));
    expect(box.width, lessThanOrEqualTo(375));
  });

  group('Standings tab', () {
    h.Fake backend() {
      var n = 0;
      return h.Fake({
        'GET /api/leagues/abc123': h.json(200, h.league()),
        'GET /api/leagues/abc123/entrants': h.json(200, []),
        'GET /api/leagues/abc123/games': h.json(200, []),
        'GET /api/leagues/abc123/standings': (http.Request r) {
          n++;
          return h.json(200, standingsJson(played: n));
        },
      });
    }

    testWidgets('fetches the standings with the token each time it opens', (
      tester,
    ) async {
      final fake = backend();
      await h.show(tester, fake.api, '/leagues/abc123');
      await tester.tap(find.text('Standings'));
      await tester.pumpAndSettle();
      expect(find.text('Bag Ladies'), findsOneWidget);
      var c = fake.calls('GET /api/leagues/abc123/standings');
      expect(c.length, 1);
      expect(c.first.url.toString(), '${h.base}/api/leagues/abc123/standings');
      expect(c.first.headers['Authorization'], 'Bearer t1');
      expect(c.first.body, '');
      expect(c.first.headers.containsKey('Content-Type'), isFalse);

      await tester.tap(find.text('Schedule'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Standings'));
      await tester.pumpAndSettle();
      c = fake.calls('GET /api/leagues/abc123/standings');
      expect(c.length, 2);
    });

    testWidgets("shows the backend's refusal verbatim", (tester) async {
      final fake = h.Fake({
        'GET /api/leagues/abc123': h.json(200, h.league()),
        'GET /api/leagues/abc123/entrants': h.json(200, []),
        'GET /api/leagues/abc123/standings': h.json(404, {
          'error': 'League not found',
        }),
      });
      await h.show(tester, fake.api, '/leagues/abc123');
      await tester.tap(find.text('Standings'));
      await tester.pumpAndSettle();
      expect(find.text('League not found'), findsOneWidget);
    });
  });
}
