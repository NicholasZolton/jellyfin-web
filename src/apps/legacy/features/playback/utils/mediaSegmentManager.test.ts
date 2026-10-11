import { Api } from '@jellyfin/sdk/lib/api';
import type { MediaSegmentDto } from '@jellyfin/sdk/lib/generated-client/models/media-segment-dto';
import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlaybackManager } from 'components/playback/playbackmanager';
import { TICKS_PER_MILLISECOND, TICKS_PER_SECOND } from 'constants/time';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { currentSettings as userSettings } from 'scripts/settings/userSettings';
import type { PlayerState } from 'types/playbackStopInfo';

import { bindMediaSegmentManager } from './mediaSegmentManager';
import { getId, getMarginId } from './mediaSegmentSettings';
import { MediaSegmentAction } from '../constants/mediaSegmentAction';

const { getItemSegments } = vi.hoisted(() => ({ getItemSegments: vi.fn() }));

vi.mock('@jellyfin/sdk/lib/utils/api/media-segment-api', () => ({
    getMediaSegmentApi: () => ({ getItemSegments })
}));
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: { getApi: vi.fn(), currentApiClient: vi.fn() }
}));
vi.mock('scripts/settings/userSettings', () => ({ currentSettings: { get: vi.fn() } }));
vi.mock('components/playback/playbackmanager', () => ({
    PlaybackManager: class {
        getCurrentPlayer = vi.fn();
        currentTime = vi.fn<() => number>();
        seek = vi.fn();
        nextTrack = vi.fn();
        promptToSkip = vi.fn();
    }
}));

const intro: MediaSegmentDto = {
    Type: MediaSegmentType.Intro,
    StartTicks: 0,
    EndTicks: 10 * TICKS_PER_SECOND
};
const state: PlayerState = {
    PlayState: {},
    NowPlayingItem: { ServerId: 'server' },
    NextItem: null,
    NextMediaType: null,
    MediaSource: { Id: 'episode', HasSegments: true }
};

describe('media segment auto-skip margins', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ServerConnections.getApi).mockReturnValue(new Api(
            'https://test.invalid', { name: 'Test', version: '1' }, { name: 'Test', id: 'test' }));
        getItemSegments.mockResolvedValue({ data: { Items: [intro] } });
        vi.mocked(userSettings.get).mockImplementation((id: string): string => {
            if (id === getId(MediaSegmentType.Intro)) return MediaSegmentAction.Skip;
            if (id === getMarginId(MediaSegmentType.Intro)) return '1';
            return MediaSegmentAction.None;
        });
    });

    it('waits for the opening margin, seeks to the closing margin, and does not skip again', async () => {
        const playback: PlaybackManager = new PlaybackManager();
        const manager = bindMediaSegmentManager(playback);
        manager.onPlayerPlaybackStart({ type: 'playbackstart' }, state);
        await vi.waitFor(() => expect(getItemSegments).toHaveBeenCalled());

        vi.mocked(playback.currentTime).mockReturnValue(500);
        manager.onPlayerTimeUpdate();
        expect(playback.seek).not.toHaveBeenCalled();

        vi.mocked(playback.currentTime).mockReturnValue(1000);
        manager.onPlayerTimeUpdate();
        expect(playback.seek).toHaveBeenCalledExactlyOnceWith(9 * TICKS_PER_SECOND, undefined);

        vi.mocked(playback.currentTime).mockReturnValue(9 * TICKS_PER_SECOND / TICKS_PER_MILLISECOND);
        manager.onPlayerTimeUpdate();
        expect(playback.seek).toHaveBeenCalledTimes(1);
    });

    it('leaves Ask To Skip timestamps unchanged', async () => {
        vi.mocked(userSettings.get).mockReturnValue(MediaSegmentAction.AskToSkip);
        const playback: PlaybackManager = new PlaybackManager();
        const manager = bindMediaSegmentManager(playback);
        manager.onPlayerPlaybackStart({ type: 'playbackstart' }, state);
        await vi.waitFor(() => expect(getItemSegments).toHaveBeenCalled());

        vi.mocked(playback.currentTime).mockReturnValue(0);
        manager.onPlayerTimeUpdate();
        expect(playback.promptToSkip).toHaveBeenCalledWith(intro);
        expect(playback.seek).not.toHaveBeenCalled();
    });

    it('does not auto-skip a segment whose margins consume its duration', async () => {
        getItemSegments.mockResolvedValue({ data: { Items: [{ ...intro, EndTicks: 2 * TICKS_PER_SECOND }] } });
        const playback: PlaybackManager = new PlaybackManager();
        const manager = bindMediaSegmentManager(playback);
        manager.onPlayerPlaybackStart({ type: 'playbackstart' }, state);
        await vi.waitFor(() => expect(getItemSegments).toHaveBeenCalled());

        vi.mocked(playback.currentTime).mockReturnValue(1000);
        manager.onPlayerTimeUpdate();
        expect(playback.seek).not.toHaveBeenCalled();
        expect(playback.nextTrack).not.toHaveBeenCalled();
    });
});
