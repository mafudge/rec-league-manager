import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rec_league_manager/api.dart';
import 'package:rec_league_manager/main.dart';

const base = 'http://localhost:8000';
const origin = 'http://localhost:3000';

http.Response json(int status, Object body) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

Map<String, dynamic> league([Map<String, dynamic> over = const {}]) => {
  'id': 'abc123',
  'slug': 'k7m2pq',
  'name': 'Tuesday Cornhole',
  'location': "Joe's Tavern",
  'sport': 'Cornhole',
  'season': 'Fall 2026',
  'weeks': 8,
  'allow_ties': false,
  ...over,
};

/// A fake backend: records requests, answers "METHOD path" from [routes] (auth/me always answers).
class Fake {
  Fake(this.routes) {
    api = Api(
      baseUrl: base,
      client: MockClient((req) async {
        sent.add(req);
        if (req.url.path == '/api/auth/me') {
          return json(200, {'email': 'dana@example.com'});
        }
        final r = routes['${req.method} ${req.url.path}'];
        if (r == null) return json(404, {'error': 'no route'});
        return r is http.Response Function(http.Request)
            ? r(req)
            : r as http.Response;
      }),
    )..setTokens('t1', 'r1');
  }
  final Map<String, Object> routes;
  final sent = <http.Request>[];
  late final Api api;

  List<http.Request> calls(String key) =>
      sent.where((r) => '${r.method} ${r.url.path}' == key).toList();
}

Future<void> show(WidgetTester tester, Api api, String route) async {
  tester.view.physicalSize = const Size(375 * 2, 800 * 2);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    RecLeagueApp(
      api: api,
      initialRoute: route,
      origin: origin,
      loadGreeting: () async => 'Hello from fake',
    ),
  );
  await tester.pumpAndSettle();
}

Finder field(String label) => find.widgetWithText(TextField, label);

/// An in-memory entrants backend with the league and its entrants.
Fake entrantsBackend([List<String> initial = const []]) {
  final entrants = [
    for (var i = 0; i < initial.length; i++) {'id': 'e$i', 'name': initial[i]},
  ];
  return Fake({
    'GET /api/leagues/abc123': json(200, league()),
    'GET /api/leagues/abc123/entrants': (http.Request r) => json(200, entrants),
    'POST /api/leagues/abc123/entrants': (http.Request r) {
      final name = (jsonDecode(r.body)['name'] as String).trim();
      if (name.isEmpty) return json(400, {'error': 'Name is required'});
      if (entrants.any(
        (e) => (e['name'] as String).toLowerCase() == name.toLowerCase(),
      )) {
        return json(409, {
          'error': 'An entrant with that name already exists in this league',
        });
      }
      final e = {'id': 'e${entrants.length}', 'name': name};
      entrants.add(e);
      return json(201, e);
    },
  });
}

