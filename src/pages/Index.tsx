import { useEffect, useState } from "react";
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
} from "@/lib/types";
import { suggestedSF, HEAD_TYPE_LABELS } from "@/lib/dishEndCalculations";
import {
    Calculator,
    Ruler,
    CircleDot,
    Minus,
    Plus as PlusIcon,
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
        inputs.materialType === "carbon_steel"
            ? CS_THICKNESSES
            : SS_THICKNESSES;
    const dishThicknesses =
        dishEndInputs.materialType === "carbon_steel"
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
                            <Label>Material Type</Label>
                            <Select
                                value={inputs.materialType}
                                onValueChange={(v) => {
                                    update("materialType", v);
                                    if (v === "carbon_steel") {
                                        update(
                                            "plateThickness",
                                            CS_THICKNESSES[0],
                                        );
                                    } else {
                                        update(
                                            "plateThickness",
                                            SS_THICKNESSES[0],
                                        );
                                    }
                                }}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="carbon_steel">
                                        Carbon Steel
                                    </SelectItem>
                                    <SelectItem value="stainless_steel">
                                        Stainless Steel
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Plate Thickness (mm)</Label>
                            <Select
                                value={String(inputs.plateThickness)}
                                onValueChange={(v) =>
                                    update("plateThickness", Number(v))
                                }
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
                    {/* Row 1: Material Type + Plate Thickness */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Material Type</Label>
                            <Select
                                value={dishEndInputs.materialType}
                                onValueChange={(v) => {
                                    updateDish("materialType", v);
                                    if (v === "carbon_steel") {
                                        updateDish(
                                            "plateThickness",
                                            CS_THICKNESSES[0],
                                        );
                                    } else {
                                        updateDish(
                                            "plateThickness",
                                            SS_THICKNESSES[0],
                                        );
                                    }
                                }}
                            >
                                <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="carbon_steel">
                                        Carbon Steel
                                    </SelectItem>
                                    <SelectItem value="stainless_steel">
                                        Stainless Steel
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Plate Thickness (mm)</Label>
                            <Select
                                value={String(dishEndInputs.plateThickness)}
                                onValueChange={(v) =>
                                    updateDish("plateThickness", Number(v))
                                }
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
                            <Label>Quantity</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11 shrink-0"
                                    onClick={() =>
                                        updateDish(
                                            "quantity",
                                            Math.max(
                                                0,
                                                dishEndInputs.quantity - 1,
                                            ),
                                        )
                                    }
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
                                            const v = Math.max(
                                                0,
                                                parseInt(e.target.value) || 0,
                                            );
                                            updateDish("quantity", v);
                                            setEditingDishQty(false);
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
                                                    0,
                                                    parseInt(
                                                        (
                                                            e.target as HTMLInputElement
                                                        ).value,
                                                    ) || 0,
                                                );
                                                updateDish("quantity", v);
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
                                    onClick={() =>
                                        updateDish(
                                            "quantity",
                                            dishEndInputs.quantity + 1,
                                        )
                                    }
                                >
                                    <PlusIcon className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Total dish ends across all vessels
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
