import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';

import type { UserSettings } from 'scripts/settings/userSettings';

import { MediaSegmentAction } from '../constants/mediaSegmentAction';

const PREFIX = 'segmentTypeAction';
const MARGIN_PREFIX = 'segmentTypeSkipMargin';
const DEFAULT_ACTIONS: Partial<Record<MediaSegmentType, MediaSegmentAction>> = {
    [MediaSegmentType.Intro]: MediaSegmentAction.AskToSkip,
    [MediaSegmentType.Outro]: MediaSegmentAction.AskToSkip
};

export const getId = (type: MediaSegmentType) => `${PREFIX}__${type}`;

export const getMarginId = (type: MediaSegmentType): string => `${MARGIN_PREFIX}__${type}`;

export function getMediaSegmentSkipMargin(userSettings: Pick<UserSettings, 'get'>, type: MediaSegmentType): number {
    const seconds: number = Number(userSettings.get(getMarginId(type), false));
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

export function getMediaSegmentAction(userSettings: UserSettings, type: MediaSegmentType): MediaSegmentAction {
    const action = userSettings.get(getId(type), false);
    const defaultAction = DEFAULT_ACTIONS[type] || MediaSegmentAction.None;

    return action ? action as MediaSegmentAction : defaultAction;
}
