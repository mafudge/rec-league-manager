import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/auth_form.dart';
import 'screens/home.dart';
import 'screens/leagues.dart';
import 'screens/organizer_scaffold.dart';

export 'screens/home.dart' show fetchGreeting, sayHello;

void main() => runApp(RecLeagueApp(api: Api()));

class RecLeagueApp extends StatelessWidget {
  RecLeagueApp({
    super.key,
    Api? api,
    this.initialRoute,
    this.loadGreeting = fetchGreeting,
    this.sayHello = defaultSayHello,
  }) : api = api ?? Api();

  final Api api;
  final String? initialRoute;
  final Future<String> Function() loadGreeting;
  final Future<String> Function(String name) sayHello;

  /// Routes read the path of the (hash) URL, so `/#/l/<slug>` deep links work on any static server.
  /// Organizer screens (`/leagues`, later `/leagues/<id>`) are wrapped in [OrganizerScaffold], which sends a
  /// signed-out visit to `/signin`; the public page `/l/<slug>` will not be.
  Route<dynamic> _route(RouteSettings settings) {
    final path = Uri.parse(settings.name ?? '/').path;
    final Widget screen = switch (path) {
      '/signup' => AuthForm(api: api, signup: true),
      '/signin' => AuthForm(api: api, signup: false),
      '/leagues' => OrganizerScaffold(api: api, child: const LeaguesPage()),
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
