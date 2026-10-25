import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rec_league_manager/api.dart';

const base = 'http://localhost:8000';

/// Records every request the client sends and answers from [answer].
class Recorder {
  Recorder(this.answer);
  final http.Response Function(http.Request req, int n) answer;
  final sent = <http.Request>[];
  late final client = MockClient((req) async {
    sent.add(req);
    return answer(req, sent.length);
  });
}

http.Response json(int status, Object body) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

Map<String, dynamic> bodyOf(http.Request r) =>
    jsonDecode(r.body) as Map<String, dynamic>;

void main() {
  group('request', () {
    test(
      'a bodiless GET sends no body and no Content-Type, and no Authorization when not auth',
      () async {
        final rec = Recorder((_, _) => json(200, {'ok': true}));
        final api = Api(client: rec.client, baseUrl: '$base/');
        expect(await api.request('GET', '/api/leagues'), {'ok': true});
        final r = rec.sent.single;
        expect(r.method, 'GET');
        expect(r.url.toString(), '$base/api/leagues');
        expect(r.body, '');
        expect(r.headers.containsKey('content-type'), isFalse);
        expect(r.headers.containsKey('authorization'), isFalse);
      },
    );

    test(
      'a bodiless POST (schedule) and DELETE (scores) send no body and no Content-Type',
      () async {
        final rec = Recorder((_, _) => json(200, {}));
        final api = Api(client: rec.client, baseUrl: base);
        api.setTokens('t1', 'r1');
        await api.request('POST', '/api/leagues/abc/schedule', auth: true);
        await api.request('DELETE', '/api/leagues/abc/scores', auth: true);
        expect(
          [for (final r in rec.sent) '${r.method} ${r.url}'],
          [
            'POST $base/api/leagues/abc/schedule',
            'DELETE $base/api/leagues/abc/scores',
          ],
        );
        for (final r in rec.sent) {
          expect(r.body, '');
          expect(r.headers.containsKey('content-type'), isFalse);
          expect(r.headers['authorization'], 'Bearer t1');
        }
      },
    );

    test(
      'a body is sent as a JSON object with Content-Type application/json',
      () async {
        final rec = Recorder(
          (_, _) => json(201, {'token': 'a', 'refresh_token': 'b'}),
        );
        final api = Api(client: rec.client, baseUrl: base);
        await api.request(
          'POST',
          '/api/auth/signup',
          body: {'email': 'a@b.c', 'password': 'pw'},
        );
        final r = rec.sent.single;
        expect(r.method, 'POST');
        expect(r.url.toString(), '$base/api/auth/signup');
        expect(r.headers['content-type'], startsWith('application/json'));
        expect(bodyOf(r), {'email': 'a@b.c', 'password': 'pw'});
        expect(r.headers.containsKey('authorization'), isFalse);
      },
    );

    test(
      'a 4xx with an error body is BackendRefused with the backend\'s words',
      () async {
        final rec = Recorder(
          (_, _) =>
              json(409, {'error': 'An account with that email already exists'}),
        );
        final api = Api(client: rec.client, baseUrl: base);
        await expectLater(
          api.request('POST', '/api/auth/signup', body: {}),
          throwsA(
            isA<BackendRefused>().having(
              (e) => e.message,
              'message',
              'An account with that email already exists',
            ),
          ),
        );
      },
    );

    test(
      'a 5xx, or a 4xx without an error, is BackendProblem(status)',
      () async {
        for (final res in [
          http.Response('<html>', 500),
          http.Response('', 404),
          json(400, {'nope': 1}),
        ]) {
          final api = Api(client: MockClient((_) async => res), baseUrl: base);
          await expectLater(
            api.request('GET', '/api/x'),
            throwsA(
              isA<BackendProblem>().having(
                (e) => e.message,
                'message',
                'The backend had a problem (${res.statusCode})',
              ),
            ),
          );
        }
      },
    );

    test(
      'messageFor: backend words, the problem text, or where we looked',
      () async {
        final api = Api(
          client: MockClient((_) async => throw http.ClientException('x')),
          baseUrl: 'http://h:1',
        );
        expect(
          api.messageFor(BackendRefused('Name is required')),
          'Name is required',
        );
        expect(
          api.messageFor(BackendProblem(503)),
          'The backend had a problem (503)',
        );
        expect(
          api.messageFor(http.ClientException('x')),
          "Can't reach the backend at http://h:1",
        );
        Object? caught;
        try {
          await api.request('GET', '/api/x');
        } catch (e) {
          caught = e;
        }
        expect(api.messageFor(caught), "Can't reach the backend at http://h:1");
      },
    );
  });

  group('sign up / in', () {
    test(
      'signUp posts the typed email and password and keeps the token pair',
      () async {
        final rec = Recorder(
          (_, _) => json(201, {'token': 't1', 'refresh_token': 'r1'}),
        );
        final api = Api(client: rec.client, baseUrl: base);
        expect(api.signedIn, isFalse);
        await api.signUp(' Dana@Example.com ', 'pw');
        expect(api.signedIn, isTrue);
        final r = rec.sent.single;
        expect('${r.method} ${r.url}', 'POST $base/api/auth/signup');
        expect(bodyOf(r), {'email': ' Dana@Example.com ', 'password': 'pw'});
        expect(r.headers['content-type'], startsWith('application/json'));
      },
    );

    test(
      'signIn posts to /api/auth/login; a refusal keeps us signed out',
      () async {
        final rec = Recorder(
          (_, _) => json(401, {'error': 'Email or password is incorrect'}),
        );
        final api = Api(client: rec.client, baseUrl: base);
        await expectLater(
          api.signIn('a@b.c', 'bad'),
          throwsA(isA<BackendRefused>()),
        );
        expect(api.signedIn, isFalse);
        final r = rec.sent.single;
        expect('${r.method} ${r.url}', 'POST $base/api/auth/login');
        expect(bodyOf(r), {'email': 'a@b.c', 'password': 'bad'});
        expect(
          rec.sent,
          hasLength(1),
        ); // a 401 on login is not a reason to refresh
      },
    );

    test('fetchMe sends the bearer token', () async {
      final rec = Recorder((_, _) => json(200, {'email': 'dana@example.com'}));
      final api = Api(client: rec.client, baseUrl: base);
      api.setTokens('t1', 'r1');
      expect(await api.fetchMe(), 'dana@example.com');
      final r = rec.sent.single;
      expect('${r.method} ${r.url}', 'GET $base/api/auth/me');
      expect(r.headers['authorization'], 'Bearer t1');
      expect(r.body, '');
      expect(r.headers.containsKey('content-type'), isFalse);
    });

    test('signOut forgets the tokens and sends nothing', () async {
      final rec = Recorder((_, _) => json(200, {}));
      final api = Api(client: rec.client, baseUrl: base);
      api.setTokens('t1', 'r1');
      api.signOut();
      expect(api.signedIn, isFalse);
      expect(rec.sent, isEmpty);
    });
  });

  group('refresh', () {
    http.Response meThenRefresh(http.Request req, int n) {
      if (req.url.path == '/api/auth/refresh') {
        return json(200, {'token': 't2', 'refresh_token': 'r2'});
      }
      return req.headers['authorization'] == 'Bearer t2'
          ? json(200, {'email': 'a@b.c'})
          : json(401, {'error': 'Sign in required'});
    }

    test(
      'a 401 refreshes once with the refresh token, saves the pair and retries',
      () async {
        final rec = Recorder(meThenRefresh);
        final api = Api(client: rec.client, baseUrl: base);
        api.setTokens('t1', 'r1');
        expect(await api.fetchMe(), 'a@b.c');
        expect(
          [
            for (final r in rec.sent)
              '${r.method} ${r.url.path} ${r.headers['authorization']}',
          ],
          [
            'GET /api/auth/me Bearer t1',
            'POST /api/auth/refresh null',
            'GET /api/auth/me Bearer t2',
          ],
        );
        final refresh = rec.sent[1];
        expect(refresh.url.toString(), '$base/api/auth/refresh');
        expect(refresh.headers['content-type'], startsWith('application/json'));
        expect(bodyOf(refresh), {'refresh_token': 'r1'});
        // The next refresh must use the newest refresh token (r2), not the first.
        rec.sent.clear();
        final rec2 = Recorder((req, n) {
          if (req.url.path == '/api/auth/refresh') {
            return json(200, {'token': 't3', 'refresh_token': 'r3'});
          }
          return req.headers['authorization'] == 'Bearer t3'
              ? json(200, {'email': 'a@b.c'})
              : json(401, {'error': 'Sign in required'});
        });
        final api2 = Api(client: rec2.client, baseUrl: base);
        api2.setTokens('t1', 'r1');
        api2.setTokens('t2', 'r2'); // newest pair replaces the old one
        await api2.fetchMe();
        expect(bodyOf(rec2.sent[1]), {'refresh_token': 'r2'});
      },
    );

    test(
      'a second refresh later uses the refresh token the first one returned',
      () async {
        var n = 0;
        String valid = 't1';
        final rec = Recorder((req, _) {
          if (req.url.path == '/api/auth/refresh') {
            n++;
            valid = 't${n + 1}';
            return json(200, {'token': valid, 'refresh_token': 'r${n + 1}'});
          }
          return req.headers['authorization'] == 'Bearer $valid'
              ? json(200, {'email': 'a@b.c'})
              : json(401, {'error': 'Sign in required'});
        });
        final api = Api(client: rec.client, baseUrl: base);
        api.setTokens('t1', 'r1');
        await api.fetchMe(); // ok
        valid = 'expired'; // the access token lapses
        await api.fetchMe(); // refresh with r1 -> t2/r2
        valid = 'expired';
        await api.fetchMe(); // refresh with r2 -> t3/r3
        final sent = [
          for (final r in rec.sent.where(
            (r) => r.url.path == '/api/auth/refresh',
          ))
            bodyOf(r)['refresh_token'],
        ];
        expect(sent, ['r1', 'r2']);
      },
    );

    test('two calls that hit 401 together share one refresh', () async {
      final rec = Recorder(meThenRefresh);
      final api = Api(client: rec.client, baseUrl: base);
      api.setTokens('t1', 'r1');
      await Future.wait([api.fetchMe(), api.fetchMe()]);
      expect(
        rec.sent.where((r) => r.url.path == '/api/auth/refresh'),
        hasLength(1),
      );
    });

    test(
      'still 401 after the refresh: tokens forgotten, SignInRequired, no loop',
      () async {
        final rec = Recorder(
          (req, _) => req.url.path == '/api/auth/refresh'
              ? json(200, {'token': 't2', 'refresh_token': 'r2'})
              : json(401, {'error': 'Sign in required'}),
        );
        final api = Api(client: rec.client, baseUrl: base);
        api.setTokens('t1', 'r1');
        await expectLater(api.fetchMe(), throwsA(isA<SignInRequired>()));
        expect(api.signedIn, isFalse);
        expect(
          rec.sent,
          hasLength(3),
        ); // call, refresh, one retry; nothing more
      },
    );

    test(
      'refresh answered 400/401/403 forgets the tokens and throws SignInRequired',
      () async {
        for (final status in [400, 401, 403]) {
          final rec = Recorder(
            (req, _) => req.url.path == '/api/auth/refresh'
                ? json(status, {'error': 'Sign in required'})
                : json(401, {'error': 'Sign in required'}),
          );
          final api = Api(client: rec.client, baseUrl: base);
          api.setTokens('t1', 'r1');
          await expectLater(
            api.fetchMe(),
            throwsA(isA<SignInRequired>()),
            reason: '$status',
          );
          expect(api.signedIn, isFalse);
          expect(rec.sent, hasLength(2));
        }
      },
    );

    test(
      'any other refresh failure keeps the tokens and throws BackendProblem',
      () async {
        for (final status in [429, 500, 503]) {
          final rec = Recorder(
            (req, _) => req.url.path == '/api/auth/refresh'
                ? http.Response('oops', status)
                : json(401, {'error': 'Sign in required'}),
          );
          final api = Api(client: rec.client, baseUrl: base);
          api.setTokens('t1', 'r1');
          await expectLater(
            api.fetchMe(),
            throwsA(
              isA<BackendProblem>().having((e) => e.status, 'status', status),
            ),
          );
          expect(api.signedIn, isTrue);
        }
      },
    );

    test(
      'a 401 with no tokens at all is SignInRequired without calling refresh',
      () async {
        final rec = Recorder(
          (_, _) => json(401, {'error': 'Sign in required'}),
        );
        final api = Api(client: rec.client, baseUrl: base);
        await expectLater(api.fetchMe(), throwsA(isA<SignInRequired>()));
        expect(rec.sent, hasLength(1));
      },
    );
  });
}
