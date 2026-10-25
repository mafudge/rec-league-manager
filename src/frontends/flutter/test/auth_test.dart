import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rec_league_manager/api.dart';
import 'package:rec_league_manager/main.dart';

const base = 'http://localhost:8000';

http.Response json(int status, Object body) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

/// A fake backend: records requests, answers per path.
class Fake {
  Fake(this.answer);
  final http.Response Function(http.Request req) answer;
  final sent = <http.Request>[];
  late final api = Api(
    baseUrl: base,
    client: MockClient((req) async {
      sent.add(req);
      return answer(req);
    }),
  );
}

Future<void> show(WidgetTester tester, Api api, String route) async {
  tester.view.physicalSize = const Size(375 * 2, 800 * 2);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    RecLeagueApp(
      api: api,
      initialRoute: route,
      loadGreeting: () async => 'Hello from fake',
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> fill(WidgetTester tester, String email, String password) async {
  await tester.enterText(find.widgetWithText(TextField, 'Email'), email);
  await tester.enterText(find.widgetWithText(TextField, 'Password'), password);
}

http.Response okBackend(http.Request r) {
  switch (r.url.path) {
    case '/api/auth/signup':
    case '/api/auth/login':
      return json(r.url.path.endsWith('signup') ? 201 : 200, {
        'token': 't1',
        'refresh_token': 'r1',
      });
    case '/api/auth/me':
      return json(200, {'email': 'dana@example.com'});
  }
  return json(404, {'error': 'nope'});
}

void main() {
  group('sign up', () {
    testWidgets('has the web copy and links to sign in', (tester) async {
      await show(tester, Fake(okBackend).api, '/signup');
      expect(find.text('Create your account'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Email'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Password'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Sign up'), findsOneWidget);
      expect(find.text('Already have an account?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('Sign in'), findsWidgets);
      expect(find.text('New here?'), findsOneWidget);
    });

    testWidgets('sends what was typed and lands on My leagues, signed in', (
      tester,
    ) async {
      final fake = Fake(okBackend);
      await show(tester, fake.api, '/signup');
      await fill(tester, ' Dana@Example.com ', 'longenough');
      await tester.tap(find.widgetWithText(FilledButton, 'Sign up'));
      await tester.pumpAndSettle();
      final signup = fake.sent.first;
      expect('${signup.method} ${signup.url}', 'POST $base/api/auth/signup');
      expect(jsonDecode(signup.body), {
        'email': ' Dana@Example.com ',
        'password': 'longenough',
      });
      expect(find.text('My leagues'), findsOneWidget);
      expect(find.text('dana@example.com'), findsOneWidget);
      final me = fake.sent.firstWhere((r) => r.url.path == '/api/auth/me');
      expect(me.headers['authorization'], 'Bearer t1');
    });

    for (final msg in [
      'An account with that email already exists',
      'Password must be at least 8 characters',
      'Enter a valid email address',
      'Password must be 72 characters or fewer',
    ]) {
      testWidgets('shows the backend refusal verbatim: $msg', (tester) async {
        final fake = Fake((r) => json(400, {'error': msg}));
        await show(tester, fake.api, '/signup');
        await fill(tester, 'x', 'y');
        await tester.tap(find.widgetWithText(FilledButton, 'Sign up'));
        await tester.pumpAndSettle();
        expect(find.text(msg), findsOneWidget);
        expect(find.text('Create your account'), findsOneWidget);
        expect(fake.api.signedIn, isFalse);
      });
    }

    testWidgets('says where it looked when nothing answers', (tester) async {
      final api = Api(
        baseUrl: base,
        client: MockClient((_) async => throw http.ClientException('down')),
      );
      await show(tester, api, '/signup');
      await tester.tap(find.widgetWithText(FilledButton, 'Sign up'));
      await tester.pumpAndSettle();
      expect(find.text("Can't reach the backend at $base"), findsOneWidget);
    });
  });

  group('sign in', () {
    testWidgets('has the web copy and links to sign up', (tester) async {
      await show(tester, Fake(okBackend).api, '/signin');
      expect(find.text('Sign in'), findsNWidgets(2)); // heading and button
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
      expect(find.text('New here?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Sign up'));
      await tester.pumpAndSettle();
      expect(find.text('Create your account'), findsOneWidget);
    });

    testWidgets(
      'a registered email and password land on My leagues (Enter submits)',
      (tester) async {
        final fake = Fake(okBackend);
        await show(tester, fake.api, '/signin');
        await fill(tester, 'dana@example.com', 'longenough');
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();
        expect(fake.sent.first.url.path, '/api/auth/login');
        expect(jsonDecode(fake.sent.first.body), {
          'email': 'dana@example.com',
          'password': 'longenough',
        });
        expect(find.text('My leagues'), findsOneWidget);
      },
    );

    testWidgets(
      'a wrong password stays on sign in, shows the refusal, and shows no league',
      (tester) async {
        final fake = Fake(
          (r) => json(401, {'error': 'Email or password is incorrect'}),
        );
        await show(tester, fake.api, '/signin');
        await fill(tester, 'dana@example.com', 'wrong');
        await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
        await tester.pumpAndSettle();
        expect(find.text('Email or password is incorrect'), findsOneWidget);
        expect(find.text('My leagues'), findsNothing);
        expect(fake.sent, hasLength(1)); // no refresh attempt
      },
    );
  });

  group('organizer screens', () {
    testWidgets('a signed-out visit goes to sign in and calls nothing', (
      tester,
    ) async {
      final fake = Fake(okBackend);
      await show(tester, fake.api, '/leagues');
      expect(find.text('My leagues'), findsNothing);
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
      expect(fake.sent, isEmpty);
    });

    testWidgets(
      'the header shows who is signed in; Sign out forgets the tokens, sends nothing, goes to sign in',
      (tester) async {
        final fake = Fake(okBackend);
        fake.api.setTokens('t1', 'r1');
        await show(tester, fake.api, '/leagues');
        expect(find.text('dana@example.com'), findsOneWidget);
        final before = fake.sent.length;
        await tester.tap(find.text('Sign out'));
        await tester.pumpAndSettle();
        expect(fake.api.signedIn, isFalse);
        expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
        expect(fake.sent, hasLength(before)); // signing out sends nothing
        // Back must not reveal the organizer page.
        expect(find.text('My leagues'), findsNothing);
      },
    );

    testWidgets('when sign-in can\'t be restored it goes to sign in', (
      tester,
    ) async {
      final fake = Fake((r) => json(401, {'error': 'Sign in required'}));
      fake.api.setTokens('t1', 'r1');
      await show(tester, fake.api, '/leagues');
      expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
      expect(fake.api.signedIn, isFalse);
    });
  });

  group('home', () {
    testWidgets('links to Sign up and Sign in', (tester) async {
      await show(tester, Fake(okBackend).api, '/');
      expect(find.text('Hello from fake'), findsOneWidget);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Sign up'));
      await tester.pumpAndSettle();
      expect(find.text('Create your account'), findsOneWidget);
    });
  });

  group('deep links', () {
    testWidgets(
      'a deep link opens only that page: nothing under it to go back to',
      (tester) async {
        await show(tester, Fake(okBackend).api, '/signup');
        expect(find.byType(BackButton), findsNothing);
      },
    );
    testWidgets('default route name', (tester) async {
      tester.platformDispatcher.defaultRouteNameTestValue = '/signup';
      addTearDown(tester.platformDispatcher.clearDefaultRouteNameTestValue);
      await tester.pumpWidget(
        RecLeagueApp(api: Fake(okBackend).api, loadGreeting: () async => 'x'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Create your account'), findsOneWidget);
      expect(find.byType(BackButton), findsNothing);
    });
  });
}
