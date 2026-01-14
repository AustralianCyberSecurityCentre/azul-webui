import { createAction, props } from "@ngrx/store";
import { ColorTheme } from "./global-state.types";

export const saveBinaryExploreShowEntropy = createAction(
  "[GlobalSetting] Save BinaryExploreShowEntropy",
  props<{ BinaryExploreShowEntropy: boolean }>(),
);
export const saveBinaryExploreShowMimetype = createAction(
  "[GlobalSetting] Save BinaryExploreShowMimetype",
  props<{ BinaryExploreShowMimetype: boolean }>(),
);
export const saveBinaryExploreShowMagic = createAction(
  "[GlobalSetting] Save BinaryExploreShowMagic",
  props<{ BinaryExploreShowMagic: boolean }>(),
);

export const saveBucketSize = createAction(
  "[GlobalSetting] Save Bucket Size",
  props<{ size: number }>(),
);

export const saveRelationalGraphShowCousinsByDefault = createAction(
  "[GlobalSetting] Save Relational Graph Show Cousins by Default",
  props<{ relationalGraphShowCousinsByDefault: boolean }>(),
);

export const saveShowDebugInfo = createAction(
  "[GlobalSetting] Save Show Debug Info",
  props<{ showDebugInfo: boolean }>(),
);

export const saveDebugEditorHeightPx = createAction(
  "[GlobalSetting] Save Debug Editor Height",
  props<{ editorHeightPx: number }>(),
);

export const setColorTheme = createAction(
  "[GlobalSetting] Set Color Theme",
  props<{ newColorTheme: ColorTheme }>(),
);
