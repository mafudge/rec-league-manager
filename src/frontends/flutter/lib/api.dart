// The one client for every backend: they all serve the same REST contract (ADR 003).
import 'dart:convert';

import 'package:http/http.dart' as http;

const apiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:8000',
);

/// The backend understood the request and said no, e.g. "Name is required".
class BackendRefused implements Exception {
  BackendRefused(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Signed in is required and could not be restored: send the organizer to /signin.
class SignInRequired implements Exception {
  @override
  String toString() => 'Sign in required';
}

/// The backend answered, but with a failure it did not explain (5xx, or a 4xx with no `error`).
class BackendProblem implements Exception {
  BackendProblem(this.status);
  final int status;
  String get message => 'The backend had a problem ($status)';
  @override
  String toString() => message;
}

Uri _uri(String baseUrl, String path, [Map<String, String>? query]) {
  final base = baseUrl.replaceAll(RegExp(r'/+$'), '');
  return Uri.parse('$base$path').replace(queryParameters: query);
}

Future<Map<String, dynamic>> _get(Uri uri, http.Client? client) async {
  final r = await (client ?? http.Client())
      .get(uri)
      .timeout(const Duration(seconds: 3));
  if (r.statusCode != 200 && r.statusCode != 400) {
    throw http.ClientException('GET ${uri.path} returned ${r.statusCode}');
  }
  // JSON is always UTF-8; decode the bytes ourselves rather than rely on how http guesses the charset.
  final body = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
  if (r.statusCode == 400) {
    throw BackendRefused(
      body['error'] as String? ?? 'The backend refused the request',
    );
  }
  return body;
}

/// Asks the backend which one it is. Throws if it can't be reached.
Future<String> fetchBackendName({
  String baseUrl = apiUrl,
  http.Client? client,
}) async =>
    (await _get(_uri(baseUrl, '/api/backend'), client))['backend'] as String;

/// Asks the backend to greet [name]. Throws [BackendRefused] if it refuses the name.
Future<String> fetchHello(
  String name, {
  String baseUrl = apiUrl,
  http.Client? client,
}) async =>
    (await _get(_uri(baseUrl, '/api/hello', {'name': name}), client))['message']
        as String;

/// The one client for every contract route. Holds the organizer's token pair in memory (spec §7: lost on
/// reload, accepted). [client] and [baseUrl] are injectable for tests.
class Api {
  Api({http.Client? client, String? baseUrl})
    : _client = client ?? http.Client(),
      baseUrl = baseUrl ?? apiUrl;

  final http.Client _client;
  final String baseUrl;
  String? _token;
  String? _refreshToken;
  Future<bool>? _refreshing;

  bool get signedIn => _token != null;

  /// Replaces the token pair (what sign up, sign in and refresh answer).
  void setTokens(String token, String refreshToken) {
    _token = token;
    _refreshToken = refreshToken;
  }

  void _forget() {
    _token = null;
    _refreshToken = null;
  }

  /// Sign-out is client-side only: the tokens are forgotten, nothing is sent (spec §5).
  void signOut() => _forget();

  /// What to show for a failed call: the backend's own words, or where we looked if nothing answered.
  String messageFor(Object? e) => e is BackendRefused
      ? e.message
      : e is BackendProblem
      ? e.message
      : "Can't reach the backend at $baseUrl";

  Future<http.Response> _send(
    String method,
    Uri uri,
    Object? body,
    String? token,
  ) {
    final req = http.Request(method, uri);
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    // No body means no body and no Content-Type (Firebase breaks on `null` sent as JSON).
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    return _client.send(req).then(http.Response.fromStream);
  }

  /// One refresh at a time: calls that all hit 401 together share a single refresh request.
  /// False when the backend refuses the refresh token; [BackendProblem] when it merely failed.
  Future<bool> _refresh() => _refreshing ??= (() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null) return false;
    final r = await _send('POST', _uri(baseUrl, '/api/auth/refresh'), {
      'refresh_token': refreshToken,
    }, null);
    // Only a refusal means the tokens are no good; a blip (5xx, 429) must not sign the organizer out.
    if (r.statusCode == 400 || r.statusCode == 401 || r.statusCode == 403) {
      return false;
    }
    if (r.statusCode < 200 || r.statusCode >= 300) {
      throw BackendProblem(r.statusCode);
    }
    final pair = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
    setTokens(pair['token'] as String, pair['refresh_token'] as String);
    return true;
  })().whenComplete(() => _refreshing = null);

