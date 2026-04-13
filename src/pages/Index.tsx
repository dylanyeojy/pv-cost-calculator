import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/lib/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CS_THICKNESSES,
    SS_THICKNESSES,
    HeadType,
    StraightFace,
    VesselOrientation,
    NozzleSpec,
    FlangeStandard,
    FlangeType,
    NozzleItemType,
    SA106_PIPE_SCHEDULE,
} from "@/lib/types";
import { suggestedSF, HEAD_TYPE_LABELS } from "@/lib/dishEndCalculations";
import { liveASMEPreview, LiveASMEPreviewResult } from "@/lib/calculations";
import {
    Calculator,
    Ruler,
    CircleDot,
    Minus,
    Plus as PlusIcon,
    Layers,
    Circle,
    Trash2,
} from "lucide-react";
import NumberFlow from "@number-flow/react";

export default function Index() {
    const {
        inputs,
        setInputs,
        dishEndInputs,
        setDishEndInputs,
        runCalculation,
    } = useAppContext();
    const navigate = useNavigate();

    const shellThicknesses =
        inputs.materialType === "SA516 Gr 70"
            ? CS_THICKNESSES
            : SS_THICKNESSES;
    const dishThicknesses =
        inputs.materialType === "SA516 Gr 70"
            ? CS_THICKNESSES
            : SS_THICKNESSES;

    const update = (field: string, value: any) => {
        setInputs((prev) => ({ ...prev, [field]: value }));
    };

    const updateDish = (field: string, value: any) => {
        setDishEndInputs((prev) => ({ ...prev, [field]: value }));
    };

    // Auto-suggest straight face when diameter changes
    const derivedID =
        inputs.diameterType === "OD"
            ? inputs.diameter - 2 * inputs.plateThickness
            : inputs.diameter;

    useEffect(() => {
        if (derivedID > 0) {
            const sf = suggestedSF(derivedID);
            setDishEndInputs((prev) => ({ ...prev, straightFace: sf }));
        }
    }, [derivedID]);

    const handleCalculate = () => {
        runCalculation();
        navigate("/results");
    };

    const [editingVesselQty, setEditingVesselQty] = useState(false);
    const [editingDishQty, setEditingDishQty] = useState(false);

    const [asmePreview, setAsmePreview] = useState<LiveASMEPreviewResult>({
        allowableStressMPa: null,
        shellTminMm: null,
        headTminMm: null,
        recommendedShellNominalMm: null,
        recommendedHeadNominalMm: null,
    });
    const [isShellThicknessOverridden, setIsShellThicknessOverridden] = useState(false);
    const [isDishEndThicknessOverridden, setIsDishEndThicknessOverridden] = useState(false);
    const [isDishEndQtyOverridden, setIsDishEndQtyOverridden] = useState(false);
    const asmeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (asmeDebounceRef.current) clearTimeout(asmeDebounceRef.current);
        asmeDebounceRef.current = setTimeout(() => {
            const liquidHeadKPa = inputs.orientation === "vertical"
                ? (1000 * 9.81 * (inputs.shellLength / 1000)) / 1000
                : 0;
            const result = liveASMEPreview({
                materialType: inputs.materialType,
                designPressureKPa: inputs.designPressure,
                liquidHeadKPa,
                designTempC: inputs.designTemperature,
                jointEfficiency: inputs.jointEfficiency,
                corrosionAllowanceMm: inputs.corrosionAllowance,
                diameterMm: inputs.diameter,
                diameterType: inputs.diameterType,
                headType: dishEndInputs.headType,
            });
            setAsmePreview(result);
            if (!isShellThicknessOverridden && result.recommendedShellNominalMm !== null) {
                update("plateThickness", result.recommendedShellNominalMm);
            }
            if (!isDishEndThicknessOverridden && result.recommendedHeadNominalMm !== null) {
                updateDish("plateThickness", result.recommendedHeadNominalMm);
            }
        }, 300);
        return () => { if (asmeDebounceRef.current) clearTimeout(asmeDebounceRef.current); };
    }, [
        inputs.materialType, inputs.designPressure, inputs.designTemperature,
        inputs.jointEfficiency, inputs.corrosionAllowance, inputs.diameter,
        inputs.diameterType, inputs.orientation, inputs.shellLength,
        dishEndInputs.headType,
    ]);

    useEffect(() => {
        if (!isDishEndQtyOverridden) {
            updateDish("quantity", (inputs.quantity ?? 1) * 2);
        }
    }, [inputs.quantity]);

    const isValid =
        inputs.projectName &&
        inputs.diameter > 0 &&
        inputs.shellLength > 0 &&
        inputs.plateThickness > 0;

    return (
        <div className="max-w-3xl mx-auto p-6 pb-20 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    New Estimate
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Configure vessel specifications to generate a cost estimate
                </p>
            </div>

            {/* Card 1 — Vessel Identity */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" />
                        Vessel Identity
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>
                                Project Name{" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                value={inputs.projectName}
                                onChange={(e) =>
                                    update("projectName", e.target.value)
                                }
                                placeholder="e.g. Petronas RAPID Phase 2"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Project ID</Label>
                            <Input
                                value={inputs.tagNumber}
                                onChange={(e) =>
                                    update("tagNumber", e.target.value)
                                }
                                placeholder="e.g. V-101"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Card — Orientation & Design Parameters */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-primary" />
                        Orientation & Design Parameters
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Material Type</Label>
                            <Select
                                value={inputs.materialType}
                                onValueChange={(v) => {
                                    update("materialType", v);
                                    update("filterPlateThickness", v === "SA516 Gr 70" ? 22.30 : 22.00);
                                    setIsShellThicknessOverridden(false);
                                    setIsDishEndThicknessOverridden(false);
                                }}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SA516 Gr 70">SA516 Gr 70</SelectItem>
                                    <SelectItem value="SS304">SS304</SelectItem>
                                    <SelectItem value="SS316">SS316</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Vessel Orientation</Label>
                            <Select
                                value={inputs.orientation}
                                onValueChange={(v) => update("orientation", v as VesselOrientation)}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vertical">Vertical</SelectItem>
                                    <SelectItem value="horizontal">Horizontal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Internal Design Pressure (kPa)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={inputs.designPressure || ""}
                                onChange={(e) => update("designPressure", parseFloat(e.target.value) || 0)}
                                placeholder="e.g. 1000"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Design Temperature (°C)</Label>
                            <Input
                                type="number"
                                min={20}
                                max={400}
                                value={inputs.designTemperature || ""}
                                onChange={(e) => update("designTemperature", parseFloat(e.target.value) || 20)}
                                placeholder="20–400"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Joint Efficiency (E)</Label>
                            <Select
                                value={String(inputs.jointEfficiency)}
                                onValueChange={(v) => update("jointEfficiency", parseFloat(v))}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1.00 — Full radiography (RT1/RT2)</SelectItem>
                                    <SelectItem value="0.85">0.85 — Spot radiography (RT3)</SelectItem>
                                    <SelectItem value="0.7">0.70 — No radiography (RT4)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Corrosion Allowance (mm)</Label>
                            <Input
                                type="number"
                                min={0}
                                step={0.5}
                                value={inputs.corrosionAllowance ?? ""}
                                onChange={(e) => update("corrosionAllowance", parseFloat(e.target.value) || 0)}
                                placeholder="e.g. 3"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Total Design Pressure Override (kPa)</Label>
                        <Input
                            type="number"
                            min={0}
                            value={inputs.totalDesignPressureOverride || ""}
                            onChange={(e) => update("totalDesignPressureOverride", parseFloat(e.target.value) || 0)}
                            placeholder="Leave blank for auto-calculation"
                            className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground">Auto: internal pressure + liquid head (vertical only). Enter a value to override.</p>
                    </div>

                    {/* Live ASME thickness derivation */}
                    <div className="rounded-lg bg-secondary/40 border border-border/60 px-4 py-3 space-y-1.5 font-mono text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Allowable stress (S)</span>
                            <span className="font-medium">
                                {asmePreview.allowableStressMPa !== null
                                    ? `${asmePreview.allowableStressMPa.toFixed(1)} MPa`
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Shell t_min (UG-27)</span>
                            <span className="font-medium">
                                {asmePreview.shellTminMm !== null
                                    ? `${asmePreview.shellTminMm.toFixed(2)} mm → nominal ${asmePreview.recommendedShellNominalMm?.toFixed(2)} mm`
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Head t_min (UG-32)</span>
                            <span className="font-medium">
                                {asmePreview.headTminMm !== null
                                    ? `${asmePreview.headTminMm.toFixed(2)} mm → nominal ${asmePreview.recommendedHeadNominalMm?.toFixed(2)} mm`
                                    : "—"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Corrosion allowance</span>
                            <span className="font-medium">
                                {inputs.corrosionAllowance > 0
                                    ? `${inputs.corrosionAllowance.toFixed(1)} mm (included in t_min above)`
                                    : "—"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Card 2 — Shell Vessel */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-primary" />
                        Shell Vessel
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Plate Thickness (mm)</Label>
                                {isShellThicknessOverridden && asmePreview.recommendedShellNominalMm !== null && (
                                    <span className="text-xs text-muted-foreground">
                                        Auto: {asmePreview.recommendedShellNominalMm.toFixed(2)} mm
                                    </span>
                                )}
                            </div>
                            <Select
                                value={String(inputs.plateThickness)}
                                onValueChange={(v) => {
                                    update("plateThickness", Number(v));
                                    setIsShellThicknessOverridden(true);
                                }}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <div className="flex items-center gap-1">
                                        <NumberFlow
                                            value={inputs.plateThickness}
                                            format={{
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 2,
                                            }}
                                            className="font-mono text-sm"
                                        />
                                        <span className="font-mono text-sm text-muted-foreground">
                                            mm
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {shellThicknesses.map((t) => (
                                        <SelectItem
                                            key={t}
                                            value={String(t)}
                                            className="font-mono"
                                        >
                                            {t} mm
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>
                                    Diameter (mm){" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex items-center gap-2 text-sm">
                                    <span
                                        className={
                                            inputs.diameterType === "ID"
                                                ? "text-foreground font-medium"
                                                : "text-muted-foreground"
                                        }
                                    >
                                        ID
                                    </span>
                                    <Switch
                                        checked={inputs.diameterType === "OD"}
                                        onCheckedChange={(checked) =>
                                            update(
                                                "diameterType",
                                                checked ? "OD" : "ID",
                                            )
                                        }
                                    />
                                    <span
                                        className={
                                            inputs.diameterType === "OD"
                                                ? "text-foreground font-medium"
                                                : "text-muted-foreground"
                                        }
                                    >
                                        OD
                                    </span>
                                </div>
                            </div>
                            <Input
                                type="number"
                                min="0"
                                value={inputs.diameter || ""}
                                onChange={(e) =>
                                    update("diameter", Number(e.target.value))
                                }
                                placeholder="e.g. 1200"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary font-mono"
                            />
                            {inputs.diameter > 0 &&
                                inputs.plateThickness > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {inputs.diameterType === "OD"
                                            ? `ID = ${(inputs.diameter - 2 * inputs.plateThickness).toFixed(1)} mm (auto-derived)`
                                            : `OD = ${(inputs.diameter + 2 * inputs.plateThickness).toFixed(1)} mm (auto-derived)`}
                                    </p>
                                )}
                        </div>
                        <div className="space-y-2">
                            <Label>
                                Shell Length — T/T (mm){" "}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                value={inputs.shellLength || ""}
                                onChange={(e) =>
                                    update(
                                        "shellLength",
                                        Number(e.target.value),
                                    )
                                }
                                placeholder="e.g. 3000"
                                className="h-11 bg-secondary/50 border-input focus-visible:ring-primary font-mono"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Quantity</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() =>
                                        update(
                                            "quantity",
                                            Math.max(
                                                1,
                                                (inputs.quantity ?? 1) - 1,
                                            ),
                                        )
                                    }
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </Button>
                                {editingVesselQty ? (
                                    <input
                                        type="number"
                                        min={1}
                                        autoFocus
                                        defaultValue={inputs.quantity ?? 1}
                                        onBlur={(e) => {
                                            const v = Math.max(
                                                1,
                                                parseInt(e.target.value) || 1,
                                            );
                                            update("quantity", v);
                                            setEditingVesselQty(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "-" ||
                                                e.key === "." ||
                                                e.key === "e"
                                            )
                                                e.preventDefault();
                                            if (
                                                e.key === "Enter" ||
                                                e.key === "Escape"
                                            ) {
                                                const v = Math.max(
                                                    1,
                                                    parseInt(
                                                        (
                                                            e.target as HTMLInputElement
                                                        ).value,
                                                    ) || 1,
                                                );
                                                update("quantity", v);
                                                setEditingVesselQty(false);
                                            }
                                        }}
                                        className="w-16 h-11 rounded-md border border-primary bg-secondary/50 text-center font-mono font-medium text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                ) : (
                                    <div
                                        className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11 cursor-text hover:border-primary/50 transition-colors"
                                        onClick={() =>
                                            setEditingVesselQty(true)
                                        }
                                    >
                                        <NumberFlow
                                            value={inputs.quantity ?? 1}
                                            className="font-mono font-medium text-sm tabular-nums"
                                        />
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() =>
                                        update(
                                            "quantity",
                                            (inputs.quantity ?? 1) + 1,
                                        )
                                    }
                                >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Number of identical vessels to build
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Card 3 — Dish End (always visible) */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <CircleDot className="h-4 w-4 text-primary" />
                        Dish End
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Row 1: Plate Thickness */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Plate Thickness (mm)</Label>
                                {isDishEndThicknessOverridden && asmePreview.recommendedHeadNominalMm !== null && (
                                    <span className="text-xs text-muted-foreground">
                                        Auto: {asmePreview.recommendedHeadNominalMm.toFixed(2)} mm
                                    </span>
                                )}
                            </div>
                            <Select
                                value={String(dishEndInputs.plateThickness)}
                                onValueChange={(v) => {
                                    updateDish("plateThickness", Number(v));
                                    setIsDishEndThicknessOverridden(true);
                                }}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <div className="flex items-center gap-1">
                                        <NumberFlow
                                            value={dishEndInputs.plateThickness}
                                            format={{
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 2,
                                            }}
                                            className="font-mono text-sm"
                                        />
                                        <span className="font-mono text-sm text-muted-foreground">
                                            mm
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {dishThicknesses.map((t) => (
                                        <SelectItem
                                            key={t}
                                            value={String(t)}
                                            className="font-mono"
                                        >
                                            {t} mm
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Head Type + Straight Face */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Head Type</Label>
                            <Select
                                value={dishEndInputs.headType}
                                onValueChange={(v) =>
                                    updateDish("headType", v as HeadType)
                                }
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(
                                        Object.entries(HEAD_TYPE_LABELS) as [
                                            HeadType,
                                            string,
                                        ][]
                                    ).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Straight Face (mm)</Label>
                            <Select
                                value={String(dishEndInputs.straightFace)}
                                onValueChange={(v) =>
                                    updateDish(
                                        "straightFace",
                                        Number(v) as StraightFace,
                                    )
                                }
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <div className="flex items-center gap-1">
                                        <NumberFlow
                                            value={dishEndInputs.straightFace}
                                            className="font-mono text-sm"
                                        />
                                        <span className="font-mono text-sm text-muted-foreground">
                                            mm
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        value="25"
                                        className="font-mono"
                                    >
                                        25 mm
                                    </SelectItem>
                                    <SelectItem
                                        value="38"
                                        className="font-mono"
                                    >
                                        38 mm
                                    </SelectItem>
                                    <SelectItem
                                        value="50"
                                        className="font-mono"
                                    >
                                        50 mm
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {derivedID > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Auto-suggested: {suggestedSF(derivedID)} mm
                                    (for ID {derivedID.toFixed(0)} mm)
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Row 3: Quantity + Corner Radius (flat only) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Quantity</Label>
                                {isDishEndQtyOverridden && (
                                    <span className="text-xs text-muted-foreground">
                                        Auto: {(inputs.quantity ?? 1) * 2}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() => {
                                        updateDish("quantity", Math.max(0, dishEndInputs.quantity - 1));
                                        setIsDishEndQtyOverridden(true);
                                    }}
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </Button>
                                {editingDishQty ? (
                                    <input
                                        type="number"
                                        min={0}
                                        autoFocus
                                        defaultValue={dishEndInputs.quantity}
                                        onBlur={(e) => {
                                            const v = Math.max(0, parseInt(e.target.value) || 0);
                                            updateDish("quantity", v);
                                            setIsDishEndQtyOverridden(true);
                                            setEditingDishQty(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "-" || e.key === "." || e.key === "e")
                                                e.preventDefault();
                                            if (e.key === "Enter" || e.key === "Escape") {
                                                const v = Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0);
                                                updateDish("quantity", v);
                                                setIsDishEndQtyOverridden(true);
                                                setEditingDishQty(false);
                                            }
                                        }}
                                        className="w-16 h-11 rounded-md border border-primary bg-secondary/50 text-center font-mono font-medium text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                ) : (
                                    <div
                                        className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11 cursor-text hover:border-primary/50 transition-colors"
                                        onClick={() => setEditingDishQty(true)}
                                    >
                                        <NumberFlow
                                            value={dishEndInputs.quantity}
                                            className="font-mono font-medium text-sm tabular-nums"
                                        />
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() => {
                                        updateDish("quantity", dishEndInputs.quantity + 1);
                                        setIsDishEndQtyOverridden(true);
                                    }}
                                >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Defaults to 2 × vessel quantity
                            </p>
                        </div>
                        {dishEndInputs.headType === "flat" && (
                            <div className="space-y-2">
                                <Label>Corner Radius (mm)</Label>
                                <Input
                                    type="number"
                                    value={dishEndInputs.cornerRadius || ""}
                                    onChange={(e) =>
                                        updateDish(
                                            "cornerRadius",
                                            Number(e.target.value),
                                        )
                                    }
                                    placeholder="e.g. 50"
                                    className="h-11 bg-secondary/50 border-input focus-visible:ring-primary font-mono"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Card — Filter Plates */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        Filter Plates
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Number of Filter Plates</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() => update("filterPlateCount", Math.max(0, inputs.filterPlateCount - 1))}
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <div className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11">
                                    <NumberFlow
                                        value={inputs.filterPlateCount}
                                        className="font-mono font-medium text-sm tabular-nums"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() => update("filterPlateCount", inputs.filterPlateCount + 1)}
                                >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Plate Thickness (mm)</Label>
                            <Select
                                value={String(inputs.filterPlateThickness)}
                                onValueChange={(v) => update("filterPlateThickness", Number(v))}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <div className="flex items-center gap-1">
                                        <NumberFlow
                                            value={inputs.filterPlateThickness}
                                            format={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
                                            className="font-mono text-sm"
                                        />
                                        <span className="font-mono text-sm text-muted-foreground">mm</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {shellThicknesses.map((t) => (
                                        <SelectItem key={t} value={String(t)} className="font-mono">
                                            {t} mm
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Circular plates at vessel ID
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Card — Nozzles & Manholes */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Circle className="h-4 w-4 text-primary" />
                        Nozzles & Manholes
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Global standard */}
                    <div className="space-y-2">
                        <Label>Standard</Label>
                        <Select
                            value={inputs.globalNozzleStandard}
                            onValueChange={(v) => update("globalNozzleStandard", v as FlangeStandard)}
                        >
                            <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="B16.5">ASME B16.5</SelectItem>
                                <SelectItem value="PN10">PN10 (DIN/EN)</SelectItem>
                                <SelectItem value="PN16">PN16 (DIN/EN)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Nozzle rows */}
                    {inputs.nozzles.map((nozzle, idx) => (
                        <div key={idx} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end p-3 rounded-lg bg-secondary/30">
                            <div className="space-y-1">
                                <Label className="text-xs">Type</Label>
                                <Select
                                    value={nozzle.type}
                                    onValueChange={(v) => {
                                        const updated = [...inputs.nozzles];
                                        const defaultLength = v === "manhole" ? 300 : 150;
                                        updated[idx] = { ...updated[idx], type: v as NozzleItemType, neckLength: defaultLength };
                                        update("nozzles", updated);
                                    }}
                                >
                                    <SelectTrigger className="h-9 bg-background text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="nozzle">Nozzle</SelectItem>
                                        <SelectItem value="manhole">Manhole</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Size</Label>
                                <Input
                                    value={nozzle.size}
                                    onChange={(e) => {
                                        const updated = [...inputs.nozzles];
                                        updated[idx] = { ...updated[idx], size: e.target.value };
                                        update("nozzles", updated);
                                    }}
                                    placeholder={nozzle.type === "manhole" ? (inputs.globalNozzleStandard === "B16.5" ? '24"' : "DN600") : "NPS 4"}
                                    className="h-9 bg-background text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Length (mm)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={nozzle.neckLength ?? (nozzle.type === "manhole" ? 300 : 150)}
                                    onChange={(e) => {
                                        const updated = [...inputs.nozzles];
                                        updated[idx] = { ...updated[idx], neckLength: parseFloat(e.target.value) || 0 };
                                        update("nozzles", updated);
                                    }}
                                    className="h-9 bg-background text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Flange Face</Label>
                                <Select
                                    value={nozzle.flangeType}
                                    onValueChange={(v) => {
                                        const updated = [...inputs.nozzles];
                                        updated[idx] = { ...updated[idx], flangeType: v as FlangeType };
                                        update("nozzles", updated);
                                    }}
                                >
                                    <SelectTrigger className="h-9 bg-background text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="slip_on_rf">Slip-On RF</SelectItem>
                                        <SelectItem value="weld_neck">Weld Neck</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 items-end">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs">Qty</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={nozzle.quantity}
                                        onChange={(e) => {
                                            const updated = [...inputs.nozzles];
                                            updated[idx] = { ...updated[idx], quantity: parseInt(e.target.value) || 1 };
                                            update("nozzles", updated);
                                        }}
                                        className="h-9 bg-background text-sm"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => update("nozzles", inputs.nozzles.filter((_, i) => i !== idx))}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => update("nozzles", [...inputs.nozzles, { type: "nozzle" as NozzleItemType, size: "", flangeType: "weld_neck" as FlangeType, quantity: 1, neckLength: 150 } as NozzleSpec])}
                    >
                        <PlusIcon className="h-4 w-4 mr-2" /> Add Nozzle / Manhole
                    </Button>
                </CardContent>
            </Card>

            {/* Card — Supports */}
            <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-primary" />
                        {inputs.orientation === "vertical" ? "Leg Supports (4 legs)" : "Saddle Supports (2 saddles)"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {inputs.orientation === "vertical" ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-2">
                                <Label>Diameter (inches)</Label>
                                <Select
                                    value={String(inputs.legInputs.diameter)}
                                    onValueChange={(v) => update("legInputs", { ...inputs.legInputs, diameter: Number(v) })}
                                >
                                    <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(SA106_PIPE_SCHEDULE).map((nps) => (
                                            <SelectItem key={nps} value={nps} className="font-mono">
                                                {nps}" NPS
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Leg Length (mm)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={inputs.legInputs.length || ""}
                                    onChange={(e) => update("legInputs", { ...inputs.legInputs, length: parseFloat(e.target.value) || 0 })}
                                    placeholder="e.g. 600"
                                    className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0"
                                        onClick={() => update("legInputs", { ...inputs.legInputs, quantity: Math.max(4, inputs.legInputs.quantity - 1) })}
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11">
                                        <NumberFlow
                                            value={inputs.legInputs.quantity}
                                            className="font-mono font-medium text-sm tabular-nums"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0"
                                        onClick={() => update("legInputs", { ...inputs.legInputs, quantity: inputs.legInputs.quantity + 1 })}
                                    >
                                        <PlusIcon className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            {SA106_PIPE_SCHEDULE[inputs.legInputs.diameter] && (
                                <p className="text-xs text-muted-foreground md:col-span-3">
                                    Wall thickness: {SA106_PIPE_SCHEDULE[inputs.legInputs.diameter].wall_mm} mm · OD: {SA106_PIPE_SCHEDULE[inputs.legInputs.diameter].od_mm} mm
                                    {" "}(ASME B36.10M Sch 40) · Base plate auto-sized to 10% larger than OD, 12 mm thick.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0"
                                        onClick={() => update("saddleInputs", { ...inputs.saddleInputs, quantity: Math.max(2, inputs.saddleInputs.quantity - 1) })}
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11">
                                        <NumberFlow
                                            value={inputs.saddleInputs.quantity}
                                            className="font-mono font-medium text-sm tabular-nums"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0"
                                        onClick={() => update("saddleInputs", { ...inputs.saddleInputs, quantity: inputs.saddleInputs.quantity + 1 })}
                                    >
                                        <PlusIcon className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Saddle dimensions are derived from vessel geometry per Zick analysis (L.P. Zick, 1951).
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <button
                onClick={handleCalculate}
                disabled={!isValid}
                className="w-full h-12 rounded-xl border-2 border-primary/80 bg-transparent text-primary/80 hover:border-primary hover:bg-primary hover:text-primary-foreground dark:border-primary dark:text-primary dark:hover:text-primary-foreground transition-colors duration-300 flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
                <Calculator className="h-5 w-5" />
                Calculate Plates
            </button>
        </div>
    );
}
