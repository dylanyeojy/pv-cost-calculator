---
description: Rules for working with shell optimization, dish end, and cost calculation logic
---

- Shell optimization logic lives in `src/lib/calculations.ts`. Dish end geometry and nesting live in `src/lib/dishEndCalculations.ts`. Keep them separate — do not merge.
- Material densities are defined as constants in `src/lib/types.ts`: CS = 7850 kg/m³, SS = 8000 kg/m³. Import them — do not hardcode elsewhere.
- All physical inputs and internal calculations use SI units (metres, kilograms, etc.). Convert to display units (mm, tonnes) only at the UI layer.
- Plate size constants, material type enums (`carbon_steel | stainless_steel`), SS grades (`SS304 | SS316 | SS316L`), and head types (`ellipsoidal | torispherical | hemispherical | flat`) are all defined in `src/lib/types.ts`. Extend there, not inline.
- If modifying a calculation function, verify the output against a known manual test case before shipping. The output feeds directly into cost totals shown to the user.
- Segmentation penalty parameters (`segmentationWeight`, `segmentationExponent`) come from `config/advanced` in Firestore — do not hardcode them.
