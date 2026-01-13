import { createSelector } from "@ngrx/store";
import { AppState } from "../main-store";
import { GlobalSettingState } from "./global-reducer";

const selectGlobalConfigState = (state: AppState) => state.globalSetting;

export const selectBinaryExploreShowEntropy = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.BinaryExploreShowEntropy,
);
export const selectBinaryExploreShowFileFormatLegacy = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.BinaryExploreShowFileFormatLegacy,
);
export const selectBinaryExploreShowMimetype = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.BinaryExploreShowMimetype,
);
export const selectBinaryExploreShowMagic = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.BinaryExploreShowMagic,
);

export const selectBucketSize = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.bucketSize,
);

export const selectRelationalGraphShowCousinsByDefault = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.relationalGraphShowCousinsByDefault,
);

export const selectShowDebugInfo = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.showDebugInfo,
);

export const colorThemeConfig = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.theme,
);

export const selectDebugEditorHeightPx = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => state.debugQueryEditorHeightPx,
);

export const textEditorConfig = createSelector(
  selectGlobalConfigState,
  (state: GlobalSettingState) => {
    return { theme: state.theme, editorHeight: state.debugQueryEditorHeightPx };
  },
);
