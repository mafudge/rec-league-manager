import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Android: every build may use the network, but only debug builds may use plain
// http:// (the local backends don't speak HTTPS). Release builds refuse it.
void main() {
  final main = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
  final debug = File('android/app/src/debug/AndroidManifest.xml').readAsStringSync();
  const internet = 'android.permission.INTERNET';

  test('every build may use the network', () {
    expect(main, contains(internet));
  });

  test('release builds do not allow cleartext http', () {
    expect(main, isNot(contains('usesCleartextTraffic')));
  });

  test('debug builds allow cleartext http to local backends', () {
    expect(debug, contains('android:usesCleartextTraffic="true"'));
  });
}
