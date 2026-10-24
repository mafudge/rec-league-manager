import 'package:flutter/material.dart';

import '../api.dart';

/// Wraps every organizer screen. Signed out: go to /signin. Signed in: the header shows who is signed in
/// (`GET /api/auth/me`) and a way out. Sign-out is client-side only: tokens are forgotten, nothing is sent (spec §5).
class OrganizerScaffold extends StatefulWidget {
  const OrganizerScaffold({super.key, required this.api, required this.child});

  final Api api;
  final Widget child;

  @override
  State<OrganizerScaffold> createState() => _OrganizerScaffoldState();
}

class _OrganizerScaffoldState extends State<OrganizerScaffold> {
  String _email = '';

  @override
  void initState() {
    super.initState();
    if (!widget.api.signedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _toSignIn());
      return;
    }
    widget.api
        .fetchMe()
        .then((email) {
          if (mounted) setState(() => _email = email);
        })
        .catchError((Object e) {
          // A failed refresh redirects; anything else just leaves the email blank.
          if (e is SignInRequired && mounted) _toSignIn();
        });
  }

  void _toSignIn() =>
      Navigator.pushNamedAndRemoveUntil(context, '/signin', (_) => false);

  void _signOut() {
    widget.api.signOut();
    _toSignIn();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.api.signedIn) return const Scaffold();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _email,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        actions: [
          TextButton(onPressed: _signOut, child: const Text('Sign out')),
        ],
      ),
      body: widget.child,
    );
  }
}