void main() {
  group('league list', () {
    testWidgets('an empty list says so and offers Create a league', (
      tester,
    ) async {
      final fake = Fake({'GET /api/leagues': json(200, [])});
      await show(tester, fake.api, '/leagues');
      expect(find.text('My leagues'), findsOneWidget);
      expect(find.text('No leagues yet — create one.'), findsOneWidget);
      final get = fake.calls('GET /api/leagues').single;
      expect(get.url.toString(), '$base/api/leagues');
      expect(get.headers['authorization'], 'Bearer t1');
      expect(get.headers.containsKey('content-type'), isFalse);
      expect(get.body, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, 'Create a league'));
      await tester.pumpAndSettle();
      expect(find.text('Games can end in a tie'), findsOneWidget);
    });

    testWidgets(
      "a list shows each league's name and location and opens its home",
      (tester) async {
        final fake = Fake({
          'GET /api/leagues': json(200, [
            league(),
            league({
              'id': 'z9',
              'name': 'Thursday Darts',
              'location': 'The Pub',
            }),
          ]),
          'GET /api/leagues/z9': json(
            200,
            league({'id': 'z9', 'name': 'Thursday Darts'}),
          ),
          'GET /api/leagues/z9/entrants': json(200, []),
        });
        await show(tester, fake.api, '/leagues');
        expect(find.text('Tuesday Cornhole'), findsOneWidget);
        expect(find.text("Joe's Tavern"), findsOneWidget);
        expect(find.text('Thursday Darts'), findsOneWidget);
        expect(find.text('The Pub'), findsOneWidget);
        expect(find.text('No leagues yet — create one.'), findsNothing);
        await tester.tap(find.text('Thursday Darts'));
        await tester.pumpAndSettle();
        expect(fake.calls('GET /api/leagues/z9'), hasLength(1));
        expect(find.text('Copy public link'), findsOneWidget);
      },
    );

    testWidgets("shows the backend's problem text when it fails", (
      tester,
    ) async {
      final fake = Fake({'GET /api/leagues': json(500, {})});
      await show(tester, fake.api, '/leagues');
      expect(find.text('The backend had a problem (500)'), findsOneWidget);
    });

    testWidgets("shows the backend's own error text verbatim", (tester) async {
      final fake = Fake({
        'GET /api/leagues': json(400, {'error': 'Something specific'}),
      });
      await show(tester, fake.api, '/leagues');
      expect(find.text('Something specific'), findsOneWidget);
    });

    testWidgets('a signed-out visit goes to /signin and calls nothing', (
      tester,
    ) async {
      for (final route in ['/leagues', '/leagues/abc123']) {
        final fake = Fake({});
        fake.api.signOut();
        await show(tester, fake.api, route);
        expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
        expect(fake.sent, isEmpty);
      }
    });

    testWidgets('create a league, go Back, and the new league is listed', (
      tester,
    ) async {
      final leagues = [];
      final fake = Fake({
        'GET /api/leagues': (http.Request r) => json(200, leagues),
        'POST /api/leagues': (http.Request r) {
          leagues.add(league());
          return json(201, league());
        },
        'GET /api/leagues/abc123': json(200, league()),
        'GET /api/leagues/abc123/entrants': json(200, []),
      });
      await show(tester, fake.api, '/leagues');
      expect(find.text('No leagues yet — create one.'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Create a league'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Name'), 'Tuesday Cornhole');
      await tester.enterText(field('Location'), "Joe's Tavern");
      await tester.enterText(field('Weeks'), '8');
      await tester.ensureVisible(
        find.widgetWithText(FilledButton, 'Create league'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Create league'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('My leagues'), findsOneWidget);
      expect(find.text('Tuesday Cornhole'), findsOneWidget);
      expect(find.text('No leagues yet — create one.'), findsNothing);
    });

    testWidgets('when sign-in cannot be restored it goes to /signin', (
      tester,
    ) async {
      final fake = Fake({
        'GET /api/leagues': json(401, {'error': 'Sign in required'}),
        'POST /api/auth/refresh': json(401, {'error': 'Sign in required'}),
      });
      await show(tester, fake.api, '/leagues');
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
      expect(find.text("Can't reach the backend at $base"), findsNothing);
    });
  });

  group('create league', () {
    Future<void> fillAll(WidgetTester tester) async {
      await tester.enterText(field('Name'), 'Tuesday Cornhole');
      await tester.enterText(field('Location'), "Joe's Tavern");
      await tester.enterText(field('Sport'), 'Cornhole');
      await tester.enterText(field('Season'), 'Fall 2026');
      await tester.enterText(field('Weeks'), '8');
    }

    Future<void> submit(WidgetTester tester) async {
      await tester.ensureVisible(
        find.widgetWithText(FilledButton, 'Create league'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Create league'));
      await tester.pumpAndSettle();
    }

    testWidgets('has its fields and the tie box starts unchecked', (
      tester,
    ) async {
      await show(tester, Fake({}).api, '/leagues/new');
      for (final l in ['Name', 'Location', 'Sport', 'Season', 'Weeks']) {
        expect(field(l), findsOneWidget);
      }
      expect(
        tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
        isFalse,
      );
      expect(find.text('Games can end in a tie'), findsOneWidget);
    });

    testWidgets('submitting sends the values and goes to the new league', (
      tester,
    ) async {
      final fake = Fake({
        'POST /api/leagues': json(201, league()),
        'GET /api/leagues/abc123': json(200, league()),
        'GET /api/leagues/abc123/entrants': json(200, []),
      });
      await show(tester, fake.api, '/leagues/new');
      await fillAll(tester);
      await tester.tap(find.byType(CheckboxListTile));
      await submit(tester);
      final post = fake.calls('POST /api/leagues').single;
      expect(post.url.toString(), '$base/api/leagues');
      expect(post.headers['authorization'], 'Bearer t1');
      expect(post.headers['content-type'], startsWith('application/json'));
      expect(jsonDecode(post.body), {
        'name': 'Tuesday Cornhole',
        'location': "Joe's Tavern",
        'sport': 'Cornhole',
        'season': 'Fall 2026',
        'weeks': 8,
        'allow_ties': true,
      });
      expect(find.text('Tuesday Cornhole'), findsOneWidget);
      expect(fake.calls('GET /api/leagues/abc123'), hasLength(1));
    });

    testWidgets('a blank Weeks box is sent as null for the backend to refuse', (
      tester,
    ) async {
      final fake = Fake({
        'POST /api/leagues': json(400, {'error': 'Weeks must be at least 1'}),
      });
      await show(tester, fake.api, '/leagues/new');
      await fillAll(tester);
      await tester.enterText(field('Weeks'), '');
      await submit(tester);
      expect(find.text('Weeks must be at least 1'), findsOneWidget);
      expect(
        jsonDecode(fake.calls('POST /api/leagues').single.body)['weeks'],
        isNull,
      );
    });

    testWidgets(
      'text that is not a whole number is sent as typed, not guessed',
      (tester) async {
        final fake = Fake({
          'POST /api/leagues': json(400, {'error': 'Weeks must be at least 1'}),
        });
        await show(tester, fake.api, '/leagues/new');
        await fillAll(tester);
        await tester.enterText(field('Weeks'), '-3');
        await submit(tester);
        expect(
          jsonDecode(fake.calls('POST /api/leagues').single.body)['weeks'],
          '-3',
        );
      },
    );

    testWidgets(
      'a too-long name is not blocked by the input; the backend message shows',
      (tester) async {
        final fake = Fake({
          'POST /api/leagues': json(400, {
            'error': 'Name must be 100 characters or fewer',
          }),
        });
        await show(tester, fake.api, '/leagues/new');
        await fillAll(tester);
        await tester.enterText(field('Name'), 'x' * 101);
        expect(tester.widget<TextField>(field('Name')).maxLength, isNull);
        await submit(tester);
        expect(
          find.text('Name must be 100 characters or fewer'),
          findsOneWidget,
        );
        expect(
          (jsonDecode(fake.calls('POST /api/leagues').single.body)['name']
                  as String)
              .length,
          101,
        );
      },
    );

    testWidgets(
      'a 400 shows the backend message, stays on the form and keeps what was typed',
      (tester) async {
        final fake = Fake({
          'POST /api/leagues': json(400, {'error': 'Location is required'}),
        });
        await show(tester, fake.api, '/leagues/new');
        await fillAll(tester);
        await tester.enterText(field('Location'), '');
        await submit(tester);
        expect(find.text('Location is required'), findsOneWidget);
        expect(
          find.widgetWithText(FilledButton, 'Create league'),
          findsOneWidget,
        );
        expect(find.text('Tuesday Cornhole'), findsOneWidget);
      },
    );

    testWidgets('a signed-out visit goes to /signin', (tester) async {
      final fake = Fake({});
      fake.api.signOut();
      await show(tester, fake.api, '/leagues/new');
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
      expect(fake.sent, isEmpty);
    });

    testWidgets('a lost session on submit goes to /signin', (tester) async {
      final fake = Fake({
        'POST /api/leagues': json(401, {'error': 'Sign in required'}),
        'POST /api/auth/refresh': json(401, {'error': 'Sign in required'}),
      });
      await show(tester, fake.api, '/leagues/new');
      await fillAll(tester);
      await submit(tester);
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    });
  });

  group('league home', () {
    testWidgets(
      'shows name, location, sport · season and the public link, and copies it',
      (tester) async {
        final fake = entrantsBackend();
        String? copied;
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          (call) async {
            if (call.method == 'Clipboard.setData') {
              copied = (call.arguments as Map)['text'] as String;
            }
            return null;
          },
        );
        addTearDown(
          () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
            SystemChannels.platform,
            null,
          ),
        );
        await show(tester, fake.api, '/leagues/abc123');
        expect(find.text('Tuesday Cornhole'), findsOneWidget);
        expect(find.text("Joe's Tavern"), findsOneWidget);
        expect(find.text('Cornhole · Fall 2026'), findsOneWidget);
        expect(find.text('dana@example.com'), findsOneWidget);
        expect(find.text('$origin/#/l/k7m2pq'), findsOneWidget);
        expect(find.byType(SelectableText), findsWidgets);
        await tester.tap(find.text('Copy public link'));
        await tester.pumpAndSettle();
        expect(copied, '$origin/#/l/k7m2pq');
        expect(find.text('Link copied'), findsOneWidget);
        final get = fake.calls('GET /api/leagues/abc123').single;
        expect(get.url.toString(), '$base/api/leagues/abc123');
        expect(get.headers['authorization'], 'Bearer t1');
      },
    );

    testWidgets('the sport · season line leaves out what is blank', (
      tester,
    ) async {
      final fake = Fake({
        'GET /api/leagues/abc123': json(200, league({'season': ''})),
        'GET /api/leagues/abc123/entrants': json(200, []),
      });
      await show(tester, fake.api, '/leagues/abc123');
      expect(find.text('Cornhole'), findsOneWidget);
      final none = Fake({
        'GET /api/leagues/abc123': json(
          200,
          league({'season': '', 'sport': ''}),
        ),
        'GET /api/leagues/abc123/entrants': json(200, []),
      });
      await show(tester, none.api, '/leagues/abc123');
      expect(find.textContaining('·'), findsNothing);
    });

    testWidgets("another organizer's league shows the backend's 404 message", (
      tester,
    ) async {
      final fake = Fake({
        'GET /api/leagues/abc123': json(404, {'error': 'League not found'}),
      });
      await show(tester, fake.api, '/leagues/abc123');
      expect(find.text('League not found'), findsOneWidget);
    });

    testWidgets('a lost session goes to /signin', (tester) async {
      final fake = Fake({
        'GET /api/leagues/abc123': json(401, {'error': 'Sign in required'}),
        'POST /api/auth/refresh': json(401, {'error': 'Sign in required'}),
      });
      await show(tester, fake.api, '/leagues/abc123');
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    });

    testWidgets('an unknown path falls back to home', (tester) async {
      await show(tester, Fake({}).api, '/leagues/abc123/extra');
      expect(find.text('Hello from fake'), findsOneWidget);
    });
  });

  group('entrants tab', () {
    testWidgets(
      'the tabs are Entrants, Schedule and Standings, opening on Entrants',
      (tester) async {
        await show(
          tester,
          entrantsBackend(['Bag Ladies']).api,
          '/leagues/abc123',
        );
        for (final t in ['Entrants', 'Schedule', 'Standings']) {
          expect(find.widgetWithText(Tab, t), findsOneWidget);
        }
        expect(find.text('Bag Ladies'), findsOneWidget);
        await tester.tap(find.widgetWithText(Tab, 'Schedule'));
        await tester.pumpAndSettle();
        expect(find.text('Bag Ladies'), findsNothing);
        expect(field('Name'), findsNothing);
      },
    );

    testWidgets('existing entrants are listed in order', (tester) async {
      final fake = entrantsBackend(['Bag Ladies', 'Corn Stars']);
      await show(tester, fake.api, '/leagues/abc123');
      final get = fake.calls('GET /api/leagues/abc123/entrants').single;
      expect(get.headers['authorization'], 'Bearer t1');
      expect(get.body, isEmpty);
      expect(
        tester.getTopLeft(find.text('Bag Ladies')).dy,
        lessThan(tester.getTopLeft(find.text('Corn Stars')).dy),
      );
    });

    testWidgets('the name field and Add button share one row, inside 375 px', (
      tester,
    ) async {
      await show(tester, entrantsBackend().api, '/leagues/abc123');
      final box = tester.getRect(field('Name'));
      final add = tester.getRect(find.widgetWithText(FilledButton, 'Add'));
      expect((box.center.dy - add.center.dy).abs(), lessThan(30));
      expect(add.right, lessThanOrEqualTo(375));
      expect(box.left, greaterThanOrEqualTo(0));
    });

    testWidgets('adding shows the name in the list and clears the box', (
      tester,
    ) async {
      final fake = entrantsBackend();
      await show(tester, fake.api, '/leagues/abc123');
      await tester.enterText(field('Name'), 'Bag Ladies');
      await tester.tap(find.widgetWithText(FilledButton, 'Add'));
      await tester.pumpAndSettle();
      final post = fake.calls('POST /api/leagues/abc123/entrants').single;
      expect(post.url.toString(), '$base/api/leagues/abc123/entrants');
      expect(post.headers['authorization'], 'Bearer t1');
      expect(post.headers['content-type'], startsWith('application/json'));
      expect(jsonDecode(post.body), {'name': 'Bag Ladies'});
      expect(find.text('Bag Ladies'), findsOneWidget);
      expect(tester.widget<TextField>(field('Name')).controller!.text, '');
    });

    testWidgets(
      "the backend's refusal is shown verbatim and the box keeps what was typed",
      (tester) async {
        await show(
          tester,
          entrantsBackend(['Bag Ladies']).api,
          '/leagues/abc123',
        );
        await tester.enterText(field('Name'), ' bag ladies ');
        await tester.tap(find.widgetWithText(FilledButton, 'Add'));
        await tester.pumpAndSettle();
        expect(
          find.text('An entrant with that name already exists in this league'),
          findsOneWidget,
        );
        expect(
          tester.widget<TextField>(field('Name')).controller!.text,
          ' bag ladies ',
        );
        expect(find.text('Bag Ladies'), findsOneWidget);
      },
    );

    testWidgets('a blank name is sent, and the backend says Name is required', (
      tester,
    ) async {
      final fake = entrantsBackend();
      await show(tester, fake.api, '/leagues/abc123');
      await tester.tap(find.widgetWithText(FilledButton, 'Add'));
      await tester.pumpAndSettle();
      expect(find.text('Name is required'), findsOneWidget);
      expect(fake.calls('POST /api/leagues/abc123/entrants'), hasLength(1));
    });

    testWidgets(
      'an empty league says so, and the line goes once someone is added',
      (tester) async {
        await show(tester, entrantsBackend().api, '/leagues/abc123');
        expect(
          find.text('No entrants yet — add the first one.'),
          findsOneWidget,
        );
        await tester.enterText(field('Name'), 'Bag Ladies');
        await tester.tap(find.widgetWithText(FilledButton, 'Add'));
        await tester.pumpAndSettle();
        expect(find.text('No entrants yet — add the first one.'), findsNothing);
      },
    );

    testWidgets('the empty line is not shown to a league that has entrants', (
      tester,
    ) async {
      await show(
        tester,
        entrantsBackend(['Bag Ladies']).api,
        '/leagues/abc123',
      );
      expect(find.text('No entrants yet — add the first one.'), findsNothing);
    });

    testWidgets('a lost session on the first load goes to /signin', (
      tester,
    ) async {
      final fake = Fake({
        'GET /api/leagues/abc123': json(200, league()),
        'GET /api/leagues/abc123/entrants': json(401, {
          'error': 'Sign in required',
        }),
        'POST /api/auth/refresh': json(401, {'error': 'Sign in required'}),
      });
      await show(tester, fake.api, '/leagues/abc123');
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    });

    testWidgets('a lost session when adding goes to /signin', (tester) async {
      final fake = Fake({
        'GET /api/leagues/abc123': json(200, league()),
        'GET /api/leagues/abc123/entrants': json(200, []),
        'POST /api/leagues/abc123/entrants': json(401, {
          'error': 'Sign in required',
        }),
        'POST /api/auth/refresh': json(401, {'error': 'Sign in required'}),
      });
      await show(tester, fake.api, '/leagues/abc123');
      await tester.enterText(field('Name'), 'Bag Ladies');
      await tester.tap(find.widgetWithText(FilledButton, 'Add'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
    });
  });
}
