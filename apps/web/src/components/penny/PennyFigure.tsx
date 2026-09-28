'use client';

import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  PENNY_STATE_META,
  toKitState,
  type PennyEyes,
  type PennyKitState,
  type PennyMouth,
  type PennyPose,
  type PennyStateMeta,
} from '@/components/penny/penny-states';

export type { PennyPose, PennyKitState };

const INK = '#1A1F36';
const GOLD = '#F7D060';
const INDIGO = '#5B5CE2';
const SHADE = '#E9BC42';
const RIM = '#D9A62E';
const STAR = 'M0 -8 Q1.6 -1.6 8 0 Q1.6 1.6 0 8 Q-1.6 1.6 -8 0 Q-1.6 -1.6 0 -8Z';

function Eyes({ kind }: { kind: PennyEyes }) {
  const L = 85;
  const R = 115;
  const y = 97;
  const cap = (x: number, yy: number, h: number) => (
    <rect x={x - 4.5} y={yy - h / 2} width={9} height={h} rx={4.5} fill={INK} />
  );
  const arcUp = (x: number, yy: number) => (
    <path
      d={`M${x - 6} ${yy + 2} Q${x} ${yy - 5} ${x + 6} ${yy + 2}`}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
  const arcDown = (x: number, yy: number) => (
    <path
      d={`M${x - 6} ${yy} Q${x} ${yy + 4.5} ${x + 6} ${yy}`}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );

  switch (kind) {
    case 'happy':
      return (
        <g className="eyes">
          {arcUp(L, y)}
          {arcUp(R, y)}
        </g>
      );
    case 'wink':
      return (
        <g className="eyes">
          <g className="blk fb">{cap(L, y, 14)}</g>
          {arcUp(R, y)}
        </g>
      );
    case 'closed':
      return (
        <g className="eyes">
          {arcDown(L, y)}
          {arcDown(R, y)}
        </g>
      );
    case 'up':
      return (
        <g className="eyes">
          <g className="blk fb">
            {cap(L + 1, y - 4, 12)}
            {cap(R + 1, y - 4, 12)}
          </g>
        </g>
      );
    case 'alert':
      return (
        <g className="eyes">
          <g className="blk fb">
            {cap(L, y + 1, 11)}
            {cap(R, y + 1, 11)}
          </g>
          <path
            d="M77 84 L92 81 M108 81 L123 84"
            fill="none"
            stroke={INK}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
        </g>
      );
    default:
      return (
        <g className="eyes">
          <g className="blk fb">
            {cap(L, y, 14)}
            {cap(R, y, 14)}
          </g>
        </g>
      );
  }
}

function Mouth({ kind }: { kind: PennyMouth }) {
  const s = {
    fill: 'none' as const,
    stroke: INK,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
  };
  switch (kind) {
    case 'open':
      return (
        <path
          d="M91 116 Q100 127 109 116 Q100 118.5 91 116Z"
          fill={INK}
          stroke={INK}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      );
    case 'flat':
      return <path d="M94 119 L106 119" {...s} />;
    case 'side':
      return <path d="M94 119.5 Q101 119 107 116" {...s} />;
    case 'osmall':
      return <ellipse cx={100} cy={118} rx={3} ry={2.5} fill={INK} />;
    case 'talk':
      return <ellipse className="talk fb" cx={100} cy={119} rx={5.5} ry={4.2} fill={INK} />;
    default:
      return <path d="M90.5 117 Q100 125 109.5 117" {...s} />;
  }
}

function CoinBody({ clipId, compact }: { clipId: string; compact?: boolean }) {
  const ticks = useMemo(() => {
    if (compact) return '';
    let d = '';
    for (let i = 0; i < 60; i++) {
      const a = ((i * 6) * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      d += `M${(100 + 58.5 * c).toFixed(1)} ${(100 + 58.5 * s).toFixed(1)} L${(100 + 62.5 * c).toFixed(1)} ${(100 + 62.5 * s).toFixed(1)} `;
    }
    return d;
  }, [compact]);

  return (
    <>
      <clipPath id={clipId}>
        <circle cx={100} cy={100} r={64} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <circle cx={100} cy={100} r={64} fill={SHADE} />
        <circle cx={95} cy={94} r={62} fill={GOLD} />
      </g>
      {!compact && ticks ? (
        <path d={ticks} stroke={RIM} strokeWidth={1.5} opacity={0.8} />
      ) : null}
      {!compact ? (
        <circle cx={100} cy={100} r={55} fill="none" stroke={RIM} strokeWidth={1.6} opacity={0.85} />
      ) : null}
      <path
        d="M54 76 A52 52 0 0 1 76 52"
        fill="none"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <circle cx={100} cy={100} r={64} fill="none" stroke={INK} strokeWidth={3} />
    </>
  );
}

function Orbit({ half }: { half: 'back' | 'front' }) {
  const d = half === 'back' ? 'M8 100 A92 24 0 0 1 192 100' : 'M192 100 A92 24 0 0 1 8 100';
  const back = half === 'back';
  return (
    <g className={`orbit orbit-${half}`}>
      <path
        d={d}
        fill="none"
        stroke={INDIGO}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={back ? 0.45 : 1}
      />
      <path
        className="glint"
        d={d}
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="18 222"
        opacity={back ? 0.4 : 0.95}
      />
    </g>
  );
}

function Props({ list }: { list?: PennyStateMeta['props'] }) {
  if (!list?.length) return null;
  const delay = (s: number) => ({ style: { animationDelay: `${s}s` } });
  return (
    <>
      {list.includes('dots')
        ? (
            [
              [160, 44, 3, 0],
              [172, 31, 4.2, 0.2],
              [186, 16, 5.6, 0.4],
            ] as const
          ).map(([x, y, r, d]) => (
            <circle
              key={`d-${x}`}
              className="tdot fb"
              {...delay(d)}
              cx={x}
              cy={y}
              r={r}
              fill={INDIGO}
            />
          ))
        : null}
      {list.includes('bubble') ? (
        <g transform="translate(166 30)">
          <path
            d="M-22 -13 H22 A12 12 0 0 1 22 11 H-6 L-14 19 L-13 11 H-22 A12 12 0 0 1 -22 -13Z"
            fill="#fff"
            stroke={INK}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {([-10, 0, 10] as const).map((x, i) => (
            <circle
              key={x}
              className="tdot fb"
              {...delay(i * 0.2)}
              cx={x}
              cy={-1}
              r={3.2}
              fill={INDIGO}
            />
          ))}
        </g>
      ) : null}
      {list.includes('spark1') ? (
        <g transform="translate(188 52) scale(0.8)">
          <path className="spark fb" d={STAR} fill={GOLD} stroke={INK} strokeWidth={1.8} />
        </g>
      ) : null}
      {list.includes('sparks')
        ? (
            [
              [16, 38, 1, 0],
              [188, 46, 0.8, 0.5],
              [50, 6, 0.6, 0.9],
              [158, 8, 0.7, 0.3],
            ] as const
          ).map(([x, y, s, d], i) => (
            <g key={`sp-${i}`} transform={`translate(${x} ${y}) scale(${s})`}>
              <path
                className="spark fb"
                {...delay(d)}
                d={STAR}
                fill={i % 2 ? '#fff' : GOLD}
                stroke={INK}
                strokeWidth={1.6}
              />
            </g>
          ))
        : null}
      {list.includes('check') ? (
        <g transform="translate(168 34)">
          <g className="badge fb">
            <circle r={14} fill={INDIGO} stroke={INK} strokeWidth={2.6} />
            <path
              d="M-6 0.5 L-1.8 4.8 L6.5 -4.8"
              fill="none"
              stroke="#fff"
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      ) : null}
      {list.includes('badge') ? (
        <g transform="translate(168 34)">
          <g className="pulse fb">
            <circle r={14} fill={INDIGO} stroke={INK} strokeWidth={2.6} />
            <path d="M0 -6 V1.5" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" />
            <circle cy={6.2} r={2} fill="#fff" />
          </g>
        </g>
      ) : null}
      {list.includes('zzz')
        ? (
            [
              [148, 40, 0.7, 0],
              [162, 24, 0.9, 1.2],
              [178, 6, 1.1, 2.4],
            ] as const
          ).map(([x, y, s, d]) => (
            <g key={`z-${x}`} transform={`translate(${x} ${y}) scale(${s})`}>
              <path
                className="z fb"
                {...delay(d)}
                d="M-5 -6 H5 L-5 6 H5"
                fill="none"
                stroke={INDIGO}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))
        : null}
      {list.includes('hearts')
        ? (
            [
              [166, 40, 1, 0],
              [32, 46, 0.8, 0.7],
              [188, 78, 0.65, 1.4],
            ] as const
          ).map(([x, y, s, d]) => (
            <g key={`h-${x}`} transform={`translate(${x} ${y}) scale(${s})`}>
              <path
                className="heart fb"
                {...delay(d)}
                d="M0 7 C-13 -2 -8 -13 0 -6 C8 -13 13 -2 0 7Z"
                fill="#FF7A8A"
                stroke={INK}
                strokeWidth={2.2}
                strokeLinejoin="round"
              />
            </g>
          ))
        : null}
    </>
  );
}

function CurrencySymbols({ list }: { list: string[] }) {
  const step = 1.6;
  const total = step * list.length;
  return (
    <>
      {list.map((c, i) => {
        const delay = (i * step + 0.5 - total).toFixed(2);
        const size = c.length > 1 ? 46 : 64;
        return (
          <text
            key={`${c}-${i}`}
            className="sym"
            style={{ animationDelay: `${delay}s` }}
            x={100}
            y={102}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Bricolage Grotesque','Segoe UI',Arial,sans-serif"
            fontWeight={800}
            fontSize={size}
            fill="#E4AE2F"
            stroke={INK}
            strokeWidth={2.6}
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {c}
          </text>
        );
      })}
    </>
  );
}

export function PennyFigure({
  pose = 'idle',
  className,
  title,
  compact,
}: {
  pose?: PennyPose;
  className?: string;
  title?: string;
  /** Small UI: simpler mint ticks, hide props — orbit stays */
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const kit = toKitState(pose);
  const meta = PENNY_STATE_META[kit];
  const clipId = `pc-${uid}`;
  const symbols = meta.symbols;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      /* Include orbit ring; crop props / extra padding for small buttons */
      viewBox={compact ? '0 20 200 180' : '-20 -10 240 230'}
      className={cn('pn h-full w-full', `st-${kit}`, compact && 'pn-compact', className)}
      role={title ? 'img' : 'presentation'}
      aria-label={title ? `Penny, ${kit}` : undefined}
    >
      {title ? <title>{title}</title> : null}
      <g className="whole">
        <Orbit half="back" />
        <g className="coin">
          <CoinBody clipId={clipId} compact={compact} />
          {symbols?.length ? (
            <CurrencySymbols list={symbols} />
          ) : (
            <>
              <Eyes kind={meta.eyes} />
              <Mouth kind={meta.mouth} />
            </>
          )}
        </g>
        <Orbit half="front" />
      </g>
      {!compact ? <Props list={meta.props} /> : null}
    </svg>
  );
}
