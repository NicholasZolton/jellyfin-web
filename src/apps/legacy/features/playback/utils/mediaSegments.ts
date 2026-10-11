import type { MediaSegmentDto } from '@jellyfin/sdk/lib/generated-client/models/media-segment-dto';

import { TICKS_PER_SECOND } from 'constants/time';

// Shrink only the client's auto-skip window; keep detected timestamps intact.
export function withSkipMargin(segment: MediaSegmentDto, seconds: number): MediaSegmentDto | undefined {
    if (seconds <= 0 || segment.StartTicks === undefined || segment.EndTicks === undefined) {
        return segment;
    }

    const marginTicks: number = seconds * TICKS_PER_SECOND;
    const startTicks: number = segment.StartTicks + marginTicks;
    const endTicks: number = segment.EndTicks - marginTicks;

    if (endTicks - startTicks < TICKS_PER_SECOND) return undefined;

    return { ...segment, StartTicks: startTicks, EndTicks: endTicks };
}

const isBeforeSegment = (segment: MediaSegmentDto, time: number, direction: number) => {
    if (direction === -1) {
        return (
            typeof segment.EndTicks !== 'undefined'
            && segment.EndTicks <= time
        );
    }
    return (
        typeof segment.StartTicks !== 'undefined'
        && segment.StartTicks > time
    );
};

export const isInSegment = (segment: MediaSegmentDto, time: number) => (
    typeof segment.StartTicks !== 'undefined'
    && segment.StartTicks <= time
    && (typeof segment.EndTicks === 'undefined' || segment.EndTicks > time)
);

export const findCurrentSegment = (segments: MediaSegmentDto[], time: number, lastIndex = 0) => {
    const lastSegment = segments[lastIndex];
    if (isInSegment(lastSegment, time)) {
        return { index: lastIndex, segment: lastSegment };
    }

    let direction = 1;
    if (lastIndex > 0 && lastSegment.StartTicks && lastSegment.StartTicks > time) {
        direction = -1;
    }

    for (
        let index = lastIndex, segment = segments[index];
        index >= 0 && index < segments.length;
        index += direction, segment = segments[index]
    ) {
        if (isBeforeSegment(segment, time, direction)) return;
        if (isInSegment(segment, time)) return { index, segment };
    }
};
