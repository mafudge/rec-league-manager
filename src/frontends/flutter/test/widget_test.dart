import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rec_league_manager/main.dart';

Widget app({Future<String> Function(String)? sayHello}) => RecLeagueApp(
      loadGreeting: () async => 'Hello from django',
      sayHello: sayHello ?? (name) async => 'Hello $name',
    );

void main() {
  testWidgets('says hello from the backend that answered', (tester) async {
    await tester.pumpWidget(app());
    await tester.pump();
    expect(find.text('Rec League Manager'), findsOneWidget);
    expect(find.text('Hello from django'), findsOneWidget);
  });

  testWidgets('Say hello shows what the backend replies', (tester) async {
    final asked = <String>[];
    await tester.pumpWidget(app(sayHello: (name) async {
      asked.add(name);
      return 'Hello $name';
    }));
    await tester.enterText(find.widgetWithText(TextField, 'Your name'), 'Mike');
    await tester.tap(find.widgetWithText(FilledButton, 'Say hello'));
    await tester.pump();
    expect(asked, ['Mike']);
    expect(find.text('Hello Mike'), findsOneWidget);
  });

  testWidgets('pressing Enter in the box does the same', (tester) async {
    await tester.pumpWidget(app());
    await tester.enterText(find.widgetWithText(TextField, 'Your name'), 'Ada');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();
    expect(find.text('Hello Ada'), findsOneWidget);
  });

  testWidgets('a blank name is sent as typed, and the backend decides', (tester) async {
    final asked = <String>[];
    await tester.pumpWidget(app(sayHello: (name) async {
      asked.add(name);
      return 'Name is required';
    }));
    await tester.tap(find.widgetWithText(FilledButton, 'Say hello'));
    await tester.pump();
    expect(asked, ['']);
    expect(find.text('Name is required'), findsOneWidget);
  });
}
