import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

import { wordPath } from "../../../lib/platform.js";

const RINGS = [
    { key: "closest", label: "Closest", scale: 0.42 },
    { key: "related", label: "Related", scale: 0.7 },
    { key: "associated", label: "Associated", scale: 0.95 },
];

const ringStyles = {
    closest: { rect: "fill-accent stroke-accent", text: "fill-accent-ink font-medium", dot: "bg-accent" },
    related: { rect: "fill-surface stroke-line-strong", text: "fill-ink", dot: "bg-ink" },
    associated: { rect: "fill-paper stroke-line", text: "fill-muted", dot: "border border-line-strong bg-paper" },
};

const useElementWidth = () => {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);

    // Measure before paint so the map never flashes empty.
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        setWidth(Math.round(element.getBoundingClientRect().width));

        const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return [ref, width];
};

const angularDistance = (a, b) => {
    const diff = Math.abs(a - b) % (Math.PI * 2);
    return diff > Math.PI ? Math.PI * 2 - diff : diff;
};

const labelWidth = (text, isInner) => text.length * (isInner ? 7.9 : 7.3) + (isInner ? 28 : 22);

const getCenterSize = (word, isCompact) => {
    const font = isCompact ? 18 : 24;
    return { font, height: isCompact ? 40 : 52, width: word.length * font * 0.56 + (isCompact ? 32 : 52) };
};

// Nudge overlapping labels apart (and off the centre pill) while keeping
// them inside the canvas. A few dozen passes is plenty for ~30 labels.
const relax = (nodes, center, width, height) => {
    const gap = 6;
    const items = [{ ...center, fixed: true }, ...nodes];

    for (let pass = 0; pass < 80; pass += 1) {
        let moved = false;

        for (let i = 0; i < items.length; i += 1) {
            for (let j = i + 1; j < items.length; j += 1) {
                const a = items[i];
                const b = items[j];
                const overlapX = (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x);
                const overlapY = (a.h + b.h) / 2 + gap - Math.abs(a.y - b.y);

                if (overlapX <= 0 || overlapY <= 0) continue;

                moved = true;
                const pushY = overlapY < overlapX * 1.6;
                const amount = (pushY ? overlapY : overlapX) / (a.fixed ? 1 : 2);
                const sign = pushY ? Math.sign(b.y - a.y || 1) : Math.sign(b.x - a.x || 1);

                if (pushY) {
                    if (!a.fixed) a.y -= sign * amount;
                    b.y += sign * amount;
                } else {
                    if (!a.fixed) a.x -= sign * amount;
                    b.x += sign * amount;
                }
            }
        }

        for (const node of items) {
            if (node.fixed) continue;
            node.x = Math.min(width - node.w / 2 - 8, Math.max(node.w / 2 + 8, node.x));
            node.y = Math.min(height - node.h / 2 - 8, Math.max(node.h / 2 + 8, node.y));
        }

        if (!moved) break;
    }

    return items.slice(1);
};

// Distribute the closest, related and associated words over three
// concentric ellipses, linking each word to its nearest inner neighbour.
const buildLayout = ({ word, insights, width, height, hidden }) => {
    const isCompact = width < 768;
    const counts = isCompact ? [4, 5, 6] : [8, 10, 12];

    const closest = [...insights.synonyms, ...insights.similar].slice(0, counts[0]);
    const related = insights.similar.filter(item => !closest.includes(item)).slice(0, counts[1]);
    const associated = insights.associated.filter(item => !closest.includes(item) && !related.includes(item)).slice(0, counts[2]);

    const words = { closest, related, associated };
    const cx = width / 2;
    const cy = height / 2;
    const maxRx = width / 2 - (isCompact ? 44 : 72);
    const maxRy = height / 2 - 26;

    const nodes = [];
    const ellipses = [];
    let innerRing = [];

    RINGS.forEach((ring, ringIndex) => {
        const items = words[ring.key];
        const rx = maxRx * ring.scale;
        const ry = maxRy * ring.scale;

        ellipses.push({ key: ring.key, label: ring.label, rx, ry, count: items.length });

        if (hidden.has(ring.key) || !items.length) return;

        // On narrow maps, rotate the inner rings so no label sits level with the centre pill.
        const offset = -Math.PI / 2 + (ringIndex === 1 || (isCompact && ringIndex === 0)
            ? Math.PI / items.length
            : 0.18 * ringIndex + 0.2);

        const ringNodes = items.map((item, index) => {
            const angle = offset + (index * Math.PI * 2) / items.length;
            const parent = innerRing.length
                ? innerRing.reduce((best, node) => (angularDistance(node.angle, angle) < angularDistance(best.angle, angle) ? node : best))
                : null;

            return {
                id: `${ring.key}-${item}`,
                word: item,
                ring: ring.key,
                ringIndex,
                index,
                angle,
                x: cx + Math.cos(angle) * rx,
                y: cy + Math.sin(angle) * ry,
                w: labelWidth(item, ringIndex === 0),
                h: ringIndex === 0 ? 32 : 28,
                parentId: parent?.id ?? "center",
            };
        });

        nodes.push(...ringNodes);
        innerRing = ringNodes;
    });

    const centerSize = getCenterSize(word, isCompact);
    const center = { id: "center", word, x: cx, y: cy, w: centerSize.width + 8, h: centerSize.height + 8 };

    return {
        center,
        nodes: relax(nodes, center, width, height),
        ellipses,
        total: closest.length + related.length + associated.length,
        isCompact,
    };
};