  /// One call for every contract route; returns the decoded JSON. A 4xx with an `error` body is
  /// [BackendRefused]; any other non-2xx is [BackendProblem]. With [auth] the bearer token is attached; on
  /// 401 the tokens are refreshed once and the call retried, and if that fails [SignInRequired] is thrown.
  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    bool auth = false,
  }) async {
    final uri = _uri(baseUrl, path);
    var r = await _send(method, uri, body, auth ? _token : null);
    if (auth && r.statusCode == 401) {
      if (!await _refresh()) {
        _forget();
        throw SignInRequired();
      }
      r = await _send(method, uri, body, _token);
      if (r.statusCode == 401) {
        _forget();
        throw SignInRequired();
      }
    }
    final text = utf8.decode(r.bodyBytes);
    if (r.statusCode < 200 || r.statusCode >= 300) {
      if (r.statusCode >= 400 && r.statusCode < 500) {
        try {
          final error = (jsonDecode(text) as Map<String, dynamic>)['error'];
          if (error is String && error.isNotEmpty) throw BackendRefused(error);
        } on FormatException {
          // not JSON: fall through to BackendProblem
        } on TypeError {
          // JSON but not an object
        }
      }
      throw BackendProblem(r.statusCode);
    }
    return jsonDecode(text);
  }

  Future<void> _saveTokens(Object? answer) {
    final pair = answer as Map<String, dynamic>;
    setTokens(pair['token'] as String, pair['refresh_token'] as String);
    return Future.value();
  }

  Future<void> signUp(String email, String password) async => _saveTokens(
    await request(
      'POST',
      '/api/auth/signup',
      body: {'email': email, 'password': password},
    ),
  );

  Future<void> signIn(String email, String password) async => _saveTokens(
    await request(
      'POST',
      '/api/auth/login',
      body: {'email': email, 'password': password},
    ),
  );

  /// The signed-in organizer's email.
  Future<String> fetchMe() async =>
      ((await request('GET', '/api/auth/me', auth: true))
              as Map<String, dynamic>)['email']
          as String;

  Future<List<League>> listLeagues() async => [
    for (final l in await request('GET', '/api/leagues', auth: true) as List)
      League.fromJson(l as Map<String, dynamic>),
  ];

  /// Sends [fields] as typed; the backend validates and answers [BackendRefused] with its own message.
  Future<League> createLeague(Map<String, dynamic> fields) async =>
      League.fromJson(
        await request('POST', '/api/leagues', body: fields, auth: true)
            as Map<String, dynamic>,
      );

  Future<League> getLeague(String id) async => League.fromJson(
    await request('GET', '/api/leagues/$id', auth: true)
        as Map<String, dynamic>,
  );

  Future<List<Entrant>> listEntrants(String leagueId) async => [
    for (final e
        in await request('GET', '/api/leagues/$leagueId/entrants', auth: true)
            as List)
      Entrant.fromJson(e as Map<String, dynamic>),
  ];

  Future<Entrant> addEntrant(String leagueId, String name) async =>
      Entrant.fromJson(
        await request(
              'POST',
              '/api/leagues/$leagueId/entrants',
              body: {'name': name},
              auth: true,
            )
            as Map<String, dynamic>,
      );

  /// Generates (or regenerates) the round robin; answers the backend's weeks `message`, or null.
  Future<String?> generateSchedule(String leagueId) async =>
      ((await request('POST', '/api/leagues/$leagueId/schedule', auth: true))
              as Map<String, dynamic>)['message']
          as String?;

  Future<List<Game>> listGames(String leagueId) async => [
    for (final g
        in await request('GET', '/api/leagues/$leagueId/games', auth: true)
            as List)
      Game.fromJson(g as Map<String, dynamic>),
  ];

  Future<Standings> getStandings(String leagueId) async => Standings.fromJson(
    await request('GET', '/api/leagues/$leagueId/standings', auth: true)
        as Map<String, dynamic>,
  );

  /// The public page's data: no token is attached, whoever is signed in.
  Future<PublicView> getPublic(String slug) async => PublicView.fromJson(
    await request('GET', '/api/public/$slug') as Map<String, dynamic>,
  );

  /// DELETE with no body and no Content-Type (Firebase).
  Future<void> clearScores(String leagueId) =>
      request('DELETE', '/api/leagues/$leagueId/scores', auth: true);

  /// Each score goes as given: a number, `""` for a blank field, text as typed, or `null` to clear.
  Future<Game> saveScore(String gameId, Object? home, Object? away) async =>
      Game.fromJson(
        await request(
              'PUT',
              '/api/games/$gameId/score',
              body: {'home_score': home, 'away_score': away},
              auth: true,
            )
            as Map<String, dynamic>,
      );
}

