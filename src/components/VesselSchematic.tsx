import { CSSProperties } from "react";
import { VesselInputs, DishEndInputs, HeadType } from "@/lib/types";

interface Props {
    inputs: VesselInputs;
    dishEndInputs: DishEndInputs;
    className?: string;
    style?: CSSProperties;
}

const MONO: CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "10.5px",
    fontWeight: 400,
};

const headLenForOD = (h: HeadType, od: number): number => {
    if (!od) return 0;
    if (h === "hemispherical") return od / 2;
    if (h === "torispherical") return od * 0.208;
    if (h === "flat") return 0;
    return od / 4;
};

const fmt = (n: number) => (n > 0 ? `${Math.round(n)} mm` : "—");

export function VesselSchematic({
    inputs,
    dishEndInputs,
    className = "",
    style,
}: Props) {
    const {
        diameter = 0,
        diameterType = "ID",
        plateThickness = 0,
        shellLength = 0,
        orientation = "vertical",
        legInputs,
        saddleInputs,
    } = inputs;

    const saddleCount = Math.max(2, saddleInputs?.quantity ?? 2);
    const legCount = Math.max(2, legInputs?.quantity ?? 4);
    const { headType = "ellipsoidal", straightFace = 38 } = dishEndInputs || {};

    const VW = 520,
        VH = 460;
    const PAD = 58;

    const od = diameterType === "OD" ? diameter : diameter + 2 * plateThickness;
    const id =
        diameterType === "ID"
            ? diameter
            : Math.max(0, diameter - 2 * plateThickness);

    const headLen = headLenForOD(headType, od);
    const sf = Number(straightFace) || 0;
    const totalLen = (shellLength || 0) + 2 * headLen + 2 * sf;

    const hasShape = od > 0 && (shellLength > 0 || headLen > 0);

    const DW = VW - 2 * PAD;
    const DH = VH - 2 * PAD;

    const legInputLen = legInputs?.length ?? 0;

    let vesselDrawLen: number, vesselDrawDia: number;
    if (orientation === "horizontal") {
        const sLen = totalLen ? DW / totalLen : 1;
        const sDia = od ? DH / od : 1;
        const s = Math.min(sLen, sDia, 0.12);
        vesselDrawLen = hasShape ? totalLen * s : DW * 0.7;
        vesselDrawDia = hasShape ? od * s : DH * 0.4;
    } else {
        // Reserve space for leg supports: solve s so that totalLen*s + legH <= DH-10
        // legH = min(legInputLen*s, 60); two cases handled analytically
        let sLen: number;
        if (legInputLen > 0 && hasShape && totalLen > 0) {
            const sCapHit = (DH - 70) / totalLen;   // assumes legH hits 60px cap
            const sNoCap  = (DH - 10) / (totalLen + legInputLen);
            sLen = legInputLen * sCapHit >= 60 ? sCapHit : sNoCap;
        } else {
            sLen = totalLen ? DH / totalLen : 1;
        }
        const sDia = od ? (DW * 0.55) / od : 1;
        const s = Math.min(sLen, sDia, 0.12);
        vesselDrawLen = hasShape ? totalLen * s : DH * 0.7;
        vesselDrawDia = hasShape ? od * s : DW * 0.3;
    }

    const scale = totalLen ? vesselDrawLen / totalLen : 1;
    const headDraw = headLen * scale;
    const sfDraw = sf * scale;

    const stroke = "hsl(213 85% 46%)";
    const dim = "hsl(215 20% 45%)";
    const labelColor = "hsl(var(--foreground))";
    const fill = "hsl(213 85% 46% / 0.06)";
    const supportColor = "hsl(215 45% 30%)";

    const cx = VW / 2;
    // Shift vessel upward by half the leg height so vessel+legs are vertically centred
    const legHDisplay = orientation === "vertical" && legInputLen > 0 && hasShape
        ? Math.max(15, Math.min(Math.round(legInputLen * scale), 60))
        : 0;
    const cy = VH / 2 - legHDisplay / 2;

    interface Vessel {
        kind: "h" | "v";
        cx: number;
        cy: number;
        top?: number;
        bottom?: number;
        leftBase?: number;
        rightBase?: number;
        leftTip?: number;
        rightTip?: number;
        left?: number;
        right?: number;
        topBase?: number;
        bottomBase?: number;
        topTip?: number;
        bottomTip?: number;
        radOD: number;
    }

    let vessel: Vessel;
    if (orientation === "horizontal") {
        vessel = {
            kind: "h",
            cx,
            cy,
            top: cy - vesselDrawDia / 2,
            bottom: cy + vesselDrawDia / 2,
            leftBase: cx - vesselDrawLen / 2 + headDraw,
            rightBase: cx + vesselDrawLen / 2 - headDraw,
            leftTip: cx - vesselDrawLen / 2,
            rightTip: cx + vesselDrawLen / 2,
            radOD: vesselDrawDia / 2,
        };
    } else {
        vessel = {
            kind: "v",
            cx,
            cy,
            left: cx - vesselDrawDia / 2,
            right: cx + vesselDrawDia / 2,
            topBase: cy - vesselDrawLen / 2 + headDraw,
            bottomBase: cy + vesselDrawLen / 2 - headDraw,
            topTip: cy - vesselDrawLen / 2,
            bottomTip: cy + vesselDrawLen / 2,
            radOD: vesselDrawDia / 2,
        };
    }

    // ─── Supports ───
    const supports: any[] = [];
    if (orientation === "horizontal" && hasShape) {
        const shellStart = (vessel.leftBase ?? 0) + sfDraw;
        const shellEnd = (vessel.rightBase ?? 0) - sfDraw;
        const sLen = Math.max(shellEnd - shellStart, 0);
        const sadW = Math.min(32, vesselDrawDia * 0.7);
        const sadH = 18;
        const t0 = saddleCount === 1 ? 0.5 : 0.2;
        const t1 = saddleCount === 1 ? 0.5 : 0.8;
        for (let i = 0; i < saddleCount; i++) {
            const t =
                saddleCount === 1
                    ? 0.5
                    : t0 + (t1 - t0) * (i / (saddleCount - 1));
            supports.push({
                kind: "saddle",
                x: shellStart + sLen * t,
                y: vessel.bottom,
                w: sadW,
                h: sadH,
            });
        }
    }
    if (orientation === "vertical" && hasShape) {
        const legInputLen = legInputs?.length ?? 0;
        const legH = legInputLen > 0 ? Math.max(15, Math.min(Math.round(legInputLen * scale), 60)) : 0;
        const legTop = vessel.bottomTip ?? 0;
        const legOffset = vessel.radOD * 0.55;
        if (legH > 0) {
            const visibleLegs = Math.min(2, legCount);
            if (visibleLegs >= 1)
                supports.push({
                    kind: "leg",
                    x1: cx - legOffset,
                    y1: legTop - 2,
                    y2: legTop + legH,
                });
            if (visibleLegs >= 2)
                supports.push({
                    kind: "leg",
                    x1: cx + legOffset,
                    y1: legTop - 2,
                    y2: legTop + legH,
                });
            supports.push({
                kind: "ground",
                x1: cx - legOffset - 20,
                x2: cx + legOffset + 20,
                y: legTop + legH,
            });
            supports.push({
                kind: "legDim",
                x: cx + legOffset + 18,
                y1: legTop,
                y2: legTop + legH,
                label: fmt(legInputLen),
            });
            if (legCount > 2)
                supports.push({
                    kind: "legCount",
                    x: cx,
                    y: legTop + legH + 18,
                    label: `× ${legCount} legs total`,
                });
        }
    }

    // ─── Dimensions ───
    const dims: any[] = [];
    if (vessel.kind === "h") {
        const dyTop = (vessel.top ?? 0) - 28;
        dims.push({
            type: "dim-h",
            x1: vessel.leftTip,
            x2: vessel.rightTip,
            y: dyTop,
            label: `Total Length ${fmt(totalLen)}`,
        });
        const yB = (vessel.bottom ?? 0) + 32;
        dims.push({
            type: "dim-h",
            x1: (vessel.leftBase ?? 0) + sfDraw,
            x2: (vessel.rightBase ?? 0) - sfDraw,
            y: yB,
            label: `Shell Length ${fmt(shellLength)}`,
            labelBelow: true,
        });
        dims.push({
            type: "dim-v",
            y1: vessel.top,
            y2: vessel.bottom,
            x: (vessel.rightTip ?? 0) + 28,
            label: `${diameterType} ${fmt(od)}`,
        });
    } else {
        dims.push({
            type: "dim-v",
            y1: vessel.topTip,
            y2: vessel.bottomTip,
            x: (vessel.right ?? 0) + 30,
            label: `Total Length ${fmt(totalLen)}`,
        });
        dims.push({
            type: "dim-v",
            y1: (vessel.topBase ?? 0) + sfDraw,
            y2: (vessel.bottomBase ?? 0) - sfDraw,
            x: (vessel.left ?? 0) - 30,
            label: `Shell Length ${fmt(shellLength)}`,
            leftSide: true,
        });
        dims.push({
            type: "dim-h",
            x1: vessel.left,
            x2: vessel.right,
            y: (vessel.topTip ?? 0) - 24,
            label: `${diameterType} ${fmt(od)}`,
        });
    }

    // ─── Vessel body path ───
    let bodyPath = "";
    if (vessel.kind === "h") {
        const {
            leftBase: lB = 0,
            rightBase: rB = 0,
            top: t = 0,
            bottom: b = 0,
            radOD: r = 0,
        } = vessel;
        bodyPath = `M ${lB} ${t} L ${rB} ${t} `;
        if (headType === "flat" || headDraw === 0) {
            /* straight endcap */
        } else if (headType === "hemispherical")
            bodyPath += `A ${r} ${r} 0 0 1 ${rB} ${b} `;
        else bodyPath += `A ${headDraw} ${r} 0 0 1 ${rB} ${b} `;
        bodyPath += `L ${lB} ${b} `;
        if (headType === "flat" || headDraw === 0) {
            /* straight */
        } else if (headType === "hemispherical")
            bodyPath += `A ${r} ${r} 0 0 1 ${lB} ${t} `;
        else bodyPath += `A ${headDraw} ${r} 0 0 1 ${lB} ${t} `;
        bodyPath += "Z";
    } else {
        const {
            left: l = 0,
            right: r = 0,
            topBase: tB = 0,
            bottomBase: bB = 0,
            radOD: rad = 0,
        } = vessel;
        bodyPath = `M ${l} ${tB} `;
        if (headType === "flat" || headDraw === 0) bodyPath += `L ${r} ${tB} `;
        else if (headType === "hemispherical")
            bodyPath += `A ${rad} ${rad} 0 0 1 ${r} ${tB} `;
        else bodyPath += `A ${rad} ${headDraw} 0 0 1 ${r} ${tB} `;
        bodyPath += `L ${r} ${bB} `;
        if (headType === "flat" || headDraw === 0) bodyPath += `L ${l} ${bB} `;
        else if (headType === "hemispherical")
            bodyPath += `A ${rad} ${rad} 0 0 1 ${l} ${bB} `;
        else bodyPath += `A ${rad} ${headDraw} 0 0 1 ${l} ${bB} `;
        bodyPath += "Z";
    }

    return (
        <div className={className} style={{ ...style, position: "relative" }}>
            <svg
                viewBox={`0 0 ${VW} ${VH}`}
                width="100%"
                height="100%"
                style={{ display: "block" }}
            >
                <defs>
                    <pattern
                        id="schGrid"
                        width="20"
                        height="20"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 20 0 L 0 0 0 20"
                            fill="none"
                            stroke="hsl(var(--border))"
                            strokeWidth="0.5"
                        />
                    </pattern>
                </defs>

                <rect
                    width={VW}
                    height={VH}
                    fill="url(#schGrid)"
                    opacity="0.7"
                />

                {/* Dimension lines */}
                {hasShape &&
                    dims.map((d, i) => {
                        if (d.type === "dim-h") {
                            return (
                                <g
                                    key={`d${i}`}
                                    stroke={dim}
                                    strokeWidth="1"
                                    fill="none"
                                >
                                    <line
                                        x1={d.x1}
                                        y1={d.y}
                                        x2={d.x2}
                                        y2={d.y}
                                    />
                                    <line
                                        x1={d.x1}
                                        y1={d.y - 5}
                                        x2={d.x1}
                                        y2={d.y + 5}
                                    />
                                    <line
                                        x1={d.x2}
                                        y1={d.y - 5}
                                        x2={d.x2}
                                        y2={d.y + 5}
                                    />
                                    <text
                                        x={(d.x1 + d.x2) / 2}
                                        y={d.labelBelow ? d.y + 15 : d.y - 7}
                                        fill={labelColor}
                                        stroke="none"
                                        textAnchor="middle"
                                        style={MONO}
                                    >
                                        {d.label}
                                    </text>
                                </g>
                            );
                        }
                        // dim-v
                        const midY = (d.y1 + d.y2) / 2;
                        const lx = d.leftSide ? d.x - 14 : d.x + 14;
                        return (
                            <g
                                key={`d${i}`}
                                stroke={dim}
                                strokeWidth="1"
                                fill="none"
                            >
                                <line
                                    x1={d.x}
                                    y1={d.y1}
                                    x2={d.x}
                                    y2={d.y2}
                                />
                                <line
                                    x1={d.x - 5}
                                    y1={d.y1}
                                    x2={d.x + 5}
                                    y2={d.y1}
                                />
                                <line
                                    x1={d.x - 5}
                                    y1={d.y2}
                                    x2={d.x + 5}
                                    y2={d.y2}
                                />
                                <text
                                    x={lx}
                                    y={midY}
                                    fill={labelColor}
                                    stroke="none"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    transform={`rotate(-90, ${lx}, ${midY})`}
                                    style={MONO}
                                >
                                    {d.label}
                                </text>
                            </g>
                        );
                    })}

                {/* Vessel fill */}
                {hasShape && (
                    <path
                        d={bodyPath}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="1.5"
                    />
                )}

                {/* Inner wall dashes */}
                {hasShape &&
                    plateThickness > 0 &&
                    id > 0 &&
                    (() => {
                        const t = plateThickness * scale;
                        if (vessel.kind === "h") {
                            return (
                                <g
                                    stroke={stroke}
                                    strokeWidth="0.75"
                                    strokeDasharray="3 3"
                                    opacity="0.7"
                                >
                                    <line
                                        x1={vessel.leftBase}
                                        y1={(vessel.top ?? 0) + t}
                                        x2={vessel.rightBase}
                                        y2={(vessel.top ?? 0) + t}
                                    />
                                    <line
                                        x1={vessel.leftBase}
                                        y1={(vessel.bottom ?? 0) - t}
                                        x2={vessel.rightBase}
                                        y2={(vessel.bottom ?? 0) - t}
                                    />
                                </g>
                            );
                        }
                        return (
                            <g
                                stroke={stroke}
                                strokeWidth="0.75"
                                strokeDasharray="3 3"
                                opacity="0.7"
                            >
                                <line
                                    x1={(vessel.left ?? 0) + t}
                                    y1={vessel.topBase}
                                    x2={(vessel.left ?? 0) + t}
                                    y2={vessel.bottomBase}
                                />
                                <line
                                    x1={(vessel.right ?? 0) - t}
                                    y1={vessel.topBase}
                                    x2={(vessel.right ?? 0) - t}
                                    y2={vessel.bottomBase}
                                />
                            </g>
                        );
                    })()}

                {/* Straight-face indicators */}
                {hasShape &&
                    headType !== "flat" &&
                    sfDraw > 4 &&
                    (() => {
                        if (vessel.kind === "h") {
                            const xL = (vessel.leftBase ?? 0) + sfDraw;
                            const xR = (vessel.rightBase ?? 0) - sfDraw;
                            return (
                                <g
                                    stroke={stroke}
                                    strokeWidth="0.75"
                                    strokeDasharray="2 3"
                                    opacity="0.55"
                                >
                                    <line
                                        x1={xL}
                                        y1={vessel.top}
                                        x2={xL}
                                        y2={vessel.bottom}
                                    />
                                    <line
                                        x1={xR}
                                        y1={vessel.top}
                                        x2={xR}
                                        y2={vessel.bottom}
                                    />
                                </g>
                            );
                        }
                        const yT = (vessel.topBase ?? 0) + sfDraw;
                        const yB = (vessel.bottomBase ?? 0) - sfDraw;
                        return (
                            <g
                                stroke={stroke}
                                strokeWidth="0.75"
                                strokeDasharray="2 3"
                                opacity="0.55"
                            >
                                <line
                                    x1={vessel.left}
                                    y1={yT}
                                    x2={vessel.right}
                                    y2={yT}
                                />
                                <line
                                    x1={vessel.left}
                                    y1={yB}
                                    x2={vessel.right}
                                    y2={yB}
                                />
                            </g>
                        );
                    })()}

                {/* Center axis */}
                {hasShape && (
                    <g
                        stroke={dim}
                        strokeWidth="0.5"
                        strokeDasharray="6 3"
                        opacity="0.45"
                    >
                        {vessel.kind === "h" ? (
                            <line
                                x1={(vessel.leftTip ?? 0) - 8}
                                y1={cy}
                                x2={(vessel.rightTip ?? 0) + 8}
                                y2={cy}
                            />
                        ) : (
                            <line
                                x1={cx}
                                y1={(vessel.topTip ?? 0) - 8}
                                x2={cx}
                                y2={(vessel.bottomTip ?? 0) + 8}
                            />
                        )}
                    </g>
                )}

                {/* Supports */}
                {supports.map((s, i) => {
                    if (s.kind === "saddle") {
                        const r = vessel.radOD;
                        const vesselBottom = vessel.bottom ?? (cy + r);
                        const theta = Math.PI / 5;
                        const leftX = s.x - Math.sin(theta) * r;
                        const rightX = s.x + Math.sin(theta) * r;
                        const contactY = cy + Math.cos(theta) * r;
                        const baseY = vesselBottom + 14;
                        const baseHalf = Math.sin(theta) * r + 8;
                        const baseL = s.x - baseHalf;
                        const baseR = s.x + baseHalf;
                        return (
                            <g key={`sp${i}`}>
                                <path
                                    d={`M ${leftX} ${contactY} A ${r} ${r} 0 0 0 ${rightX} ${contactY} L ${baseR} ${baseY} L ${baseL} ${baseY} Z`}
                                    fill={supportColor}
                                    fillOpacity="0.7"
                                    stroke={supportColor}
                                    strokeWidth="1"
                                />
                                <line
                                    x1={baseL - 4}
                                    y1={baseY}
                                    x2={baseR + 4}
                                    y2={baseY}
                                    stroke={supportColor}
                                    strokeWidth="1.2"
                                />
                                {[0, 1, 2, 3].map((k) => {
                                    const x =
                                        baseL +
                                        (k + 0.5) * ((baseR - baseL) / 4);
                                    return (
                                        <line
                                            key={k}
                                            x1={x}
                                            y1={baseY}
                                            x2={x - 4}
                                            y2={baseY + 5}
                                            stroke={supportColor}
                                            strokeWidth="0.75"
                                        />
                                    );
                                })}
                            </g>
                        );
                    }
                    if (s.kind === "leg") {
                        return (
                            <line
                                key={`sp${i}`}
                                x1={s.x1}
                                y1={s.y1}
                                x2={s.x1}
                                y2={s.y2}
                                stroke={supportColor}
                                strokeWidth="3"
                                strokeLinecap="square"
                            />
                        );
                    }
                    if (s.kind === "ground") {
                        return (
                            <g key={`sp${i}`}>
                                <line
                                    x1={s.x1}
                                    y1={s.y}
                                    x2={s.x2}
                                    y2={s.y}
                                    stroke={supportColor}
                                    strokeWidth="1.2"
                                />
                                {Array.from({ length: 6 }).map((_, k) => {
                                    const x =
                                        s.x1 + (k + 0.5) * ((s.x2 - s.x1) / 6);
                                    return (
                                        <line
                                            key={k}
                                            x1={x}
                                            y1={s.y}
                                            x2={x - 5}
                                            y2={s.y + 6}
                                            stroke={supportColor}
                                            strokeWidth="0.75"
                                        />
                                    );
                                })}
                            </g>
                        );
                    }
                    if (s.kind === "legCount") {
                        return (
                            <text
                                key={`sp${i}`}
                                x={s.x}
                                y={s.y}
                                textAnchor="middle"
                                style={{ ...MONO, fill: labelColor }}
                            >
                                {s.label}
                            </text>
                        );
                    }
                    if (s.kind === "legDim") {
                        const midY = (s.y1 + s.y2) / 2;
                        const lx = s.x + 14;
                        return (
                            <g key={`sp${i}`} stroke={dim} strokeWidth="1" fill="none">
                                <line x1={s.x} y1={s.y1} x2={s.x} y2={s.y2} />
                                <line x1={s.x - 4} y1={s.y1} x2={s.x + 4} y2={s.y1} />
                                <line x1={s.x - 4} y1={s.y2} x2={s.x + 4} y2={s.y2} />
                                <text
                                    x={lx} y={midY}
                                    fill={labelColor} stroke="none" textAnchor="middle" dominantBaseline="middle"
                                    transform={`rotate(-90, ${lx}, ${midY})`}
                                    style={MONO}
                                >
                                    {s.label}
                                </text>
                            </g>
                        );
                    }
                    return null;
                })}

                {/* Empty hint */}
                {!hasShape && (
                    <text
                        x={VW / 2}
                        y={VH / 2}
                        textAnchor="middle"
                        style={{ ...MONO, fill: dim, fontSize: "11px" }}
                    >
                        enter diameter & length to populate
                    </text>
                )}

            </svg>
        </div>
    );
}