const WordMap = ({ word, insights, isLoading }) => {
    const navigate = useNavigate();
    const [containerRef, width] = useElementWidth();
    const [hidden, setHidden] = useState(() => new Set());
    const [activeId, setActiveId] = useState(null);

    const isCompact = width < 768;
    const height = isCompact ? 540 : 580;

    const layout = useMemo(
        () => (width ? buildLayout({ word, insights, width, height, hidden }) : null),
        [word, insights, width, height, hidden]
    );

    const nodeById = useMemo(() => new Map(layout?.nodes.map(node => [node.id, node]) ?? []), [layout]);

    // The hovered word plus every ancestor back to the centre stays lit.
    const litIds = useMemo(() => {
        if (!activeId) return null;
        const ids = new Set(["center"]);
        let node = nodeById.get(activeId);
        while (node) {
            ids.add(node.id);
            node = nodeById.get(node.parentId);
        }
        return ids;
    }, [activeId, nodeById]);

    const toggleRing = (key) => {
        setHidden(current => {
            const next = new Set(current);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const { font: centerFont, height: centerHeight, width: centerWidth } = getCenterSize(word, isCompact);

    return (
        <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-xs">
                {RINGS.map(ring => {
                    const count = layout?.ellipses.find(item => item.key === ring.key)?.count ?? 0;
                    const isHidden = hidden.has(ring.key);

                    return (
                        <button
                            key={ring.key}
                            type="button"
                            aria-pressed={!isHidden}
                            disabled={!count}
                            onClick={() => toggleRing(ring.key)}
                            className={`flex items-center gap-sm rounded-full border px-base py-xs text-body-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isHidden ? "border-line text-faint" : "border-line-strong bg-surface text-ink"}`}
                        >
                            <span className={`h-2.5 w-2.5 rounded-full ${ringStyles[ring.key].dot} ${isHidden ? "opacity-30" : ""}`} />
                            {ring.label}
                            <span className="font-mono text-[0.6875rem] text-faint">{count}</span>
                        </button>
                    );
                })}
                <span className="ml-auto hidden text-body-sm text-faint md:block">Hover to trace a path · click to travel</span>
            </div>

            <div
                ref={containerRef}
                className="relative overflow-hidden rounded-3xl border border-line bg-surface"
                style={{ height }}
            >
                <div className="atlas-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

                {layout && (
                    <svg
                        width={width}
                        height={height}
                        viewBox={`0 0 ${width} ${height}`}
                        role="group"
                        aria-label={`Semantic map of words related to ${word}`}
                        className="relative block select-none"
                    >
                        {layout.ellipses.map((ellipse, index) => (
                            <motion.ellipse
                                key={ellipse.key}
                                cx={layout.center.x}
                                cy={layout.center.y}
                                rx={ellipse.rx}
                                ry={ellipse.ry}
                                fill="none"
                                strokeDasharray="2 6"
                                className="stroke-line-strong"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: hidden.has(ellipse.key) ? 0.25 : 1, scale: 1 }}
                                transition={{ duration: 0.9, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                style={{ transformOrigin: `${layout.center.x}px ${layout.center.y}px` }}
                            />
                        ))}

                        {layout.nodes.map(node => {
                            const parent = node.parentId === "center" ? layout.center : nodeById.get(node.parentId);
                            const isLit = litIds?.has(node.id);

                            return (
                                <motion.line
                                    key={`edge-${node.id}`}
                                    x1={parent.x}
                                    y1={parent.y}
                                    x2={node.x}
                                    y2={node.y}
                                    className={isLit ? "stroke-accent" : "stroke-line-strong"}
                                    strokeWidth={isLit ? 1.75 : 1}
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: litIds && !isLit ? 0.25 : 1 }}
                                    transition={{ duration: 0.7, delay: 0.2 + node.ringIndex * 0.18 + node.index * 0.02 }}
                                />
                            );
                        })}

                        {layout.nodes.map(node => {
                            const isInner = node.ringIndex === 0;
                            const nodeWidth = node.w;
                            const nodeHeight = node.h;
                            const isDimmed = litIds && !litIds.has(node.id);
                            const isActive = activeId === node.id;
                            const styles = ringStyles[node.ring];

                            return (
                                <motion.g
                                    key={node.id}
                                    role="link"
                                    tabIndex={0}
                                    aria-label={`${node.word} (${node.ring})`}
                                    onMouseEnter={() => setActiveId(node.id)}
                                    onMouseLeave={() => setActiveId(null)}
                                    onFocus={() => setActiveId(node.id)}
                                    onBlur={() => setActiveId(null)}
                                    onClick={() => navigate(wordPath(node.word))}
                                    onKeyDown={event => event.key === "Enter" && navigate(wordPath(node.word))}
                                    className="cursor-pointer outline-none"
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: isDimmed ? 0.3 : 1, scale: isActive ? 1.08 : 1 }}
                                    transition={{
                                        opacity: { duration: 0.5, delay: litIds ? 0 : 0.35 + node.ringIndex * 0.18 + node.index * 0.025 },
                                        scale: { type: "spring", stiffness: 400, damping: 26, delay: litIds ? 0 : 0.35 + node.ringIndex * 0.18 + node.index * 0.025 },
                                    }}
                                    style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                                >
                                    <rect
                                        x={node.x - nodeWidth / 2}
                                        y={node.y - nodeHeight / 2}
                                        width={nodeWidth}
                                        height={nodeHeight}
                                        rx={nodeHeight / 2}
                                        className={`${isActive ? "fill-ink stroke-ink" : styles.rect} transition-colors duration-200`}
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={node.x}
                                        y={node.y}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        className={`${isActive ? "fill-paper" : styles.text} font-body transition-colors duration-200 ${isInner ? "text-[14px]" : "text-[13px]"}`}
                                    >
                                        {node.word}
                                    </text>
                                </motion.g>
                            );
                        })}

                        <motion.g
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            style={{ transformOrigin: `${layout.center.x}px ${layout.center.y}px` }}
                        >
                            {isLoading && (
                                <circle cx={layout.center.x} cy={layout.center.y} r={centerWidth / 2 + 12} className="fill-none stroke-accent">
                                    <animate attributeName="r" values={`${centerWidth / 2};${centerWidth / 2 + 40}`} dur="1.6s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" values="0.6;0" dur="1.6s" repeatCount="indefinite" />
                                </circle>
                            )}
                            <rect
                                x={layout.center.x - centerWidth / 2}
                                y={layout.center.y - centerHeight / 2}
                                width={centerWidth}
                                height={centerHeight}
                                rx={centerHeight / 2}
                                className="fill-ink"
                            />
                            <text
                                x={layout.center.x}
                                y={layout.center.y + 1}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="display fill-paper italic"
                                style={{ fontSize: centerFont }}
                            >
                                {word}
                            </text>
                        </motion.g>
                    </svg>
                )}

                {layout && !isLoading && layout.total === 0 && (
                    <p className="absolute inset-x-0 bottom-lg text-center text-body-sm text-muted">
                        No mapped neighbours for this word yet.
                    </p>
                )}
            </div>
        </div>
    );
};

export default WordMap;
