import type { MediaSegmentDto } from '@jellyfin/sdk/lib/generated-client/models/media-segment-dto';
import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import { describe, expect, it } from 'vitest';

import { TICKS_PER_SECOND } from 'constants/time';

import { findCurrentSegment, withSkipMargin } from './mediaSegments';

const TEST_SEGMENTS: MediaSegmentDto[] = [
    {
        Id: 'intro',
        Type: MediaSegmentType.Intro,
        StartTicks: 0,
        EndTicks: 10
    },
    {
        Id: 'preview',
        Type: MediaSegmentType.Preview,
        StartTicks: 20,
        EndTicks: 30
    },
    {
        Id: 'recap',
        Type: MediaSegmentType.Recap,
        StartTicks: 30,
        EndTicks: 40
    },
    {
        Id: 'commercial',
        Type: MediaSegmentType.Commercial,
        StartTicks: 40,
        EndTicks: 50
    },
    {
        Id: 'outro',
        Type: MediaSegmentType.Outro,
        StartTicks: 50,
        EndTicks: 60
    }
];

describe('withSkipMargin()', () => {
    const intro: MediaSegmentDto = {
        Type: MediaSegmentType.Intro,
        StartTicks: 0,
        EndTicks: 10 * TICKS_PER_SECOND
    };

    it('keeps the beginning and end without changing detected timestamps', () => {
        const window: MediaSegmentDto | undefined = withSkipMargin(intro, 1);
        expect(window?.StartTicks).toBe(TICKS_PER_SECOND);
        expect(window?.EndTicks).toBe(9 * TICKS_PER_SECOND);
        expect(intro.StartTicks).toBe(0);
        expect(intro.EndTicks).toBe(10 * TICKS_PER_SECOND);
    });

    it('does not select either retained edge for another skip', () => {
        const window: MediaSegmentDto | undefined = withSkipMargin(intro, 1);
        expect(window).toBeDefined();
        if (!window) throw new Error('Expected a skip window');

        expect(findCurrentSegment([window], 0.5 * TICKS_PER_SECOND)).toBeUndefined();
        expect(findCurrentSegment([window], TICKS_PER_SECOND)).toBeDefined();
        expect(findCurrentSegment([window], 9 * TICKS_PER_SECOND)).toBeUndefined();
    });

    it('preserves the existing behavior when the margin is zero', () => {
        expect(withSkipMargin(intro, 0)).toBe(intro);
    });

    it('supports fractional seconds', () => {
        expect(withSkipMargin(intro, 0.5)?.StartTicks).toBe(TICKS_PER_SECOND / 2);
    });

    it('leaves short segments playing instead of seeking backwards', () => {
        expect(withSkipMargin(intro, 5)).toBeUndefined();
        expect(withSkipMargin(intro, 4.6)).toBeUndefined();
        expect(withSkipMargin(intro, 4.5)).toBeDefined();
    });
});

describe('findCurrentSegment()', () => {
    it('Should return the current segment', () => {
        let segmentDetails = findCurrentSegment(TEST_SEGMENTS, 23);
        expect(segmentDetails).toBeDefined();
        expect(segmentDetails?.index).toBe(1);
        expect(segmentDetails?.segment?.Id).toBe('preview');

        segmentDetails = findCurrentSegment(TEST_SEGMENTS, 5, 1);
        expect(segmentDetails).toBeDefined();
        expect(segmentDetails?.index).toBe(0);
        expect(segmentDetails?.segment?.Id).toBe('intro');

        segmentDetails = findCurrentSegment(TEST_SEGMENTS, 42, 3);
        expect(segmentDetails).toBeDefined();
        expect(segmentDetails?.index).toBe(3);
        expect(segmentDetails?.segment?.Id).toBe('commercial');
    });

    it('Should return undefined if not in a segment', () => {
        let segmentDetails = findCurrentSegment(TEST_SEGMENTS, 16);
        expect(segmentDetails).toBeUndefined();

        segmentDetails = findCurrentSegment(TEST_SEGMENTS, 10, 1);
        expect(segmentDetails).toBeUndefined();

        segmentDetails = findCurrentSegment(TEST_SEGMENTS, 100);
        expect(segmentDetails).toBeUndefined();
    });
});
