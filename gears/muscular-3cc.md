# Exact constant-effort three-compartment fatigue (2833)

For resting, active and fatigued fractions r, a and f, with r + a + f = 1:

```
da/dt = e r - F a
df/dt = F a - R f
x = (a, f), A = [-(e+F), -e; F, -R], b = (e, 0)
D = det(A) = e(F+R) + FR
x* = (eR/D, eF/D)
x(T) = x* + exp(AT) (x(0) - x*)
r(T) = 1 - a(T) - f(T)
```

The integrator in `src/muscular.ts` is exact under constant effort and recovery
multiplier per call, up to floating-point roundoff. Evidence level **1**: an exact
solution of the model's own equations, not a new empirical validation claim.

The Cayley-Hamilton form uses h = (e+F+R)/2, B = A+hI and d² = h²-D:

- d² > 0: exp(AT) = exp(-hT)[cosh(dT)I + sinh(dT)B/d].
- d² = 0: exp(AT) = exp(-hT)[I + TB].
- d² < 0: set w = sqrt(-d²); exp(AT) = exp(-hT)[cos(wT)I + sin(wT)B/w].

For real distinct roots the implementation combines the two nonpositive
eigenvalue exponentials directly, avoiding overflow of cosh over long calls;
the slow eigenvalue is -D/(h+d). `expm1` preserves small increments. Zero effort
retains the existing release of active fibres and exact exponential recovery.
The existing bounds checks and (2832) rounding guard run once at the call end.

Trace records the three integrated directed transfers e integral(r),
F integral(a), R integral(f), at the call's start time, and one sum check at its
end. These include circulation, even at steady state. The integral follows
from A^-1(x(T)-x(0)) + T x*. For short calls, a Taylor integral of the full
three-compartment generator avoids cancellation: 18 matrix powers for
(e+F+R)T < 0.5, with an omitted tail below double precision. This is evaluation
of the analytic integral, not a time-stepping approximation.

F and the base R still come from `muscular.fatigue_rates`: Frey Law, Looft and
Heitsman (2012), Table 1, as recorded in `flags/muscular.md` (2560). No rate or
activation row changes. R here is the row's R times the caller's existing
recovery multiplier. The empirical scope remains that of (2634)'s independent
Vernillo 2018 endpoint checks in `test/fatigue.test.ts` and
`data/library/validation/muscle_fatigue_data.json`; full trajectories and activation-to-effort
mapping remain unvalidated. `test/muscular.test.ts` verifies the numerical
change against the old Euler integrator, all eigenvalue cases, split calls,
integrated transfers and twelve-hour calls.
