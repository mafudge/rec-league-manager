import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/auth_form.dart';
import 'screens/home.dart';
import 'screens/league_home.dart';
import 'screens/league_form.dart';
import 'screens/leagues.dart';
import 'screens/organizer_scaffold.dart';
import 'screens/public.dart';

export 'screens/home.dart' show fetchGreeting, sayHello;

void main() => runApp(RecLeagueApp(api: Api()));

class RecLeagueApp extends StatelessWidget {
  RecLeagueApp({
    super.key,
    Api? api,
    this.initialRoute,
    this.origin,
    this.loadGreeting = fetchGreeting,
    this.sayHello = defaultSayHello,
  }) : api = api ?? Api();

  final Api api;
  final String? initialRoute;

  /// This app's own origin, for the public link; defaults to the page's (`Uri.base`).
  final String? origin;
  final Future<String> Function() loadGreeting;
  final Future<String> Function(String name) sayHello;

  /// Routes read the path of the (hash) URL, so `/#/l/<slug>` deep links work on any static server.
  /// Organizer screens (`/leagues`, `/leagues/new`, `/leagues/<id>`) are wrapped in [OrganizerScaffold], which sends a
  /// signed-out visit to `/signin`; the public page `/l/<slug>` is not.
  Route<dynamic> _route(RouteSettings settings) {
    final uri = Uri.parse(settings.name ?? '/');
    final path = uri.path;
    final seg = uri.pathSegments;
    final Widget screen = switch (path) {
      '/signup' => AuthForm(api: api, signup: true),
      '/signin' => AuthForm(api: api, signup: false),
      '/leagues' => OrganizerScaffold(
        api: api,
        child: LeaguesPage(api: api),
      ),
      '/leagues/new' => OrganizerScaffold(
        api: api,
        child: NewLeaguePage(api: api),
      ),
      _ when seg.length == 2 && seg[0] == 'leagues' && seg[1].isNotEmpty =>
        OrganizerScaffold(
          api: api,
          child: LeagueHome(api: api, id: seg[1], origin: origin),
        ),
      _ when seg.length == 2 && seg[0] == 'l' && seg[1].isNotEmpty =>
        PublicPage(api: api, slug: seg[1]),
      _ => HomePage(loadGreeting: loadGreeting, sayHello: sayHello),
    };
    return MaterialPageRoute<void>(settings: settings, builder: (_) => screen);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Rec League Manager',
      theme: ThemeData(colorSchemeSeed: Colors.green),
      initialRoute: initialRoute,
      onGenerateRoute: _route,
      // Open only the page asked for; the default would also stack the home page under `/signup`.
      onGenerateInitialRoutes: (name) => [_route(RouteSettings(name: name))],
    );
  }
}
