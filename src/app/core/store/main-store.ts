import { AppRouterState, routerReducer } from "./route-reducer";
import {
  GlobalSettingState,
  globalSettingReducer,
} from "./global-settings/global-reducer";
export interface AppState {
  router: AppRouterState;
  globalSetting: GlobalSettingState;
}

export const reducers = {
  router: routerReducer,
  globalSetting: globalSettingReducer,
};
