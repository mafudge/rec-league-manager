import 'package:flutter_test/flutter_test.dart';
import 'package:rec_league_manager/main.dart';

void main() {
  testWidgets('shows the title and backend status', (tester) async {
    await tester.pumpWidget(RecLeagueApp(loadStatus: () async => 'ok'));
    await tester.pump();
    expect(find.text('Rec League Manager'), findsOneWidget);
    expect(find.text('Backend: ok'), findsOneWidget);
  });

  testWidgets('shows unreachable when the backend is down', (tester) async {
    await tester.pumpWidget(RecLeagueApp(loadStatus: () async => 'backend unreachable'));
    await tester.pump();
    expect(find.text('Backend: backend unreachable'), findsOneWidget);
  });
}
