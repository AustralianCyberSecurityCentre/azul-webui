import { createSelector } from "@ngrx/store";
import { AppState } from "../main-store";

const selectGlobalConfigState = (state: AppState) => state.globalSetting;

export const selectIsTableView = createSelector(
  selectGlobalConfigState,
  (state) => state.IsTableView,
);
export const selectBinaryExploreShowEntropy = createSelector(
  selectGlobalConfigState,
  (state) => state.BinaryExploreShowEntropy,
);
export const selectBinaryExploreShowMimetype = createSelector(
  selectGlobalConfigState,
  (state) => state.BinaryExploreShowMimetype,
);
export const selectBinaryExploreShowMagic = createSelector(
  selectGlobalConfigState,
  (state) => state.BinaryExploreShowMagic,
);

export const selectBinaryExploreShowSources = createSelector(
  selectGlobalConfigState,
  (state) => state.BinaryExploreShowSources,
);

export const selectBinaryExploreShowSourceReferences = createSelector(
  selectGlobalConfigState,
  (state) => state.BinaryExploreShowSourceReferences,
);

export const selectBucketSize = createSelector(
  selectGlobalConfigState,
  (state) => state.bucketSize,
);

export const selectRelationalGraphShowCousinsByDefault = createSelector(
  selectGlobalConfigState,
  (state) => state.relationalGraphShowCousinsByDefault,
);

export const selectShowDebugInfo = createSelector(
  selectGlobalConfigState,
  (state) => state.showDebugInfo,
);

export const colorThemeConfig = createSelector(
  selectGlobalConfigState,
  (state) => state.theme,
);

export const selectDebugEditorHeightPx = createSelector(
  selectGlobalConfigState,
  (state) => state.debugQueryEditorHeightPx,
);

export const textEditorConfig = createSelector(
  selectGlobalConfigState,
  (state) => {
    return { theme: state.theme, editorHeight: state.debugQueryEditorHeightPx };
  },
);

export const selectEnableHexStringSync = createSelector(
  selectGlobalConfigState,
  (state) => {
    return state.enableHexStringSync;
  },
);

export const selectDefaultSourceView = createSelector(
  selectGlobalConfigState,
  (state) => {
    return state.defaultSourceView;
  },
);
