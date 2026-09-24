# Dwelling Service Load Calculator

A static, browser-based educational calculator for dwelling service load estimates using the NEC 2023 standard-method basis. Calculations run in the user's browser; the site does not use a backend, database, or login.

## Run locally

Open `index.html` in a modern browser, or serve the directory with any static HTTP server. Tests use Node's built-in test runner:

```sh
npm test
```

## Publish with GitHub Pages

The project is hosted in the public repository [`smdavies20-alt/aren4570-dwelling-service-calculator`](https://github.com/smdavies20-alt/aren4570-dwelling-service-calculator). Enable GitHub Pages from the repository's `main` branch and `/ (root)` directory. The project is static and requires no build step.

## Calculation notes

- Standard-method general demand, fixed-appliance demand, range demand, dryer demand, noncoincident heating/cooling, and the largest-motor adder are shown in the breakdown.
- Phase and neutral wire selections use the included copper 75°C ampacity schedule; the service grounding conductor uses the provided course Table 7.6 mapping.
- The requested neutral estimate includes general demand, demanded 120 V fixed-appliance loads, and 70% of calculated range and dryer demand. Heating/cooling and other 240 V line-to-line loads are excluded from neutral demand.
- Three-phase current is a balanced-load estimate using total VA divided by √3 × 208 V.
- This is a course aid, not a permit-ready design tool. Confirm code interpretation and installation conditions with the instructor and adopted NEC.