class Game {
  Game({
    required this.id,
    required this.week,
    required this.homeId,
    required this.homeName,
    this.awayId,
    this.awayName,
    this.homeScore,
    this.awayScore,
  });

  factory Game.fromJson(Map<String, dynamic> j) => Game(
    id: j['id'] as String,
    week: j['week'] as int,
    homeId: j['home_id'] as String,
    homeName: j['home_name'] as String,
    awayId: j['away_id'] as String?,
    awayName: j['away_name'] as String?,
    homeScore: j['home_score'] as int?,
    awayScore: j['away_score'] as int?,
  );

  final String id, homeId, homeName;
  final String? awayId, awayName;
  final int week;
  final int? homeScore, awayScore;

  bool get isBye => awayName == null;
  bool get played => homeScore != null && awayScore != null;
}

class League {
  League({
    required this.id,
    required this.slug,
    required this.name,
    required this.location,
    required this.sport,
    required this.season,
    required this.weeks,
    required this.allowTies,
  });

  factory League.fromJson(Map<String, dynamic> j) => League(
    id: (j['id'] as String?) ?? '', // the public League has no id
    slug: j['slug'] as String,
    name: j['name'] as String,
    location: j['location'] as String,
    sport: (j['sport'] as String?) ?? '',
    season: (j['season'] as String?) ?? '',
    weeks: j['weeks'] as int,
    allowTies: (j['allow_ties'] as bool?) ?? false,
  );

  final String id, slug, name, location, sport, season;
  final int weeks;
  final bool allowTies;
}

class Entrant {
  Entrant({required this.id, required this.name});
  factory Entrant.fromJson(Map<String, dynamic> j) =>
      Entrant(id: j['id'] as String, name: j['name'] as String);
  final String id, name;
}

class StandingsRow {
  StandingsRow.fromJson(Map<String, dynamic> j)
    : id = j['entrant_id'] as String,
      name = j['name'] as String,
      w = j['w'] as int,
      l = j['l'] as int,
      t = j['t'] as int,
      pf = j['pf'] as int,
      pa = j['pa'] as int,
      diff = j['diff'] as int;
  final String id, name;
  final int w, l, t, pf, pa, diff;
}

/// What `GET /api/leagues/{id}/standings` answers; the backend sorts the rows and words the tiebreak.
class Standings {
  Standings.fromJson(Map<String, dynamic> j)
    : rows = [
        for (final r in j['rows'] as List)
          StandingsRow.fromJson(r as Map<String, dynamic>),
      ],
      played = j['played'] as int,
      tiebreak = j['tiebreak'] as String;
  final List<StandingsRow> rows;
  final int played;
  final String tiebreak;
}

/// What `GET /api/public/{slug}` answers: the league (no id), this week, every game and the standings.
class PublicView {
  PublicView.fromJson(Map<String, dynamic> j)
    : league = League.fromJson(j['league'] as Map<String, dynamic>),
      currentWeek = j['current_week'] as int?,
      games = [
        for (final g in j['games'] as List)
          Game.fromJson(g as Map<String, dynamic>),
      ],
      standings = Standings.fromJson(j['standings'] as Map<String, dynamic>);
  final League league;
  final int? currentWeek;
  final List<Game> games;
  final Standings standings;
}
