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
    VesselInputs,
    DishEndInputs,
    MaterialType,
    VesselEntry,
} from "@/lib/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { suggestedSF, HEAD_TYPE_LABELS } from "@/lib/dishEndCalculations";
import { liveASMEPreview, LiveASMEPreviewResult } from "@/lib/calculations";
import { VesselSchematic } from "@/components/VesselSchematic";
import {
    Calculator,
    Ruler,
    CircleDot,
    Minus,
    Plus as PlusIcon,
    Layers,
    Circle,
    Trash2,
    Copy,
    Pencil,
    Check,
    ChevronDown,
} from "lucide-react";
import NumberFlow from "@number-flow/react";


const BLANK_INPUTS: VesselInputs = {
    projectName: "",
    tagNumber: "",
    designPressure: 0,
    designTemperature: 0,
    diameterType: "OD",
    diameter: 0,
    shellLength: 0,
    plateThickness: 6.4,
    materialType: "SA516 Gr 70" as MaterialType,
    rubberLining: false,
    quantity: 1,
    orientation: "vertical" as VesselOrientation,
    jointEfficiency: 0.85,
    corrosionAllowance: 0,
    totalDesignPressureOverride: 0,
    filterPlateCount: 0,
    globalNozzleStandard: "B16.5" as FlangeStandard,
    filterPlateThickness: 22.3,
    nozzles: [],
    legInputs: { diameter: 4, length: 0, quantity: 4 },
    saddleInputs: { quantity: 2 },
};

const BLANK_DISH: DishEndInputs = {
    headType: "ellipsoidal" as HeadType,
    plateThickness: 6.4,
    straightFace: 50,
    quantity: 2,
    cornerRadius: 0,
};

const CARD_CLS =
    "glass-card card-shadow-lg border-2 border-border/50 rounded-xl hover:border-primary/40 transition-colors duration-200";

