export type FoldPosture = 'notFoldable' | 'unknown' | 'folded' | 'halfOpened' | 'unfolded';

export interface Bounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface FoldRegion extends Bounds {
    isActive: boolean;
}

export interface FoldState {
    state: FoldPosture;
    isFoldableDevice: boolean;
    hingeAngle: number | null;
    isLandscape: boolean;
    isVerticalHinge: boolean;
    fold: FoldRegion | null;
    occlusions: FoldRegion[];
}

export type Insets = Bounds;

export interface InsetOptions {
    direction?: 'ltr' | 'rtl';
    avoidCamera?: boolean;
    avoidFold?: boolean;
}

export interface FoldSubscription {
    remove(): Promise<void>;
}

export interface FoldableLayoutAPI {
    watch(listener: (state: FoldState) => void, onError?: (error: unknown) => void): Promise<FoldSubscription>;
    getState(): Promise<FoldState>;
    waitForSettle(quietWindow?: number): Promise<FoldState>;
    avoidInsets: typeof avoidInsets;
    isPhoneLayout(shortestSide: number, state: FoldState, platform: 'ios' | 'android' | 'web'): boolean;
}

export function avoidInsets(area: Bounds, state: FoldState, options?: InsetOptions): Insets;
export const FoldableLayout: FoldableLayoutAPI;

declare global {
    interface Window {
        FoldableLayout?: FoldableLayoutAPI;
    }
}
