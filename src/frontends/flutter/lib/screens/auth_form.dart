import 'package:flutter/material.dart';

import '../api.dart';

/// Sign up and sign in: sends what was typed; the backend's message is shown as-is (no validation of our own).
class AuthForm extends StatefulWidget {
  const AuthForm({super.key, required this.api, required this.signup});

  final Api api;
  final bool signup;

  @override
  State<AuthForm> createState() => _AuthFormState();
}

class _AuthFormState extends State<AuthForm> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String _message = '';
  bool _busy = false;

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      await (widget.signup ? widget.api.signUp : widget.api.signIn)(
        _email.text,
        _password.text,
      );
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/leagues');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = widget.api.messageFor(e);
        _busy = false;
      });
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final signup = widget.signup;
    return Scaffold(
      appBar: AppBar(title: const Text('Rec League Manager')),
      body: Center(
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      signup ? 'Create your account' : 'Sign in',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _email,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: OutlineInputBorder(),
                    ),
                    obscureText: true,
                    autofillHints: [
                      signup
                          ? AutofillHints.newPassword
                          : AutofillHints.password,
                    ],
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      _message,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(signup ? 'Sign up' : 'Sign in'),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(signup ? 'Already have an account?' : 'New here?'),
                      TextButton(
                        onPressed: () => Navigator.pushReplacementNamed(
                          context,
                          signup ? '/signin' : '/signup',
                        ),
                        child: Text(signup ? 'Sign in' : 'Sign up'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