export default function Index() {
    const {
        inputs,
        setInputs,
        dishEndInputs,
        setDishEndInputs,
        runCalculation,
        runProjectCalculation,
    } = useAppContext();
    const navigate = useNavigate();

    // ─── Multi-vessel state ──────────────────────────────────────
    const [vessels, setVessels] = useState<VesselEntry[]>(() => [
        {
            id: "1",
            name: "Vessel 1",
            savedInputs: { ...inputs },
            savedDishEnd: { ...dishEndInputs },
        },
    ]);
    const [activeId, setActiveId] = useState("1");
    const [editingVesselId, setEditingVesselId] = useState<string | null>(null);
    const [editingVesselName, setEditingVesselName] = useState("");

    const commitRename = () => {
        if (!editingVesselId) return;
        const trimmed = editingVesselName.trim();
        if (trimmed) {
            setVessels((vs) =>
                vs.map((v) =>
                    v.id === editingVesselId ? { ...v, name: trimmed } : v,
                ),
            );
        }
        setEditingVesselId(null);
    };

    const switchVessel = (id: string) => {
        if (id === activeId) return;
        const target = vessels.find((v) => v.id === id);
        if (!target) return;
        // save current to active slot
        setVessels((vs) =>
            vs.map((v) =>
                v.id === activeId
                    ? {
                          ...v,
                          savedInputs: { ...inputs },
                          savedDishEnd: { ...dishEndInputs },
                      }
                    : v,
            ),
        );
        setActiveId(id);
        setInputs(target.savedInputs);
        setDishEndInputs(target.savedDishEnd);
        setIsShellThicknessOverridden(false);
        setIsDishEndThicknessOverridden(false);
        setIsDishEndQtyOverridden(false);
    };

    const addVessel = () => {
        const updated = vessels.map((v) =>
            v.id === activeId
                ? {
                      ...v,
                      savedInputs: { ...inputs },
                      savedDishEnd: { ...dishEndInputs },
                  }
                : v,
        );
        const id = Date.now().toString();
        const n = updated.length + 1;
        const newInputs: VesselInputs = {
            ...BLANK_INPUTS,
            projectName: inputs.projectName,
            tagNumber: inputs.tagNumber,
        };
        const newDish: DishEndInputs = { ...BLANK_DISH };
        setVessels([
            ...updated,
            {
                id,
                name: `Vessel ${n}`,
                savedInputs: newInputs,
                savedDishEnd: newDish,
            },
        ]);
        setActiveId(id);
        setInputs(newInputs);
        setDishEndInputs(newDish);
        setIsShellThicknessOverridden(false);
        setIsDishEndThicknessOverridden(false);
        setIsDishEndQtyOverridden(false);
    };

    const duplicateVessel = () => {
        const updated = vessels.map((v) =>
            v.id === activeId
                ? {
                      ...v,
                      savedInputs: { ...inputs },
                      savedDishEnd: { ...dishEndInputs },
                  }
                : v,
        );
        const active = updated.find((v) => v.id === activeId)!;
        const id = Date.now().toString();
        const copy: VesselEntry = {
            id,
            name: `${active.name} (copy)`,
            savedInputs: { ...inputs },
            savedDishEnd: { ...dishEndInputs },
        };
        setVessels([...updated, copy]);
        setActiveId(id);
        // inputs/dishEndInputs unchanged — still the same values as the duplicate
    };

    const removeVessel = () => {
        if (vessels.length <= 1) return;
        const remaining = vessels.filter((v) => v.id !== activeId);
        setVessels(remaining);
        const next = remaining[remaining.length - 1];
        setActiveId(next.id);
        setInputs(next.savedInputs);
        setDishEndInputs(next.savedDishEnd);
        setIsShellThicknessOverridden(false);
        setIsDishEndThicknessOverridden(false);
        setIsDishEndQtyOverridden(false);
    };

    // ─── Form helpers ────────────────────────────────────────────
    const shellThicknesses =
        inputs.materialType === "SA516 Gr 70" ? CS_THICKNESSES : SS_THICKNESSES;
    const dishThicknesses = shellThicknesses;

    const NPS_SIZES = [
        '1/2" NPS',
        '3/4" NPS',
        '1" NPS',
        '1-1/2" NPS',
        '2" NPS',
        '2-1/2" NPS',
        '3" NPS',
        '4" NPS',
        '5" NPS',
        '6" NPS',
        '8" NPS',
        '10" NPS',
        '12" NPS',
        '14" NPS',
        '16" NPS',
        '18" NPS',
        '20" NPS',
        '24" NPS',
    ];
    const MANHOLE_SIZES_B165 = ['16"', '18"', '20"', '24"'];
    const DN_SIZES = [
        "DN50",
        "DN65",
        "DN80",
        "DN100",
        "DN125",
        "DN150",
        "DN200",
        "DN250",
        "DN300",
        "DN350",
        "DN400",
        "DN450",
        "DN500",
        "DN600",
    ];
    const MANHOLE_SIZES_PN = ["DN400", "DN450", "DN500", "DN600"];

    const getNozzleSizes = (type: string, standard: string): string[] => {
        if (type === "manhole")
            return standard === "B16.5" ? MANHOLE_SIZES_B165 : MANHOLE_SIZES_PN;
        return standard === "B16.5" ? NPS_SIZES : DN_SIZES;
    };

    const update = (field: string, value: any) =>
        setInputs((prev) => ({ ...prev, [field]: value }));
    const updateDish = (field: string, value: any) =>
        setDishEndInputs((prev) => ({ ...prev, [field]: value }));

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

    const [editingVesselQty, setEditingVesselQty] = useState(false);
    const [editingDishQty, setEditingDishQty] = useState(false);

    const [asmePreview, setAsmePreview] = useState<LiveASMEPreviewResult>({
        allowableStressMPa: null,
        shellTminMm: null,
        headTminMm: null,
        recommendedShellNominalMm: null,
        recommendedHeadNominalMm: null,
    });
    const [isShellThicknessOverridden, setIsShellThicknessOverridden] =
        useState(false);
    const [isDishEndThicknessOverridden, setIsDishEndThicknessOverridden] =
        useState(false);
    const [isDishEndQtyOverridden, setIsDishEndQtyOverridden] = useState(false);
    const asmeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (asmeDebounceRef.current) clearTimeout(asmeDebounceRef.current);
        asmeDebounceRef.current = setTimeout(() => {
            const liquidHeadKPa =
                inputs.orientation === "vertical"
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
            if (
                !isShellThicknessOverridden &&
                result.recommendedShellNominalMm !== null
            )
                update("plateThickness", result.recommendedShellNominalMm);
            if (
                !isDishEndThicknessOverridden &&
                result.recommendedHeadNominalMm !== null
            )
                updateDish("plateThickness", result.recommendedHeadNominalMm);
        }, 300);
        return () => {
            if (asmeDebounceRef.current) clearTimeout(asmeDebounceRef.current);
        };
    }, [
        inputs.materialType,
        inputs.designPressure,
        inputs.designTemperature,
        inputs.jointEfficiency,
        inputs.corrosionAllowance,
        inputs.diameter,
        inputs.diameterType,
        inputs.orientation,
        inputs.shellLength,
        dishEndInputs.headType,
    ]);

    useEffect(() => {
        if (!isDishEndQtyOverridden)
            updateDish("quantity", (inputs.quantity ?? 1) * 2);
    }, [inputs.quantity]);

    const isValid =
        inputs.projectName &&
        inputs.diameter > 0 &&
        inputs.shellLength > 0 &&
        inputs.plateThickness > 0;

    const handleCalculate = () => {
        runCalculation();
        navigate("/results");
    };

    const handleCalculateAll = () => {
        // Flush active vessel's current state into the vessels array before calculating
        const flushed = vessels.map((v) =>
            v.id === activeId
                ? { ...v, savedInputs: { ...inputs }, savedDishEnd: { ...dishEndInputs } }
                : v,
        );
        const dishEndMap: Record<string, import("@/lib/types").DishEndInputs> = {};
        flushed.forEach((v) => { dishEndMap[v.id] = v.savedDishEnd; });
        runProjectCalculation(flushed, dishEndMap).then(() => navigate("/results"));
    };

    // ─── Vessel list display helper ──────────────────────────────
    const vesselMeta = (entry: VesselEntry) => {
        const inp = entry.id === activeId ? inputs : entry.savedInputs;
        return {
            orientation: inp.orientation === "horizontal" ? "H" : "V",
            diameter: inp.diameter,
            shellLength: inp.shellLength,
            quantity: inp.quantity ?? 1,
        };
    };

    return (
        <div className="max-w-[1800px] mx-auto px-6 pt-6 pb-20">
            {/* ── Page header ────────────────────────────────────── */}
            <div className="mb-5">
                <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                        New Estimate
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                        {vessels.length} vessel{vessels.length !== 1 ? "s" : ""}{" "}
                        in project
                    </span>
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {inputs.projectName || "Untitled project"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Configure vessel specifications to generate a cost estimate.
                </p>
            </div>

            {/* ── 3-column grid ──────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-[375px_minmax(0,1fr)_600px] gap-5 items-start">
                {/* ── LEFT COLUMN — sticky ───────────────────────── */}
                <div className="hidden xl:flex flex-col gap-4 sticky top-[88px] self-start">
                    {/* Project card */}
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Calculator className="h-4 w-4 text-primary" />
                                Project
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>
                                    Project Name{" "}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    value={inputs.projectName}
                                    onChange={(e) =>
                                        update("projectName", e.target.value)
                                    }
                                    placeholder="e.g. Petronas RAPID"
                                    className="h-9 bg-secondary/50 border-input focus-visible:ring-primary text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Project ID</Label>
                                <Input
                                    value={inputs.tagNumber}
                                    onChange={(e) =>
                                        update("tagNumber", e.target.value)
                                    }
                                    placeholder="e.g. PRJ-2026-042"
                                    className="h-9 bg-secondary/50 border-input focus-visible:ring-primary font-mono text-sm"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Vessels card */}
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                Vessels
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 pb-3">
                            {vessels.map((v) => {
                                const meta = vesselMeta(v);
                                const isActive = v.id === activeId;
                                const isEditing = editingVesselId === v.id;
                                return (
                                    <div
                                        key={v.id}
                                        onClick={() =>
                                            !isEditing && switchVessel(v.id)
                                        }
                                        className={`w-full text-left px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150 ${
                                            isActive
                                                ? "bg-primary/8 border-primary/50 bg-accent/60"
                                                : "bg-transparent border-border/40 hover:bg-secondary/60 hover:border-border"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            autoFocus
                                                            value={
                                                                editingVesselName
                                                            }
                                                            onChange={(e) =>
                                                                setEditingVesselName(
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            onBlur={
                                                                commitRename
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    "Enter"
                                                                )
                                                                    commitRename();
                                                                if (
                                                                    e.key ===
                                                                    "Escape"
                                                                )
                                                                    setEditingVesselId(
                                                                        null,
                                                                    );
                                                            }}
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                            className="flex-1 min-w-0 text-sm font-semibold bg-background border border-primary/50 rounded px-1.5 py-0.5 outline-none text-foreground"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                commitRename();
                                                            }}
                                                            className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-primary hover:bg-primary/10 transition-colors"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-1">
                                                        <span
                                                            className={`text-sm font-semibold break-words leading-snug ${isActive ? "text-primary" : "text-foreground"}`}
                                                        >
                                                            {v.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingVesselId(
                                                                    v.id,
                                                                );
                                                                setEditingVesselName(
                                                                    v.name,
                                                                );
                                                            }}
                                                            className="shrink-0 mt-0.5 h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                                        >
                                                            <Pencil className="h-2.5 w-2.5" />
                                                        </button>
                                                    </div>
                                                )}
                                                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                                    {meta.orientation} · ø
                                                    {meta.diameter || "—"} · L
                                                    {meta.shellLength || "—"}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[10.5px] font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded mt-0.5 ${isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                                            >
                                                ×{meta.quantity}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            <button
                                type="button"
                                onClick={addVessel}
                                className="w-full mt-1 h-8 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-1.5"
                            >
                                <PlusIcon className="h-3 w-3" /> Add vessel
                            </button>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={duplicateVessel}
                            className="w-full h-9 rounded-lg border border-primary/40 text-primary/70 text-xs font-medium flex items-center justify-center gap-2 hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors duration-150"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Duplicate vessel
                        </button>
                        <button
                            type="button"
                            onClick={removeVessel}
                            disabled={vessels.length <= 1}
                            className="w-full h-9 rounded-lg border border-destructive/40 text-destructive text-xs font-medium flex items-center justify-center gap-2 hover:bg-destructive/10 hover:border-destructive transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete vessel
                        </button>
                    </div>
                </div>

                {/* ── CENTER COLUMN — form cards ─────────────────── */}
                <div className="min-w-0 space-y-5">
                    {/* Card — Design Parameters & Shell Vessel (merged) */}
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Ruler className="h-4 w-4 text-primary" />
                                Design Parameters & Shell Vessel
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Row 1: Material + Orientation */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label>Material Type</Label>
                                    <Select
                                        value={inputs.materialType}
                                        onValueChange={(v) => {
                                            update("materialType", v);
                                            update(
                                                "filterPlateThickness",
                                                v === "SA516 Gr 70"
                                                    ? 22.3
                                                    : 22.0,
                                            );
                                            setIsShellThicknessOverridden(
                                                false,
                                            );
                                            setIsDishEndThicknessOverridden(
                                                false,
                                            );
                                        }}
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SA516 Gr 70">
                                                SA516 Gr 70 (Carbon Steel)
                                            </SelectItem>
                                            <SelectItem value="SS304">
                                                SS304 (Stainless)
                                            </SelectItem>
                                            <SelectItem value="SS316">
                                                SS316 (Stainless)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Vessel Orientation</Label>
                                    <Select
                                        value={inputs.orientation}
                                        onValueChange={(v) =>
                                            update(
                                                "orientation",
                                                v as VesselOrientation,
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="vertical">
                                                Vertical
                                            </SelectItem>
                                            <SelectItem value="horizontal">
                                                Horizontal
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Row 2: Diameter + Shell Length */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>
                                            Diameter (mm){" "}
                                            <span className="text-destructive">
                                                *
                                            </span>
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
                                                checked={
                                                    inputs.diameterType === "OD"
                                                }
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
                                            update(
                                                "diameter",
                                                Number(e.target.value),
                                            )
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
                                        <span className="text-destructive">
                                            *
                                        </span>
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

                            {/* Row 3: Design Pressure + Temperature */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label>
                                        Internal Design Pressure (kPa)
                                    </Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={inputs.designPressure || ""}
                                        onChange={(e) =>
                                            update(
                                                "designPressure",
                                                parseFloat(e.target.value) || 0,
                                            )
                                        }
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
                                        onChange={(e) =>
                                            update(
                                                "designTemperature",
                                                parseFloat(e.target.value) ||
                                                    20,
                                            )
                                        }
                                        placeholder="20–400"
                                        className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                                    />
                                </div>
                            </div>

                            {/* Row 4: JE + CA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label>Joint Efficiency (E)</Label>
                                    <Select
                                        value={String(inputs.jointEfficiency)}
                                        onValueChange={(v) =>
                                            update(
                                                "jointEfficiency",
                                                parseFloat(v),
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">
                                                1.00 — Full radiography
                                                (RT1/RT2)
                                            </SelectItem>
                                            <SelectItem value="0.85">
                                                0.85 — Spot radiography (RT3)
                                            </SelectItem>
                                            <SelectItem value="0.7">
                                                0.70 — No radiography (RT4)
                                            </SelectItem>
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
                                        onChange={(e) =>
                                            update(
                                                "corrosionAllowance",
                                                parseFloat(e.target.value) || 0,
                                            )
                                        }
                                        placeholder="e.g. 3"
                                        className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                                    />
                                </div>
                            </div>

                            {/* Row 5: TDPO */}
                            <div className="space-y-2">
                                <Label>
                                    Total Design Pressure Override (kPa)
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={
                                        inputs.totalDesignPressureOverride || ""
                                    }
                                    onChange={(e) =>
                                        update(
                                            "totalDesignPressureOverride",
                                            parseFloat(e.target.value) || 0,
                                        )
                                    }
                                    placeholder="Leave blank for auto-calculation"
                                    className="h-11 bg-secondary/50 border-input focus-visible:ring-primary"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Auto: internal pressure + liquid head
                                    (vertical only). Enter a value to override.
                                </p>
                            </div>

                            {/* ASME preview */}
                            <div className="rounded-lg bg-secondary/40 border border-border/60 px-4 py-3 space-y-1.5 font-mono text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div
                                        className="animate-pulse shrink-0"
                                        style={{
                                            width: "6px",
                                            height: "6px",
                                            borderRadius: "9999px",
                                            background: "hsl(var(--primary))",
                                            boxShadow:
                                                "0 0 0 3px hsl(var(--primary) / 0.2)",
                                        }}
                                    />
                                    <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                                        Live ASME Derivation
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Allowable stress (S)
                                    </span>
                                    <span className="font-medium">
                                        {asmePreview.allowableStressMPa !== null
                                            ? `${asmePreview.allowableStressMPa.toFixed(1)} MPa`
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Shell min. thickness (UG-27)
                                    </span>
                                    <span className="font-medium">
                                        {asmePreview.shellTminMm !== null
                                            ? inputs.corrosionAllowance > 0
                                                ? `${asmePreview.shellTminMm.toFixed(2)} + ${inputs.corrosionAllowance.toFixed(1)} mm → nominal ${asmePreview.recommendedShellNominalMm?.toFixed(2)} mm`
                                                : `${asmePreview.shellTminMm.toFixed(2)} mm → nominal ${asmePreview.recommendedShellNominalMm?.toFixed(2)} mm`
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Head min. thickness (UG-32)
                                    </span>
                                    <span className="font-medium">
                                        {asmePreview.headTminMm !== null
                                            ? inputs.corrosionAllowance > 0
                                                ? `${asmePreview.headTminMm.toFixed(2)} + ${inputs.corrosionAllowance.toFixed(1)} mm → nominal ${asmePreview.recommendedHeadNominalMm?.toFixed(2)} mm`
                                                : `${asmePreview.headTminMm.toFixed(2)} mm → nominal ${asmePreview.recommendedHeadNominalMm?.toFixed(2)} mm`
                                            : "—"}
                                    </span>
                                </div>
                            </div>

                            {/* Row 6: Shell Plate Thickness + Vessel Quantity */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>
                                            Shell Plate Thickness (mm)
                                        </Label>
                                        {isShellThicknessOverridden &&
                                            asmePreview.recommendedShellNominalMm !==
                                                null && (
                                                <span className="text-xs text-muted-foreground">
                                                    Auto:{" "}
                                                    {asmePreview.recommendedShellNominalMm.toFixed(
                                                        2,
                                                    )}{" "}
                                                    mm
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
                                                    value={
                                                        inputs.plateThickness
                                                    }
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
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Quantity</Label>
                                    </div>
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
                                                        (inputs.quantity ?? 1) -
                                                            1,
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
                                                defaultValue={
                                                    inputs.quantity ?? 1
                                                }
                                                onBlur={(e) => {
                                                    update(
                                                        "quantity",
                                                        Math.max(
                                                            1,
                                                            parseInt(
                                                                e.target.value,
                                                            ) || 1,
                                                        ),
                                                    );
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
                                                        update(
                                                            "quantity",
                                                            Math.max(
                                                                1,
                                                                parseInt(
                                                                    (
                                                                        e.target as HTMLInputElement
                                                                    ).value,
                                                                ) || 1,
                                                            ),
                                                        );
                                                        setEditingVesselQty(
                                                            false,
                                                        );
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
                                        Number of identical vessels with these
                                        specs
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card — Dish End */}
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <CircleDot className="h-4 w-4 text-primary" />
                                Dish End
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Plate Thickness (mm)</Label>
                                        {isDishEndThicknessOverridden &&
                                            asmePreview.recommendedHeadNominalMm !==
                                                null && (
                                                <span className="text-xs text-muted-foreground">
                                                    Auto:{" "}
                                                    {asmePreview.recommendedHeadNominalMm.toFixed(
                                                        2,
                                                    )}{" "}
                                                    mm
                                                </span>
                                            )}
                                    </div>
                                    <Select
                                        value={String(
                                            dishEndInputs.plateThickness,
                                        )}
                                        onValueChange={(v) => {
                                            updateDish(
                                                "plateThickness",
                                                Number(v),
                                            );
                                            setIsDishEndThicknessOverridden(
                                                true,
                                            );
                                        }}
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <div className="flex items-center gap-1">
                                                <NumberFlow
                                                    value={
                                                        dishEndInputs.plateThickness
                                                    }
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
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Head Type</Label>
                                    </div>
                                    <Select
                                        value={dishEndInputs.headType}
                                        onValueChange={(v) =>
                                            updateDish(
                                                "headType",
                                                v as HeadType,
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(
                                                Object.entries(
                                                    HEAD_TYPE_LABELS,
                                                ) as [HeadType, string][]
                                            ).map(([key, label]) => (
                                                <SelectItem
                                                    key={key}
                                                    value={key}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Straight Face (mm)</Label>
                                    </div>
                                    <Select
                                        value={String(
                                            dishEndInputs.straightFace,
                                        )}
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
                                                    value={
                                                        dishEndInputs.straightFace
                                                    }
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
                                            Auto-suggested:{" "}
                                            {suggestedSF(derivedID)} mm (for ID{" "}
                                            {derivedID.toFixed(0)} mm)
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Quantity</Label>
                                        {isDishEndQtyOverridden && (
                                            <span className="text-xs text-muted-foreground">
                                                Auto:{" "}
                                                {(inputs.quantity ?? 1) * 2}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 shrink-0"
                                            onClick={() => {
                                                updateDish(
                                                    "quantity",
                                                    Math.max(
                                                        0,
                                                        dishEndInputs.quantity -
                                                            1,
                                                    ),
                                                );
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
                                                defaultValue={
                                                    dishEndInputs.quantity
                                                }
                                                onBlur={(e) => {
                                                    const v = Math.max(
                                                        0,
                                                        parseInt(
                                                            e.target.value,
                                                        ) || 0,
                                                    );
                                                    updateDish("quantity", v);
                                                    setIsDishEndQtyOverridden(
                                                        true,
                                                    );
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
                                                        updateDish(
                                                            "quantity",
                                                            v,
                                                        );
                                                        setIsDishEndQtyOverridden(
                                                            true,
                                                        );
                                                        setEditingDishQty(
                                                            false,
                                                        );
                                                    }
                                                }}
                                                className="w-16 h-11 rounded-md border border-primary bg-secondary/50 text-center font-mono font-medium text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                        ) : (
                                            <div
                                                className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11 cursor-text hover:border-primary/50 transition-colors"
                                                onClick={() =>
                                                    setEditingDishQty(true)
                                                }
                                            >
                                                <NumberFlow
                                                    value={
                                                        dishEndInputs.quantity
                                                    }
                                                    className="font-mono font-medium text-sm tabular-nums"
                                                />
                                            </div>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 shrink-0"
                                            onClick={() => {
                                                updateDish(
                                                    "quantity",
                                                    dishEndInputs.quantity + 1,
                                                );
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
                                            value={
                                                dishEndInputs.cornerRadius || ""
                                            }
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
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                Filter Plates
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label>Plate Thickness (mm)</Label>
                                    <Select
                                        value={String(
                                            inputs.filterPlateThickness,
                                        )}
                                        onValueChange={(v) =>
                                            update(
                                                "filterPlateThickness",
                                                Number(v),
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <div className="flex items-center gap-1">
                                                <NumberFlow
                                                    value={
                                                        inputs.filterPlateThickness
                                                    }
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
                                    <p className="text-xs text-muted-foreground">
                                        Circular plates at vessel ID
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 shrink-0"
                                            onClick={() =>
                                                update(
                                                    "filterPlateCount",
                                                    Math.max(
                                                        0,
                                                        inputs.filterPlateCount -
                                                            1,
                                                    ),
                                                )
                                            }
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
                                            onClick={() =>
                                                update(
                                                    "filterPlateCount",
                                                    inputs.filterPlateCount + 1,
                                                )
                                            }
                                        >
                                            <PlusIcon className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card — Nozzles & Manholes */}
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Circle className="h-4 w-4 text-primary" />
                                Nozzles & Manholes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label>Standard</Label>
                                    <Select
                                        value={inputs.globalNozzleStandard}
                                        onValueChange={(v) =>
                                            update(
                                                "globalNozzleStandard",
                                                v as FlangeStandard,
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="B16.5">
                                                ASME B16.5
                                            </SelectItem>
                                            <SelectItem value="PN10">
                                                PN10 (DIN/EN)
                                            </SelectItem>
                                            <SelectItem value="PN16">
                                                PN16 (DIN/EN)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {inputs.nozzles.map((nozzle, idx) => (
                                <div
                                    key={idx}
                                    className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end p-3 rounded-lg bg-secondary/30"
                                >
                                    <div className="space-y-1">
                                        <Label className="text-xs">Type</Label>
                                        <Select
                                            value={nozzle.type}
                                            onValueChange={(v) => {
                                                const updated = [
                                                    ...inputs.nozzles,
                                                ];
                                                updated[idx] = {
                                                    ...updated[idx],
                                                    type: v as NozzleItemType,
                                                    neckLength:
                                                        v === "manhole"
                                                            ? 300
                                                            : 150,
                                                };
                                                update("nozzles", updated);
                                            }}
                                        >
                                            <SelectTrigger className="h-9 bg-background text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="nozzle">
                                                    Nozzle
                                                </SelectItem>
                                                <SelectItem value="manhole">
                                                    Manhole
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">
                                            Diameter (inches)
                                        </Label>
                                        <Select
                                            value={
                                                nozzle.size ||
                                                getNozzleSizes(
                                                    nozzle.type,
                                                    inputs.globalNozzleStandard,
                                                )[0]
                                            }
                                            onValueChange={(v) => {
                                                const u = [...inputs.nozzles];
                                                u[idx] = { ...u[idx], size: v };
                                                update("nozzles", u);
                                            }}
                                        >
                                            <SelectTrigger className="h-9 bg-background text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getNozzleSizes(
                                                    nozzle.type,
                                                    inputs.globalNozzleStandard,
                                                ).map((s) => (
                                                    <SelectItem
                                                        key={s}
                                                        value={s}
                                                    >
                                                        {s}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">
                                            Length (mm)
                                        </Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            value={
                                                nozzle.neckLength ??
                                                (nozzle.type === "manhole"
                                                    ? 300
                                                    : 150)
                                            }
                                            onChange={(e) => {
                                                const u = [...inputs.nozzles];
                                                u[idx] = {
                                                    ...u[idx],
                                                    neckLength:
                                                        parseFloat(
                                                            e.target.value,
                                                        ) || 0,
                                                };
                                                update("nozzles", u);
                                            }}
                                            className="h-9 bg-background text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">
                                            Flange Face
                                        </Label>
                                        <Select
                                            value={nozzle.flangeType}
                                            onValueChange={(v) => {
                                                const u = [...inputs.nozzles];
                                                u[idx] = {
                                                    ...u[idx],
                                                    flangeType: v as FlangeType,
                                                };
                                                update("nozzles", u);
                                            }}
                                        >
                                            <SelectTrigger className="h-9 bg-background text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="slip_on_rf">
                                                    Slip-On RF
                                                </SelectItem>
                                                <SelectItem value="weld_neck">
                                                    Weld Neck
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-2 items-end">
                                        <div className="space-y-1 flex-1">
                                            <Label className="text-xs">
                                                Qty
                                            </Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={nozzle.quantity}
                                                onChange={(e) => {
                                                    const u = [
                                                        ...inputs.nozzles,
                                                    ];
                                                    u[idx] = {
                                                        ...u[idx],
                                                        quantity:
                                                            parseInt(
                                                                e.target.value,
                                                            ) || 1,
                                                    };
                                                    update("nozzles", u);
                                                }}
                                                className="h-9 bg-background text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                update(
                                                    "nozzles",
                                                    inputs.nozzles.filter(
                                                        (_, i) => i !== idx,
                                                    ),
                                                )
                                            }
                                            className="h-9 w-9 flex items-center justify-center rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive transition-colors duration-150"
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
                                className="w-full"
                                onClick={() =>
                                    update("nozzles", [
                                        ...inputs.nozzles,
                                        {
                                            type: "nozzle" as NozzleItemType,
                                            size: "",
                                            flangeType:
                                                "weld_neck" as FlangeType,
                                            quantity: 1,
                                            neckLength: 150,
                                        } as NozzleSpec,
                                    ])
                                }
                            >
                                <PlusIcon className="h-4 w-4 mr-2" /> Add Nozzle
                                / Manhole
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Card — Supports */}
                    <Card className={CARD_CLS}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Ruler className="h-4 w-4 text-primary" />
                                {inputs.orientation === "vertical"
                                    ? `Leg Supports (${inputs.legInputs.quantity} legs)`
                                    : `Saddle Supports (${inputs.saddleInputs.quantity} saddles)`}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {inputs.orientation === "vertical" ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <Label>Diameter (inches)</Label>
                                        <Select
                                            value={String(
                                                inputs.legInputs.diameter,
                                            )}
                                            onValueChange={(v) =>
                                                update("legInputs", {
                                                    ...inputs.legInputs,
                                                    diameter: Number(v),
                                                })
                                            }
                                        >
                                            <SelectTrigger className="h-11 bg-secondary/50 border-input focus:ring-primary">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(
                                                    SA106_PIPE_SCHEDULE,
                                                ).map((nps) => (
                                                    <SelectItem
                                                        key={nps}
                                                        value={nps}
                                                        className="font-mono"
                                                    >
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
                                            value={
                                                inputs.legInputs.length || ""
                                            }
                                            onChange={(e) =>
                                                update("legInputs", {
                                                    ...inputs.legInputs,
                                                    length:
                                                        parseFloat(
                                                            e.target.value,
                                                        ) || 0,
                                                })
                                            }
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
                                                onClick={() =>
                                                    update("legInputs", {
                                                        ...inputs.legInputs,
                                                        quantity: Math.max(
                                                            4,
                                                            inputs.legInputs
                                                                .quantity - 1,
                                                        ),
                                                    })
                                                }
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </Button>
                                            <div className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11">
                                                <NumberFlow
                                                    value={
                                                        inputs.legInputs
                                                            .quantity
                                                    }
                                                    className="font-mono font-medium text-sm tabular-nums"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-11 w-11 shrink-0"
                                                onClick={() =>
                                                    update("legInputs", {
                                                        ...inputs.legInputs,
                                                        quantity:
                                                            inputs.legInputs
                                                                .quantity + 1,
                                                    })
                                                }
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    {SA106_PIPE_SCHEDULE[
                                        inputs.legInputs.diameter
                                    ] && (
                                        <p className="text-xs text-muted-foreground md:col-span-3">
                                            Wall thickness:{" "}
                                            {
                                                SA106_PIPE_SCHEDULE[
                                                    inputs.legInputs.diameter
                                                ].wall_mm
                                            }{" "}
                                            mm · OD:{" "}
                                            {
                                                SA106_PIPE_SCHEDULE[
                                                    inputs.legInputs.diameter
                                                ].od_mm
                                            }{" "}
                                            mm (ASME B36.10M Sch 40) · Base
                                            plate auto-sized to 10% larger than
                                            OD, 12 mm thick.
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
                                                onClick={() =>
                                                    update("saddleInputs", {
                                                        ...inputs.saddleInputs,
                                                        quantity: Math.max(
                                                            2,
                                                            inputs.saddleInputs
                                                                .quantity - 1,
                                                        ),
                                                    })
                                                }
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </Button>
                                            <div className="w-16 flex items-center justify-center rounded-md border border-input bg-secondary/50 h-11">
                                                <NumberFlow
                                                    value={
                                                        inputs.saddleInputs
                                                            .quantity
                                                    }
                                                    className="font-mono font-medium text-sm tabular-nums"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-11 w-11 shrink-0"
                                                onClick={() =>
                                                    update("saddleInputs", {
                                                        ...inputs.saddleInputs,
                                                        quantity:
                                                            inputs.saddleInputs
                                                                .quantity + 1,
                                                    })
                                                }
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Typical: 2 for short vessels, 3+ for
                                        long vessels.
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Saddle dimensions are derived from
                                        vessel geometry per Zick analysis (L.P.
                                        Zick, 1951).
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Calculate button — split when multiple vessels */}
                    <div className={`flex h-12 w-full ${vessels.length > 1 ? "rounded-xl overflow-hidden" : ""}`}>
                        <button
                            onClick={handleCalculate}
                            disabled={!isValid}
                            className={`flex-1 h-full border-2 border-primary/80 bg-transparent text-primary/80 hover:border-primary hover:bg-primary hover:text-primary-foreground dark:border-primary dark:text-primary dark:hover:text-primary-foreground transition-colors duration-300 flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${vessels.length > 1 ? "rounded-l-xl rounded-r-none border-r-0" : "rounded-xl"}`}
                        >
                            <Calculator className="h-5 w-5" />
                            Calculate Plates
                        </button>
                        {vessels.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        disabled={!isValid}
                                        className="h-full px-3 border-2 border-primary/80 rounded-r-xl bg-transparent text-primary/80 hover:border-primary hover:bg-primary hover:text-primary-foreground dark:border-primary dark:text-primary dark:hover:text-primary-foreground transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onClick={handleCalculateAll}>
                                        <Calculator className="h-4 w-4 mr-2" />
                                        Calculate all vessels ({vessels.length})
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN — sticky schematic ────────────── */}
                <div className="hidden xl:block sticky top-[88px] self-start">
                    <Card className="glass-card card-shadow-lg border-2 border-border/50 rounded-xl overflow-hidden hover:border-primary/40 transition-colors duration-200">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Ruler className="h-4 w-4 text-primary" />
                                    Vessel Schematic
                                </CardTitle>
                                <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                                    Live Preview
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-0">
                            <VesselSchematic
                                inputs={inputs}
                                dishEndInputs={dishEndInputs}
                                style={{
                                    width: "100%",
                                    minHeight: "300px",
                                    aspectRatio: "520/460",
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
