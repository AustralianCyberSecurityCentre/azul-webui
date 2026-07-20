import { AppRouterState, routerReducer } from "./route-reducer";
export interface AppState {
  router: AppRouterState;
}

export const reducers = {
  router: routerReducer,
};
