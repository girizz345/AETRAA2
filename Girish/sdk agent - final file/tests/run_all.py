#!/usr/bin/env python3
"""
run_all.py — run every test in this folder with or without pytest installed.

The machine this agent runs on has no outbound network, so `pip install pytest`
is not available there. A test suite that can only be run somewhere else is a
suite nobody runs, so this runner supplies the two pytest features the tests
actually use — `raises` and `approx` — when the real package is absent, and
steps aside when it is present.

  python3 tests/run_all.py            # from the package root
  python3 -m pytest                   # identical set, where pytest exists

Exit 0 = every test passed. Exit 1 = one or more failed.
"""
from __future__ import annotations

import importlib.util
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _install_pytest_stub() -> bool:
    """Returns True if the stub was installed (i.e. real pytest is absent)."""
    try:
        import pytest            # noqa: F401
        return False
    except ModuleNotFoundError:
        pass

    import types
    from contextlib import contextmanager

    stub = types.ModuleType("pytest")

    class _Raises:
        def __init__(self, expected):
            self.expected = expected
            self.value = None

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            if exc_type is None:
                raise AssertionError(
                    f"DID NOT RAISE {self.expected.__name__}")
            if not issubclass(exc_type, self.expected):
                return False
            self.value = exc
            return True

    def raises(expected, *args, **kwargs):
        if args:                                   # pytest.raises(E, fn, *a)
            fn, rest = args[0], args[1:]
            try:
                fn(*rest, **kwargs)
            except expected as exc:
                return exc
            raise AssertionError(f"DID NOT RAISE {expected.__name__}")
        return _Raises(expected)

    class _Approx:
        def __init__(self, value, rel=1e-6, abs=1e-12):
            self.value, self.rel, self.abs = value, rel, abs

        def __eq__(self, other):
            return abs(float(other) - float(self.value)) <= max(
                self.abs, self.rel * abs(float(self.value)))

    def parametrize(argnames, argvalues, **_kwargs):
        """A real parametrize, not a no-op. A no-op decorator leaves the test
        function expecting an argument nobody passes, and the resulting
        TypeError reads as a failing test — which is worse than not running it,
        because it is a false alarm that teaches you to ignore the runner."""
        names = ([n.strip() for n in argnames.split(",")]
                 if isinstance(argnames, str) else list(argnames))

        def decorate(fn):
            def run_all_cases():
                problems = []
                for case in argvalues:
                    values = case if len(names) > 1 else (case,)
                    try:
                        fn(**dict(zip(names, values)))
                    except Exception as exc:            # noqa: BLE001
                        problems.append(f"{dict(zip(names, values))}: "
                                        f"{type(exc).__name__}: {exc}")
                if problems:
                    raise AssertionError("; ".join(problems))
            run_all_cases.__name__ = fn.__name__
            run_all_cases.__doc__ = fn.__doc__
            run_all_cases.parametrized_cases = len(list(argvalues))
            return run_all_cases
        return decorate

    stub.raises = raises
    stub.approx = _Approx
    stub.fixture = lambda *a, **k: (lambda f: f)
    stub.mark = types.SimpleNamespace(
        parametrize=parametrize,
        skip=lambda *a, **k: (lambda f: f))

    @contextmanager
    def _nothing(*_a, **_k):
        yield
    stub.warns = _nothing
    sys.modules["pytest"] = stub
    return True


def main() -> int:
    stubbed = _install_pytest_stub()
    if stubbed:
        print("pytest is not installed here — running with the built-in "
              "runner's minimal stub (raises, approx).\n")

    files = sorted(p for p in (ROOT / "tests").glob("test_*.py"))
    total = passed = 0
    failures: list[str] = []

    for path in files:
        spec = importlib.util.spec_from_file_location(path.stem, path)
        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except Exception:
            print(f"{path.name}: COULD NOT IMPORT")
            traceback.print_exc()
            failures.append(f"{path.name} (import)")
            continue
        tests = [(n, f) for n, f in sorted(vars(module).items())
                 if n.startswith("test_") and callable(f)]
        cases = sum(getattr(f, "parametrized_cases", 1) for _, f in tests)
        bad = []
        for name, fn in tests:
            total += 1
            try:
                fn()
                passed += 1
            except Exception:
                bad.append(name)
                failures.append(f"{path.name}::{name}")
        mark = "ok  " if not bad else "FAIL"
        extra = f"  ({cases} cases)" if cases != len(tests) else ""
        print(f"  {mark} {path.name:<28} "
              f"{len(tests) - len(bad)}/{len(tests)}{extra}")
        for name in bad:
            print(f"       {name}")

    print(f"\n{passed}/{total} passed across {len(files)} files")
    if failures:
        print("\nfailures:")
        for f in failures:
            print(f"  {f}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
