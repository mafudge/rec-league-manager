import 'package:flutter_test/flutter_test.dart';
import 'package:rec_league_manager/main.dart';

void main() {
  testWidgets('says hello from the backend that answered', (tester) async {
    await tester.pumpWidget(RecLeagueApp(loadGreeting: () async => 'Hello from django'));
    await tester.pump();
    expect(find.text('Rec League Manager'), findsOneWidget);
    expect(find.text('Hello from django'), findsOneWidget);
  });
}
