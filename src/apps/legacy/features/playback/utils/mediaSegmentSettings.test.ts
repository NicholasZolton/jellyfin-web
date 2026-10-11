import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import { describe, expect, it, vi } from 'vitest';

import type { UserSettings } from 'scripts/settings/userSettings';

import { getMarginId, getMediaSegmentSkipMargin } from './mediaSegmentSettings';

describe('getMediaSegmentSkipMargin()', () => {
    it.each([null, '', '-1', 'NaN', 'Infinity', 'invalid'])('defaults invalid or absent margins to zero (%s)', (value: string | null) => {
        const get = vi.fn<UserSettings['get']>().mockReturnValue(value);
        const settings: Pick<UserSettings, 'get'> = { get };
        expect(getMediaSegmentSkipMargin(settings, MediaSegmentType.Intro)).toBe(0);
    });

    it('reads a fractional margin for the selected segment type', () => {
        const get = vi.fn<UserSettings['get']>().mockReturnValue('1.5');
        const settings: Pick<UserSettings, 'get'> = { get };
        expect(getMediaSegmentSkipMargin(settings, MediaSegmentType.Outro)).toBe(1.5);
        expect(get).toHaveBeenCalledWith(getMarginId(MediaSegmentType.Outro), false);
    });
});
